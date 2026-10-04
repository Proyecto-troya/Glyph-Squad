// Comprueba las credenciales de Twilio de .env con llamadas de solo lectura:
// no envía ningún SMS y no muestra secretos ni números completos.
//   npm run secrets:check
import { readEnvFile } from "./env-file.mjs";

const env = readEnvFile(process.argv[2] ?? ".env");
const sid = env.TWILIO_ACCOUNT_SID ?? "";
const token = env.TWILIO_AUTH_TOKEN ?? "";
const api = `https://api.twilio.com/2010-04-01/Accounts/${sid}`;
// Los mensajes de error de Twilio repiten identificadores: se recortan antes de mostrarlos.
const clean = (text) => String(text ?? "").replace(/\b(AC|SK|MG)[0-9a-f]{32}\b/gi, "$1…");

async function get(url, user, password) {
  try {
    const response = await fetch(url, {
      headers: { Authorization: "Basic " + Buffer.from(`${user}:${password}`).toString("base64") },
      signal: AbortSignal.timeout(15_000),
    });
    return { http: response.status, body: await response.json().catch(() => ({})) };
  } catch (error) {
    return { http: 0, body: { message: error.message } };
  }
}

function stop(message) {
  console.log(`NO SIRVE TODAVÍA: ${message}`);
  process.exit(1);
}

// Errores de pegado frecuentes, antes de preguntar a Twilio.
if (!/^AC[0-9a-f]{32}$/i.test(sid)) stop("TWILIO_ACCOUNT_SID debe empezar por AC y tener 34 caracteres.");
if (token && token === sid) stop("en TWILIO_AUTH_TOKEN está pegado el Account SID. El Auth Token es otro valor, de 32 caracteres.");
if (token.startsWith("SK")) stop("en TWILIO_AUTH_TOKEN hay una API Key (SK...). Va en TWILIO_API_KEY, con su secreto en TWILIO_API_SECRET.");

// La misma elección que hace api/send.js.
const useKey = env.TWILIO_API_KEY && env.TWILIO_API_SECRET;
const [user, password] = useKey ? [env.TWILIO_API_KEY, env.TWILIO_API_SECRET] : [sid, token];
if (!password) stop("falta TWILIO_AUTH_TOKEN, o bien TWILIO_API_SECRET junto a TWILIO_API_KEY.");

// Listar un mensaje prueba la autenticación sin enviar nada.
const auth = await get(`${api}/Messages.json?PageSize=1`, user, password);
if (auth.http !== 200) stop(`Twilio rechaza las credenciales (HTTP ${auth.http}: ${clean(auth.body.message)}).`);
console.log(`Autenticación: correcta (${useKey ? "API Key" : "Auth Token"}).`);

const account = await get(`${api}.json`, user, password);
const trial = account.body.type === "Trial";
if (account.http === 200) console.log(`Cuenta: ${account.body.status}, tipo ${account.body.type}.`);

const from = env.TWILIO_FROM ?? "";
let fromOk = /^MG[0-9a-f]{32}$/i.test(from);
if (from.startsWith("+")) {
  const owned = await get(`${api}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(from)}`, user, password);
  const number = owned.body.incoming_phone_numbers?.[0];
  fromOk = Boolean(number?.capabilities?.sms);
  console.log(
    `TWILIO_FROM (${from.slice(0, 3)}…): ${number ? (fromOk ? "es un número de la cuenta y puede enviar SMS." : "es de la cuenta, pero no puede enviar SMS.") : "NO es un número de esta cuenta de Twilio."}`,
  );
} else {
  console.log(`TWILIO_FROM: ${fromOk ? "Messaging Service." : "debe ser el número de Twilio (+1...) o un Messaging Service (MG...)."}`);
}

const to = env.TECH_NUMBER ?? "";
let toOk = /^\+\d{8,15}$/.test(to);
if (!toOk) {
  console.log("TECH_NUMBER: debe ser el número que recibe, con prefijo de país, como +50370000000.");
} else if (trial) {
  // Una cuenta de prueba solo puede escribir a números verificados.
  const verified = await get(`${api}/OutgoingCallerIds.json?PhoneNumber=${encodeURIComponent(to)}`, user, password);
  toOk = (verified.body.outgoing_caller_ids?.length ?? 0) > 0;
  console.log(`TECH_NUMBER (${to.slice(0, 4)}…): ${toOk ? "verificado en Twilio." : "NO está verificado en Twilio; la cuenta de prueba no podrá escribirle."}`);
}

if (!fromOk || !toOk) stop("revisa los números de arriba.");
console.log("Listo para enviar. Twilio aún puede rechazar el país de destino si no está permitido en la cuenta.");
