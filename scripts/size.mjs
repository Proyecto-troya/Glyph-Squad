// Mide lo que se descarga al teléfono (dist/) contra la meta de 20 MB.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const LIMIT_MB = 20;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const groups = {};
let total = 0;
for (const path of walk("dist")) {
  const size = statSync(path).size;
  const group = path.split(/[\\/]/)[1];
  groups[group] = (groups[group] ?? 0) + size;
  total += size;
}
const mb = (bytes) => (bytes / 1024 / 1024).toFixed(2).padStart(7) + " MB";
for (const [group, size] of Object.entries(groups).sort((a, b) => b[1] - a[1])) {
  console.log(mb(size), group);
}
console.log(mb(total), "TOTAL", total / 1024 / 1024 < LIMIT_MB ? "(dentro de la meta)" : `(supera ${LIMIT_MB} MB)`);
