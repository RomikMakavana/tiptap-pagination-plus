import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { PaginationPlus } from "../src/index";

type TimingEntry = { label: string; tMs: number };

const timings: TimingEntry[] = [];
const t0 = performance.now();
const mark = (label: string) => {
  const tMs = performance.now() - t0;
  timings.push({ label, tMs });
  // eslint-disable-next-line no-console
  console.log(`[mark] ${label}: ${tMs.toFixed(1)}ms`);
};

function buildSeedHtml(paragraphCount: number, tableCount: number): string {
  const parts: string[] = [];
  // Interleave paragraphs and tables so pages mix both.
  const parasBetweenTables = Math.max(1, Math.floor(paragraphCount / (tableCount + 1)));
  let paraIdx = 0;
  for (let t = 0; t < tableCount; t++) {
    for (let p = 0; p < parasBetweenTables && paraIdx < paragraphCount; p++, paraIdx++) {
      parts.push(
        `<p>Paragraph ${paraIdx + 1}. ${"Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(6)}</p>`
      );
    }
    // A small table: 1 header row + 10 body rows, 4 columns.
    const rows: string[] = [];
    rows.push(
      `<tr>${["Col A", "Col B", "Col C", "Col D"]
        .map((h) => `<th>${h}</th>`)
        .join("")}</tr>`
    );
    for (let r = 0; r < 10; r++) {
      rows.push(
        `<tr>${[1, 2, 3, 4]
          .map((c) => `<td>T${t + 1} R${r + 1} C${c}</td>`)
          .join("")}</tr>`
      );
    }
    parts.push(`<table><tbody>${rows.join("")}</tbody></table>`);
  }
  // Remaining paragraphs after the last table.
  for (; paraIdx < paragraphCount; paraIdx++) {
    parts.push(
      `<p>Paragraph ${paraIdx + 1}. ${"Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(6)}</p>`
    );
  }
  return parts.join("");
}

function countRenderedPages(): number {
  const pages = document.querySelector("[data-rm-pagination]");
  return pages ? pages.children.length : 0;
}

async function main() {
  const urlParams = new URLSearchParams(location.search);
  const paragraphCount = Number(urlParams.get("paragraphs") ?? 300);
  const tableCount = Number(urlParams.get("tables") ?? 15);
  const file = urlParams.get("file");

  const statusEl = document.getElementById("status")!;
  const el = document.getElementById("editor")!;

  let html: string;
  if (file) {
    statusEl.textContent = `Fetching ${file}…`;
    const res = await fetch(file);
    if (!res.ok) throw new Error(`fetch ${file}: ${res.status}`);
    html = await res.text();
  } else {
    statusEl.textContent = `Building content (paragraphs=${paragraphCount}, tables=${tableCount})…`;
    html = buildSeedHtml(paragraphCount, tableCount);
  }
  mark("html-built");

  statusEl.textContent = "Creating editor…";
  const editor = new Editor({
    element: el,
    extensions: [
      StarterKit,
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      PaginationPlus.configure({
        pageHeight: 800,
        pageWidth: 789,
        marginTop: 20,
        marginBottom: 20,
        marginLeft: 50,
        marginRight: 50,
        pageGap: 50,
        contentMarginTop: 10,
        contentMarginBottom: 10,
        footerRight: "{page}",
        footerLeft: "",
        headerRight: "",
        headerLeft: "",
        customHeader: {},
        customFooter: {},
      }),
    ],
    content: html,
  });
  (window as any).__editor = editor;
  mark("editor-created");

  // Wait for pagination to converge. The extension tags the editor DOM with
  // [data-rm-pagination] and renders one child per page. We watch that node
  // for children mutations and resolve when it stabilises for a few frames.
  const convergedTarget = await new Promise<{ pages: number; ms: number }>(
    (resolve) => {
      let lastCount = -1;
      let stableFrames = 0;
      const STABLE_FRAMES = 10;
      const start = performance.now();
      const loop = () => {
        const count = countRenderedPages();
        if (count === lastCount && count > 0) {
          stableFrames++;
          if (stableFrames >= STABLE_FRAMES) {
            resolve({ pages: count, ms: performance.now() - start });
            return;
          }
        } else {
          stableFrames = 0;
          lastCount = count;
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
  );
  mark("pagination-converged");

  const summary = {
    paragraphCount,
    tableCount,
    renderedPages: convergedTarget.pages,
    convergenceMs: Math.round(convergedTarget.ms),
    totalMs: Math.round(performance.now() - t0),
    timings,
  };
  (window as any).__perfSummary = summary;
  statusEl.textContent =
    `Pages: ${summary.renderedPages} | convergence: ${summary.convergenceMs}ms | total: ${summary.totalMs}ms`;
  // eslint-disable-next-line no-console
  console.log("[perf-summary]", summary);
  // Signal for the harness.
  document.body.setAttribute("data-perf-done", "true");
}

main().catch((err) => {
  console.error(err);
  const statusEl = document.getElementById("status");
  if (statusEl) statusEl.textContent = `Error: ${(err as Error).message}`;
});
