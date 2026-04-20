// Automated performance regression check for PaginationPlus.
//
// Spawns a static file server for ./perf, launches headless Chrome via
// puppeteer, loads the playground with a content size that paginates to
// ~100 pages, and asserts:
//
//   * initial convergence completes under CONVERGENCE_MAX_MS
//   * per-keystroke p95 stays under KEYSTROKE_P95_MAX_MS
//
// Before the perf fix these numbers were ~730 ms and ~335 ms respectively
// on a 100-page document; any regression to that ballpark fails the run.
// Override thresholds via env vars (e.g. `CONVERGENCE_MAX_MS=5000 npm run
// test:perf`) when running on a slower CI box.

import { spawn } from "node:child_process";
import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve as pathResolve } from "node:path";
import puppeteer from "puppeteer";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = pathResolve(here, "..");
const bundlePath = join(here, "bundle.js");

const CONVERGENCE_MAX_MS = Number(process.env.CONVERGENCE_MAX_MS ?? 3000);
const KEYSTROKE_P95_MAX_MS = Number(process.env.KEYSTROKE_P95_MAX_MS ?? 100);
const PARAGRAPHS = Number(process.env.PERF_PARAGRAPHS ?? 600);
const TABLES = Number(process.env.PERF_TABLES ?? 25);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

async function ensureBundle() {
  if (existsSync(bundlePath)) return;
  console.log("[perf] bundle.js missing, running perf/build.mjs first…");
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [join(here, "build.mjs")],
      { cwd: projectRoot, stdio: "inherit" }
    );
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`build.mjs exited ${code}`))
    );
  });
}

function startServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      const relPath = url.pathname === "/" ? "/playground.html" : url.pathname;
      const filePath = join(here, decodeURIComponent(relPath));
      if (!filePath.startsWith(here) || !existsSync(filePath)) {
        res.statusCode = 404;
        res.end("not found");
        return;
      }
      const stat = statSync(filePath);
      if (!stat.isFile()) {
        res.statusCode = 404;
        res.end("not found");
        return;
      }
      const ext = filePath.slice(filePath.lastIndexOf("."));
      res.setHeader("Content-Type", MIME[ext] ?? "application/octet-stream");
      res.setHeader("Cache-Control", "no-store");
      createReadStream(filePath).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("server address unavailable"));
        return;
      }
      resolve({ server, port: addr.port });
    });
    server.on("error", reject);
  });
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((p / 100) * sorted.length))
  );
  return sorted[idx];
}

async function main() {
  await ensureBundle();
  const { server, port } = await startServer();

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    const url = `http://127.0.0.1:${port}/playground.html?paragraphs=${PARAGRAPHS}&tables=${TABLES}`;

    const pageLogs = [];
    page.on("console", (msg) => pageLogs.push(`[page:${msg.type()}] ${msg.text()}`));
    page.on("pageerror", (err) => pageLogs.push(`[page:error] ${err.message}`));

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Wait for the playground to signal convergence complete.
    await page.waitForFunction(
      () => document.body.getAttribute("data-perf-done") === "true",
      { timeout: 30000 }
    );

    const summary = await page.evaluate(() => window.__perfSummary);
    if (!summary) throw new Error("playground did not expose __perfSummary");

    // Keystroke latency: type one character at a time, waiting two rAFs per
    // insert so the pagination cycle is fully applied before timing the next.
    const keystroke = await page.evaluate(async () => {
      const editor = window.__editor;
      editor.commands.focus("end");
      // warmup — first insert sometimes pays for selection adjustments
      editor.commands.insertContent("w");
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r))
      );
      const samples = [];
      for (let i = 0; i < 15; i++) {
        const t = performance.now();
        editor.commands.insertContent("x");
        await new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r))
        );
        samples.push(performance.now() - t);
      }
      return samples;
    });

    const sorted = [...keystroke].sort((a, b) => a - b);
    const avg = keystroke.reduce((s, v) => s + v, 0) / keystroke.length;
    const p95 = percentile(sorted, 95);

    const report = {
      pages: summary.renderedPages,
      paragraphs: PARAGRAPHS,
      tables: TABLES,
      editorCreatedMs: Math.round(
        summary.timings.find((t) => t.label === "editor-created")?.tMs ?? 0
      ),
      convergenceMs: summary.convergenceMs,
      keystrokeAvgMs: Math.round(avg * 10) / 10,
      keystrokeP95Ms: Math.round(p95 * 10) / 10,
      keystrokeSamples: keystroke.map((v) => Math.round(v * 10) / 10),
      thresholds: {
        CONVERGENCE_MAX_MS,
        KEYSTROKE_P95_MAX_MS,
      },
    };
    console.log("[perf]", JSON.stringify(report, null, 2));

    const failures = [];
    if (report.pages < 90) {
      failures.push(
        `expected ~100 pages but playground rendered only ${report.pages} (seed size too small?)`
      );
    }
    if (report.convergenceMs > CONVERGENCE_MAX_MS) {
      failures.push(
        `convergence ${report.convergenceMs}ms > ${CONVERGENCE_MAX_MS}ms threshold`
      );
    }
    if (report.keystrokeP95Ms > KEYSTROKE_P95_MAX_MS) {
      failures.push(
        `keystroke p95 ${report.keystrokeP95Ms}ms > ${KEYSTROKE_P95_MAX_MS}ms threshold`
      );
    }
    if (failures.length > 0) {
      console.error("[perf] FAIL");
      for (const f of failures) console.error("  - " + f);
      if (pageLogs.length > 0) {
        console.error("[perf] page console:");
        for (const l of pageLogs) console.error("  " + l);
      }
      process.exitCode = 1;
    } else {
      console.log("[perf] OK");
    }
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
