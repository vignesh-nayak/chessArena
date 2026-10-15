import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/**
 * Copy Stockfish lite single-threaded build into public/engine with short
 * names. Vite can intercept the package’s original filenames
 * (`stockfish-19-lite-single.*`) and serve SPA HTML in dev instead of the file.
 * The worker loads WASM as the same basename with `.wasm`.
 */
const STOCKFISH_ASSETS = [
  { src: "stockfish-19-lite-single.js", dest: "sf.js" },
  { src: "stockfish-19-lite-single.wasm", dest: "sf.wasm" },
] as const;

const PUBLIC_ENGINE_DIR = "engine";

function copyStockfishAssets(): Plugin {
  const destDir = path.resolve(__dirname, "public", PUBLIC_ENGINE_DIR);

  function copy() {
    const pkgJson = require.resolve("stockfish/package.json");
    const srcDir = path.join(path.dirname(pkgJson), "bin");
    fs.mkdirSync(destDir, { recursive: true });
    for (const { src, dest } of STOCKFISH_ASSETS) {
      const from = path.join(srcDir, src);
      const to = path.join(destDir, dest);
      if (!fs.existsSync(from)) {
        throw new Error(`Missing Stockfish asset: ${from}`);
      }
      fs.copyFileSync(from, to);
    }
  }

  return {
    name: "copy-stockfish-assets",
    configResolved() {
      copy();
    },
    buildStart() {
      copy();
    },
    configureServer() {
      copy();
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), copyStockfishAssets()],
  server: {
    port: 5173,
    host: true,
  },
  optimizeDeps: {
    exclude: ["stockfish"],
  },
});
