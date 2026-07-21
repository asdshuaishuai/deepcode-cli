// Build script for the Deep Code Desktop (Electron) client.
//
// Produces three bundles under dist/:
//   - main.js      (ESM, Electron main process — runs the Deep Code core engine)
//   - preload.cjs  (CJS, Electron preload — exposes a typed bridge to the renderer)
//   - renderer/    (browser bundle + index.html + styles.css — the React GUI)
//
// The core engine and its native-ish node dependencies (openai, undici, ...) are
// left external so they resolve from node_modules at runtime, exactly like the CLI.

import { build, context } from "esbuild";
import { cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const isDev = process.argv.includes("--dev");
const outdir = resolve(__dirname, "dist");

const shared = {
  bundle: true,
  sourcemap: true,
  logLevel: "info",
  define: {
    "process.env.NODE_ENV": JSON.stringify(isDev ? "development" : "production"),
  },
};

/** Main process: ESM, keep node deps + core external for runtime resolution. */
const mainConfig = {
  ...shared,
  entryPoints: [resolve(__dirname, "src/main/index.ts")],
  outfile: resolve(outdir, "main.js"),
  platform: "node",
  format: "esm",
  target: "node22",
  packages: "external",
  banner: {
    // Provide CJS-style globals a few node deps expect, harmless for our own code.
    js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
  },
};

/** Preload: CJS (required for sandboxed preload), electron external. */
const preloadConfig = {
  ...shared,
  entryPoints: [resolve(__dirname, "src/preload/index.ts")],
  outfile: resolve(outdir, "preload.cjs"),
  platform: "node",
  format: "cjs",
  target: "node22",
  external: ["electron"],
};

/** Renderer: browser bundle, everything bundled in. */
const rendererConfig = {
  ...shared,
  entryPoints: [resolve(__dirname, "src/renderer/main.tsx")],
  outfile: resolve(outdir, "renderer/renderer.js"),
  platform: "browser",
  format: "esm",
  target: "chrome124",
  jsx: "automatic",
  loader: { ".png": "dataurl", ".svg": "dataurl" },
};

async function copyStaticAssets() {
  await mkdir(resolve(outdir, "renderer"), { recursive: true });
  await cp(resolve(__dirname, "src/renderer/index.html"), resolve(outdir, "renderer/index.html"));
  await cp(resolve(__dirname, "src/renderer/styles.css"), resolve(outdir, "renderer/styles.css"));
}

async function run() {
  if (isDev) {
    const contexts = await Promise.all([context(mainConfig), context(preloadConfig), context(rendererConfig)]);
    await Promise.all(contexts.map((ctx) => ctx.watch()));
    await copyStaticAssets();
    console.log("[desktop] watching for changes… (run `npm run start` in another terminal)");
    return;
  }

  await Promise.all([build(mainConfig), build(preloadConfig), build(rendererConfig)]);
  await copyStaticAssets();
  console.log("[desktop] build complete → dist/");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
