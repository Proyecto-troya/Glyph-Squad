import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { defineConfig, Plugin } from "vite";
import { readEnvFile } from "./scripts/env-file.mjs";

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

/** En `npm run dev` y `npm run preview` atiende /api/* con las funciones de api/ y los secretos de .env, como hace Vercel. */
function localApi(): Plugin {
  const serve = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const name = /^\/api\/([a-z]+)$/.exec((req.url ?? "").split("?")[0])?.[1];
    const file = name ? resolve(__dirname, "api", `${name}.js`) : "";
    if (!file || !existsSync(file)) return next();

    let body = "";
    for await (const chunk of req) body += chunk;
    // Se lee en cada petición: basta guardar .env para que el cambio valga, sin reiniciar.
    Object.assign(process.env, readEnvFile(resolve(__dirname, ".env")));
    const reply = Object.assign(res, {
      status: (code: number) => {
        res.statusCode = code;
        return res;
      },
      json: (data: unknown) => {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(data));
      },
    });
    try {
      // La fecha del archivo en la URL hace que un cambio en la función se cargue sin reiniciar.
      const { default: handler } = await import(`${pathToFileURL(file).href}?v=${statSync(file).mtimeMs}`);
      await handler(Object.assign(req, { body }), reply);
    } catch (error) {
      console.error(error);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: "function crashed" }));
    }
  };
  return {
    name: "local-api",
    configureServer: (server) => void server.middlewares.use(serve),
    configurePreviewServer: (server) => void server.middlewares.use(serve),
  };
}

export default defineConfig({
  root: "app",
  base: "./",
  build: { outDir: dist, emptyOutDir: true },
  plugins: [swPrecache(), localApi()],
  // Sin preempaquetar: en desarrollo el .wasm de onnxruntime-web se sirve junto a su .mjs.
  optimizeDeps: { exclude: ["onnxruntime-web"] },
});
