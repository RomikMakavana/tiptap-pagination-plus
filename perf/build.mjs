import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve as pathResolve } from "node:path";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = pathResolve(here, "..");

// A stray ~/.pnp.cjs on this machine makes esbuild's default resolver enforce
// Yarn PnP rules and refuse to find packages in our local node_modules. We
// bypass that by doing node-style resolution ourselves via createRequire, and
// marking the results as resolved so esbuild trusts them.
const requireFromRoot = createRequire(join(projectRoot, "package.json"));
const nodeResolvePlugin = {
  name: "node-resolve-bypass-pnp",
  setup(b) {
    b.onResolve({ filter: /^[^./]/ }, (args) => {
      try {
        const full = requireFromRoot.resolve(args.path);
        return { path: full };
      } catch {
        return null;
      }
    });
  },
};

await build({
  entryPoints: [join(here, "playground.ts")],
  bundle: true,
  format: "esm",
  target: "es2020",
  sourcemap: "inline",
  outfile: join(here, "bundle.js"),
  logLevel: "info",
  plugins: [nodeResolvePlugin],
  absWorkingDir: projectRoot,
});
