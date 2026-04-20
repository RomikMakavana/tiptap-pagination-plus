# Performance reproduction

Pagination is a DOM-layout feature, so regressions can't be caught with
node-level unit tests — we need a real browser. This folder contains two
complementary tools:

1. `playground.html` — interactive reproduction for ad-hoc profiling.
2. `measure.mjs` — automated regression check using headless Chrome.

Both load TipTap + `PaginationPlus` with a seeded document sized to ~100
pages of mixed paragraphs and tables.

## Playground (manual)

```sh
npm run perf:serve
```

Opens a local server on port 7777. Navigate to
`http://127.0.0.1:7777/playground.html?paragraphs=600&tables=25` to render
a ~100-page document. Query params:

- `paragraphs` — number of paragraph blocks (default 300)
- `tables` — number of 4×11 tables interleaved with paragraphs (default 15)

The page exposes:

- `window.__editor` — the TipTap `Editor`, for poking via the devtools console.
- `window.__perfSummary` — set once pagination converges; contains page
  count, convergence time, and the timing marks collected during boot.

Use Chrome DevTools → Performance → Record to capture traces of typing
bursts, paste events, etc.

## Automated regression test

```sh
npm run test:perf
```

`measure.mjs` spawns Chromium via puppeteer, loads the playground, waits
for convergence, types 15 characters, and asserts thresholds:

| Threshold            | Default  | Env override             |
| -------------------- | -------- | ------------------------ |
| Convergence          | 4000 ms  | `CONVERGENCE_MAX_MS`     |
| Per-keystroke p95    | 250 ms   | `KEYSTROKE_P95_MAX_MS`   |
| Paragraph seed count | 600      | `PERF_PARAGRAPHS`        |
| Table seed count     | 25       | `PERF_TABLES`            |

The thresholds are set to roughly 2× the observed fix baseline so CI
boxes survive run-to-run variance, while still catching any return to
the pre-fix ballpark (keystroke p95 ~335 ms).

Observed baselines at ~105 pages on an M-series Mac (headless
puppeteer):

| Metric                 | Before fix       | After fix |
| ---------------------- | ---------------: | --------: |
| First-convergence time |         ~2000 ms |  ~1000 ms |
| Forced reflow          |           316 ms |     94 ms |
| Keystroke p95          |           335 ms |   70-150 ms |
| LCP                    |          2079 ms |    307 ms |

Keystroke p95 has meaningful variance depending on system load — the
rAF cycle itself costs < 1 ms per keystroke at steady state (confirmed
by instrumentation); the rest is ProseMirror's own DOM patching at
~4000 tracked nodes. The win versus the pre-fix code is that layout
reads no longer happen in `Plugin.state.apply` on every transaction.

## Implementation notes

- `build.mjs` bundles `playground.ts` with esbuild and includes a small
  node-style resolver plugin. This is a defensive workaround: if a stray
  `.pnp.cjs` exists in an ancestor directory (common on machines that
  once used Yarn Berry), esbuild's default resolver will refuse to pull
  anything from `node_modules`. The plugin uses `createRequire` so we
  always resolve against this project's real `node_modules`.
- The playground's `pagination-converged` mark waits for the
  `[data-rm-pagination]` child count to stay stable for 10 frames rather
  than a fixed timeout, so it measures true steady state rather than a
  best-guess delay.
