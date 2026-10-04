import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { defineConfig, Plugin } from "vite";

const dist = resolve(__dirname, "dist");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/** Escribe en dist/sw.js la lista de archivos a guardar para el modo sin conexión. */
function swPrecache(): Plugin {
  return {
    name: "sw-precache",
    apply: "build",
    closeBundle() {
      const files = walk(dist).filter((path) => !path.endsWith("sw.js"));
      const hash = createHash("sha1");
      for (const path of files) hash.update(readFileSync(path));
      const urls = ["./", ...files.map((path) => "./" + relative(dist, path).replace(/\\/g, "/"))];
      const swPath = join(dist, "sw.js");
      const sw = readFileSync(swPath, "utf8")
        .replace("__SW_VERSION__", hash.digest("hex").slice(0, 12))
        .replace("/*__PRECACHE__*/ []", JSON.stringify(urls));
      writeFileSync(swPath, sw);
    },
  };
}

export default defineConfig({
  root: "app",
  base: "./",
  build: { outDir: dist, emptyOutDir: true },
  plugins: [swPrecache()],
  // Sin preempaquetar: en desarrollo el .wasm de onnxruntime-web se sirve junto a su .mjs.
  optimizeDeps: { exclude: ["onnxruntime-web"] },
});
