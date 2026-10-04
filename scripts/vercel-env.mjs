// Copia los secretos de .env al proyecto de Vercel (producción) sin mostrarlos en pantalla.
//   npm run secrets:push                 sube lo que haya en .env
//   npm run secrets:push -- --dry-run    solo comprueba el archivo, no sube nada
// Después hay que volver a desplegar para que surtan efecto: npx vercel deploy --prod
import { spawnSync } from "node:child_process";
import { readEnvFile } from "./env-file.mjs";

// Formato habitual de cada valor. Si no coincide se avisa, pero se sube igual.
const KNOWN = {
  TWILIO_ACCOUNT_SID: /^AC[0-9a-f]{32}$/i,
  TWILIO_AUTH_TOKEN: /^[0-9a-f]{32}$/i,
  TWILIO_API_KEY: /^SK[0-9a-f]{32}$/i,
  TWILIO_API_SECRET: /^\S{20,}$/,
  TWILIO_FROM: /^(\+\d{8,15}|MG[0-9a-f]{32})$/i,
  TECH_NUMBER: /^\+\d{8,15}$/,
  SMS_GATEWAY_USER: /^\S+$/,
  SMS_GATEWAY_PASSWORD: /^\S+$/,
  SMS_GATEWAY_URL: /^https?:\/\/\S+$/,
  OLLAMA_URL: /^https?:\/\/\S+$/,
  OLLAMA_MODEL: /^\S+$/,
  GATEWAY_URL: /^https?:\/\/\S+$/,
  GATEWAY_TOKEN: /^\S+$/,
  AI_GATEWAY_MODEL: /^\S+$/,
};

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const file = args.find((arg) => !arg.startsWith("--")) ?? ".env";
const values = readEnvFile(file);
const present = Object.keys(KNOWN).filter((name) => values[name]);

if (present.length === 0) {
  console.log(`No hay valores que subir en ${file}.`);
  process.exit(1);
}

let failed = false;
for (const name of present) {
  const note = KNOWN[name].test(values[name]) ? "" : " (formato inesperado, revísalo)";
  if (dryRun) {
    console.log(`${name}: presente${note}`);
    continue;
  }
  // El valor entra por stdin: no aparece en la línea de comandos ni en la salida.
  const result = spawnSync(`npx vercel env add ${name} production --force --sensitive --yes`, {
    input: values[name],
    shell: true,
    encoding: "utf8",
  });
  const ok = result.status === 0;
  failed ||= !ok;
  console.log(`${name}: ${ok ? "subido" : "ERROR"}${note}`);
  if (!ok) {
    const lines = `${result.stdout}\n${result.stderr}`.split("\n");
    console.log(lines.filter((line) => /error/i.test(line) && !line.includes(values[name])).join("\n"));
  }
}

const has = (name) => Boolean(values[name]);
if (present.some((name) => name.startsWith("TWILIO_"))) {
  const missing = [
    !has("TWILIO_ACCOUNT_SID") && "TWILIO_ACCOUNT_SID",
    !(has("TWILIO_AUTH_TOKEN") || (has("TWILIO_API_KEY") && has("TWILIO_API_SECRET"))) &&
      "TWILIO_AUTH_TOKEN (o TWILIO_API_KEY + TWILIO_API_SECRET)",
    !has("TWILIO_FROM") && "TWILIO_FROM",
  ].filter(Boolean);
  if (missing.length) console.log(`Para enviar con Twilio falta: ${missing.join(", ")}`);
}
if (!has("TECH_NUMBER")) console.log("Falta TECH_NUMBER: el número del técnico, como +50370000000.");

if (failed) process.exit(1);
console.log(dryRun ? "Comprobación terminada; no se subió nada." : "Listo. Para que surtan efecto: npx vercel deploy --prod");
