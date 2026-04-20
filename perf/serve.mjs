// Minimal static file server for the perf playground.
// Used by `npm run perf:serve`; the automated harness in measure.mjs spins
// up its own ephemeral server and doesn't depend on this.

import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 7777);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const relPath = url.pathname === "/" ? "/playground.html" : url.pathname;
    const filePath = join(here, decodeURIComponent(relPath));
    if (!filePath.startsWith(here) || !existsSync(filePath) || !statSync(filePath).isFile()) {
      res.statusCode = 404;
      res.end("not found");
      return;
    }
    const ext = filePath.slice(filePath.lastIndexOf("."));
    res.setHeader("Content-Type", MIME[ext] ?? "application/octet-stream");
    res.setHeader("Cache-Control", "no-store");
    createReadStream(filePath).pipe(res);
  })
  .listen(port, () => {
    console.log(
      `perf playground: http://127.0.0.1:${port}/playground.html?paragraphs=600&tables=25`
    );
  });
