// Reglas compartidas por las funciones de /api. El servidor vuelve a validar todo:
// no se fía de lo que manda la app.

export const SMS_MAX_LENGTH = 160;
const CODE = /^LP [A-Z0-9]{1,8} \d{1,3}H( (ROYA|MIN|CER|PHO|DUDA)[1-9]\d{0,2})*( E15\+)?$/;
const BANNED = /dosis|fungicida|aplic|tratamiento|rendimiento|precio|\bkg\b|litro/i;

export function isCode(code) {
  return typeof code === "string" && CODE.test(code);
}

/** Frase válida para ir debajo del código: una línea ASCII, sin otro código, y que quepa en el SMS. */
export function isSentence(code, text) {
  return (
    typeof text === "string" &&
    /^[\x20-\x7E]+$/.test(text) &&
    !text.toUpperCase().includes("LP ") &&
    !BANNED.test(text) &&
    code.length + 1 + text.length <= SMS_MAX_LENGTH
  );
}

function isCounts(c) {
  const keys = ["total", "sana", "roya", "minador", "cercospora", "phoma", "duda"];
  return (
    c && keys.every((k) => Number.isInteger(c[k]) && c[k] >= 0) && c.total > 0 && c.total <= 999 &&
    c.sana + c.roya + c.minador + c.cercospora + c.phoma + c.duda === c.total
  );
}

export function isSmsRequest(body) {
  return (
    body && typeof body.plot === "string" && /^[A-Z0-9]{1,8}$/.test(body.plot) &&
    isCounts(body.counts) && typeof body.over15 === "boolean" && isCode(body.code)
  );
}

/** Frase de plantilla fija: lo que se usa si no hay LLM o si el LLM falla la validación. */
export function templateSentence({ plot, counts, over15, code }) {
  const parts = [
    counts.roya && `${counts.roya} con roya`,
    counts.minador && `${counts.minador} con minador`,
    counts.cercospora && `${counts.cercospora} con cercospora`,
    counts.phoma && `${counts.phoma} con phoma`,
    counts.duda && `${counts.duda} dudosas`,
  ].filter(Boolean);
  const base = parts.length
    ? `Parcela ${plot}: de ${counts.total} hojas, ${parts.join(", ")}.`
    : `Parcela ${plot}: ${counts.total} hojas revisadas, sin senales de enfermedad.`;
  const withAge = over15 ? `${base} Plantas de mas de 15 anos.` : base;
  return isSentence(code, withAge) ? withAge : base;
}

/** La frase del LLM solo vale si no inventa cifras ni se calla un conteo. */
export function numbersMatch(text, { plot, counts }) {
  const allowed = new Set([...Object.values(counts).map(String), "15"]);
  const found = (text.replace(plot, "").match(/\d+/g) ?? []);
  const required = ["roya", "minador", "cercospora", "phoma", "duda"].filter((k) => counts[k] > 0).map((k) => String(counts[k]));
  return found.every((n) => allowed.has(n)) && required.every((n) => found.includes(n));
}

export function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body ?? "");
  } catch {
    return null;
  }
}
