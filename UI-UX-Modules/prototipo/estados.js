// Prototipo de Leaf Plate (versión 3): reproduce el DOM de app/src/ui/*.ts (rama leaf-plate)
// con las mismas clases y añade los componentes nuevos de la dirección "instrumento + visor"
// (ver ../COMPONENTES.md) y usa el set de iconos 1B3 de ../assets. No clasifica fotos: la cámara devuelve resultados de ejemplo y
// las fotos son ilustraciones de muestras/. El estado inicial se elige con ?estado=<id>.
// Script clásico (no módulo) para que funcione abriendo el archivo con doble clic.

// ---------- Datos copiados de la app ----------

const CATALOG = {
  quzLabel: "Quechua: traducción automática y voz sintética, sin validar por hablante",
  messages: {
    M01: { es: "No vimos hojas enfermas en las {total} hojas.", quz: "{total} raphikunapi manam unqusqa raphita rikuykuchu." },
    M02: { es: "Roya: {n} de {total} hojas.", quz: "Roya: {total} raphimanta {n}." },
    M03: { es: "Minador: {n} de {total} hojas.", quz: "Minador: {total} raphimanta {n}." },
    M04: { es: "Cercospora: {n} de {total} hojas.", quz: "Cercospora: {total} raphimanta {n}." },
    M05: { es: "Phoma: {n} de {total} hojas.", quz: "Phoma: {total} raphimanta {n}." },
    M06: { es: "No estoy seguro de muchas hojas. El técnico debería verlas.", quz: "Achka raphimanta manam segurochu kani. Técnico qhawananmi." },
    M07: { es: "La foto no salió bien. Pon una sola hoja sobre el plato, con luz, y repite la foto.", quz: "Fotoqa manam allinchu lluqsirqan. Huk raphillata platoman churay, k'anchaypi, hukmanta fotota hurquy." },
    M08: { es: "Esto no es un diagnóstico. Envía el mensaje al técnico de la cooperativa; él decide.", quz: "Kayqa manam diagnósticochu. Cooperativapi técnicoman willakuyta apachiy; paymi decidinqa." },
  },
};

// models/calibration.json de la rama leaf-plate: con este umbral lo aceptado tiene 90 % de precisión.
const CALIBRATION = { threshold: 0.6057, model: "MobileNetV3" };
// photoQuality.ts: QUALITY_DEFAULTS.
const QUALITY = { minSharpness: 40, minBrightness: 50, maxBrightness: 240 };

// Iconos del set 1B3 (assets/iconos/), generados desde los SVG: no editar a mano.
const PATHS = {
  "alert": "<path d=\"M12 3L21 20H3L12 3ZM12 9V13\"/><circle cx=\"12\" cy=\"16.5\" r=\"0.6\" fill=\"currentColor\"/>",
  "arrow": "<path d=\"M3 12H21M14 5L21 12L14 19\"/>",
  "camera": "<path d=\"M4 7H7L9 4H15L17 7H20Q21 7 21 9V18Q21 20 19 20H5Q3 20 3 18V9Q3 7 4 7Z\"/><circle cx=\"12\" cy=\"13.5\" r=\"3.5\"/>",
  "chart": "<path d=\"M3 3V21H21\"/><rect x=\"6\" y=\"12\" width=\"3\" height=\"6\" rx=\"2\"/><rect x=\"12\" y=\"8\" width=\"3\" height=\"10\" rx=\"2\"/><rect x=\"18\" y=\"4\" width=\"3\" height=\"14\" rx=\"2\"/>",
  "check": "<path d=\"M4 12L9 18L20 6\"/>",
  "cooperative": "<circle cx=\"12\" cy=\"6\" r=\"2.5\"/><circle cx=\"5\" cy=\"10\" r=\"2\"/><circle cx=\"19\" cy=\"10\" r=\"2\"/><path d=\"M8 21V17Q8 12 12 12Q16 12 16 17V21ZM3 21V18Q3 15 6 15M21 21V18Q21 15 18 15\"/>",
  "copy": "<rect x=\"8\" y=\"8\" width=\"13\" height=\"13\" rx=\"2\"/><path d=\"M16 5V3H5Q3 3 3 5V16H5\"/>",
  "focus": "<path d=\"M3 8V5Q3 3 5 3H8M16 3H19Q21 3 21 5V8M21 16V19Q21 21 19 21H16M8 21H5Q3 21 3 19V16\"/><circle cx=\"12\" cy=\"12\" r=\"2\"/>",
  "leaf": "<path d=\"M19 3C13 3 5 6 5 13C5 17 8 19 12 19C19 19 20 10 19 3ZM4 21L14 9\"/>",
  "list": "<rect x=\"5\" y=\"4\" width=\"14\" height=\"17\" rx=\"2\"/><rect x=\"9\" y=\"3\" width=\"6\" height=\"3\" rx=\"2\"/><path d=\"M9 11H15M9 16H15\"/>",
  "local-ai": "<rect x=\"6\" y=\"6\" width=\"12\" height=\"12\" rx=\"2\"/><path d=\"M9 3V6M15 3V6M9 18V21M15 18V21M3 9H6M3 15H6M18 9H21M18 15H21M15 9C11 9 9 11 9 13C9 16 15 16 15 9ZM10 14L13 11\"/>",
  "message": "<path d=\"M5 4H19Q21 4 21 6V15Q21 17 19 17H10L5 21V17Q3 17 3 15V6Q3 4 5 4Z\"/><path d=\"M8 9H16M8 13H13\"/>",
  "offline": "<path d=\"M7 17H6A4 4 0 0 1 6 9A6 6 0 0 1 17 8A4.5 4.5 0 0 1 19 17H13M3 3L21 21\"/>",
  "plant-age": "<path d=\"M11 21V13M13 21V13M3 21H21M12 14C7 14 4 11 4 7C9 7 12 10 12 14ZM12 11C12 6 15 3 20 3C20 8 17 11 12 11Z\"/>",
  "plate": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><circle cx=\"12\" cy=\"12\" r=\"6\"/><path d=\"M12 3V5M12 19V21M3 12H5M19 12H21\"/>",
  "plus": "<path d=\"M12 4V20M4 12H20\"/>",
  "refresh": "<path d=\"M20 9A8 8 0 0 0 6 6L3 9M3 4V9H8M4 15A8 8 0 0 0 18 18L21 15M21 20V15H16\"/>",
  "scan": "<path d=\"M3 7V3H7M17 3H21V7M21 17V21H17M7 21H3V17M12 6C10 9 7 10 7 13C7 16 9 18 12 18C15 18 17 16 17 13C17 10 14 9 12 6ZM10 15L14 10\"/>",
  "send": "<path d=\"M3 5L21 3L16 21L11 13L3 5ZM11 13L21 3\"/>",
  "sun": "<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 3V5M12 19V21M3 12H5M19 12H21M5.6 5.6L7 7M17 17L18.4 18.4M5.6 18.4L7 17M17 7L18.4 5.6\"/>",
  "technician": "<circle cx=\"8\" cy=\"7\" r=\"3\"/><path d=\"M3 21V18Q3 13 8 13Q11 13 12 15\"/><rect x=\"14\" y=\"11\" width=\"7\" height=\"10\" rx=\"2\"/><path d=\"M16.5 15H18.5M16.5 18H18.5\"/>",
  "undo": "<path d=\"M9 4L3 10L9 16M3 10H14Q21 10 21 15Q21 20 15 20H12\"/>",
  "upload": "<path d=\"M12 16V3M7 8L12 3L17 8M3 15V19Q3 21 5 21H19Q21 21 21 19V15\"/>",
  "volume": "<path d=\"M3 9H7L12 5V19L7 15H3ZM16 8Q20 12 16 16M18.5 5Q23.5 12 18.5 19\"/>",
  "class-cercospora": "<path d=\"M12 3C10 6 5 8 5 13C5 17 8 20 12 21C16 20 19 17 19 13C19 8 14 6 12 3Z\"/><circle cx=\"12\" cy=\"13.5\" r=\"4\"/><circle cx=\"12\" cy=\"13.5\" r=\"1.5\"/>",
  "class-duda": "<path d=\"M12 3C10 6 5 8 5 13C5 17 8 20 12 21C16 20 19 17 19 13C19 8 14 6 12 3Z\" stroke-dasharray=\"2 3\"/><path d=\"M9.5 11C9.5 7.7 14.5 7.7 14.5 11C14.5 13 12 13 12 15\"/><circle cx=\"12\" cy=\"18\" r=\"0.6\" fill=\"currentColor\"/>",
  "class-minador": "<path d=\"M12 3C10 6 5 8 5 13C5 17 8 20 12 21C16 20 19 17 19 13C19 8 14 6 12 3Z\"/><path d=\"M9 9C15 8 15 11 11 12C7 13 9 16 14 15C17 15 15 18 12 18\"/>",
  "class-phoma": "<path d=\"M12 3C10 6 5 8 5 13C5 17 8 20 12 21C16 20 19 17 19 13C19 8 14 6 12 3Z\"/><path d=\"M12 3C11 4.5 10 5.8 8.5 7L10 8L12 7L14 8L15.5 7C14 5.8 13 4.5 12 3Z\" fill=\"currentColor\"/><path d=\"M12 11V18\"/>",
  "class-roya": "<path d=\"M12 3C10 6 5 8 5 13C5 17 8 20 12 21C16 20 19 17 19 13C19 8 14 6 12 3Z\"/><circle cx=\"9\" cy=\"11\" r=\"1\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"12\" cy=\"10\" r=\"1\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"15\" cy=\"11\" r=\"1\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"9.5\" cy=\"14\" r=\"1\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"13\" cy=\"13.5\" r=\"1\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"12\" cy=\"17\" r=\"1\" fill=\"currentColor\" stroke=\"none\"/>",
  "class-sana": "<path d=\"M12 3C10 6 5 8 5 13C5 17 8 20 12 21C16 20 19 17 19 13C19 8 14 6 12 3Z\"/><path d=\"M12 7V18M8.5 11L12 14L15.5 11M9 15L12 17L15 15\"/>",
};
// Marca en un color (assets/marca/logo-marca-mono.svg), viewBox 0 0 64 64.
const BRAND_MONO = "<path d=\"M32 4a28 28 0 1 1 0 56a28 28 0 1 1 0 -56ZM32 6.5a25.5 25.5 0 1 1 0 51a25.5 25.5 0 1 1 0 -51ZM32 9a23 23 0 1 1 0 46a23 23 0 1 1 0 -46ZM32 10a22 22 0 1 1 0 44a22 22 0 1 1 0 -44Z\" fill=\"currentColor\" fill-rule=\"evenodd\"/><path d=\"M30.7 4H33.3V9H30.7ZM30.7 55H33.3V60H30.7ZM4 30.7H9V33.3H4ZM55 30.7H60V33.3H55Z\" fill=\"currentColor\"/><path d=\"M32 11C29 18 18 23 18 34C18 43 26 46 30.5 50.5L30.5 53C30.5 55 33.5 55 33.5 53L33.5 50.5C38 46 46 43 46 34C46 23 35 18 32 11ZM32 28C26 29 24 33 24.5 38C25 43 28 46 31 48C29 43 29.3 39 31.2 35.5C32.5 33 32.8 30.5 32 28ZM34 28.8C39 31 40.5 35.5 38.8 40.3C37.5 44 34.7 46.5 32.8 47.8C34.3 43.6 33.9 40.9 33.3 38.3C32.4 34.5 35 32.2 34 28.8Z\" fill=\"currentColor\" fill-rule=\"evenodd\"/>";

const LABEL_NAMES = { sana: "Sana", roya: "Roya", minador: "Minador", cercospora: "Cercospora", phoma: "Phoma", duda: "No estoy seguro" };
const LEAF_LABELS = ["sana", "roya", "minador", "cercospora", "phoma"];
const SICK_LABELS = ["roya", "minador", "cercospora", "phoma"];
const SICK_MESSAGE = { roya: "M02", minador: "M03", cercospora: "M04", phoma: "M05" };
const TARGET_LEAVES = 30;
const LEAVES_PER_PLANT = 3;
const UNSURE_LIMIT = 0.2;
const TOKENS = [["ROYA", "roya"], ["MIN", "minador"], ["CER", "cercospora"], ["PHO", "phoma"], ["DUDA", "duda"]];
const EXAMPLES = ["LP P114 30H ROYA7 CER1 DUDA2 E15+", "LP P027 30H", "LP P203 28H ROYA15 MIN3", "LP P088 30H PHO1 DUDA9"].join("\n");

// ---------- dom.ts / icons.ts ----------

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  const { class: className, dataset, ...rest } = props;
  if (className) node.className = className;
  if (dataset) Object.assign(node.dataset, dataset);
  Object.assign(node, rest);
  for (const child of children) {
    if (child === null || child === false || child === undefined) continue;
    node.append(child);
  }
  return node;
}

function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = PATHS[name];
  return svg;
}

const pct = (x) => `${Math.round(x * 100)} %`;

/** Icono de la clase (assets/iconos/clases/): la forma dice la clase, el color la refuerza. */
function classIcon(label) {
  const svg = icon(`class-${label}`);
  svg.setAttribute("class", "icon class-icon");
  return svg;
}

/** Marca en un color para la barra superior. */
function brandLogo() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 64 64");
  svg.setAttribute("class", "brand-logo");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = BRAND_MONO;
  return svg;
}

const ASSETS = "../assets";

function listenButton(lang) {
  const button = el("button", { class: "listen", type: "button" }, icon("volume"), lang === "es" ? "Español" : "Quechua");
  if (app.audioFails) button.textContent = "Audio no disponible";
  return button;
}

function emptyState(title, iconName, goToSample) {
  const start = el("button", { class: "primary", type: "button" }, "Ir a Muestra", icon("arrow"));
  start.onclick = goToSample;
  return el("div", { class: "empty" }, el("div", { class: "hero" }, icon(iconName)), el("h1", {}, title), el("p", {}, "Todavía no hay hojas en la muestra."), start);
}

function renderMessage(ref, lang) {
  return CATALOG.messages[ref.id][lang].replace("{n}", String(ref.n ?? "")).replace("{total}", String(ref.total ?? ""));
}

function messageCard(ref) {
  return el(
    "div",
    { class: "message" },
    el("p", { class: "es" }, renderMessage(ref, "es")),
    el("p", { class: "quz", lang: "qu" }, renderMessage(ref, "quz")),
    el("p", { class: "quz-label" }, CATALOG.quzLabel),
    el("div", { class: "row" }, listenButton("es"), listenButton("quz")),
  );
}

// ---------- domain ----------

function normalizePlot(raw) {
  const plot = raw.trim().toUpperCase();
  return /^[A-Z0-9]{1,8}$/.test(plot) ? plot : null;
}
function emptyCounts() { return { total: 0, sana: 0, roya: 0, minador: 0, cercospora: 0, phoma: 0, duda: 0 }; }
function countLeaves(leaves) {
  const c = emptyCounts();
  for (const leaf of leaves) { if (leaf.quality !== "ok") continue; c.total += 1; c[leaf.label] += 1; }
  return c;
}
function sickCount(c) { return c.roya + c.minador + c.cercospora + c.phoma; }
function sickPct(c) { return c.total === 0 ? 0 : (sickCount(c) / c.total) * 100; }
function tooManyUnsure(c) { return c.total > 0 && c.duda / c.total > UNSURE_LIMIT; }
function chooseMessages(c) {
  if (c.total === 0) return [];
  const refs = [];
  const sick = SICK_LABELS.filter((l) => c[l] > 0).sort((a, b) => c[b] - c[a]);
  if (sick.length === 0) refs.push({ id: "M01", total: c.total });
  else for (const l of sick) refs.push({ id: SICK_MESSAGE[l], n: c[l], total: c.total });
  if (tooManyUnsure(c)) refs.push({ id: "M06" });
  refs.push({ id: "M08" });
  return refs;
}
function encodeSms(plot, c, over15) {
  const parts = ["LP", plot, `${c.total}H`];
  for (const [token, key] of TOKENS) if (c[key] > 0) parts.push(`${token}${c[key]}`);
  if (over15 === true) parts.push("E15+");
  return parts.join(" ");
}
function decodeSms(text) {
  const parts = text.trim().toUpperCase().split(/\s+/);
  if (parts.length < 3 || parts[0] !== "LP") return null;
  const plot = normalizePlot(parts[1]);
  const totalMatch = /^(\d{1,3})H$/.exec(parts[2]);
  if (!plot || !totalMatch) return null;
  const counts = emptyCounts();
  counts.total = Number(totalMatch[1]);
  let over15 = false;
  const seen = new Set();
  for (const part of parts.slice(3)) {
    if (seen.has(part.replace(/\d+$/, ""))) return null;
    seen.add(part.replace(/\d+$/, ""));
    if (part === "E15+") { over15 = true; continue; }
    const match = /^([A-Z]+)(\d{1,3})$/.exec(part);
    const token = match && TOKENS.find(([name]) => name === match[1]);
    if (!match || !token || Number(match[2]) === 0) return null;
    counts[token[1]] = Number(match[2]);
  }
  const named = counts.roya + counts.minador + counts.cercospora + counts.phoma + counts.duda;
  if (counts.total === 0 || named > counts.total) return null;
  counts.sana = counts.total - named;
  return { plot, counts, over15 };
}
function parseCodes(text) {
  const payloads = [];
  const invalid = [];
  let afterCode = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const start = line.toUpperCase().indexOf("LP ");
    const payload = start >= 0 ? decodeSms(line.slice(start)) : null;
    if (payload) payloads.push(payload);
    else if (!afterCode) invalid.push(line);
    afterCode = payload !== null;
  }
  return { payloads, invalid };
}
function rankPlots(payloads) {
  const byPlot = new Map();
  for (const p of payloads) byPlot.set(p.plot, { plot: p.plot, sickPct: sickPct(p.counts), counts: p.counts, over15: p.over15, flagUnsure: tooManyUnsure(p.counts) });
  return [...byPlot.values()].sort((a, b) => b.sickPct - a.sickPct || Number(b.flagUnsure) - Number(a.flagUnsure) || Number(b.over15) - Number(a.over15) || a.plot.localeCompare(b.plot));
}

// ---------- Componentes nuevos (COMPONENTES.md) ----------

/** Mapa de la muestra: 10 plantas × 3 hojas; cada hoja con el color de su clase. */
function sampleMap(leaves, { fresh = false } = {}) {
  const c = countLeaves(leaves);
  const parts = [...LEAF_LABELS, "duda"].filter((l) => c[l] > 0).map((l) => `${c[l]} ${LABEL_NAMES[l].toLowerCase()}`);
  const map = el("div", { class: fresh ? "sample-map fresh" : "sample-map", role: "img" });
  map.setAttribute("aria-label", `${c.total} de ${TARGET_LEAVES} hojas${parts.length ? `: ${parts.join(", ")}` : ""}`);
  for (let p = 0; p < TARGET_LEAVES / LEAVES_PER_PLANT; p++) {
    const plant = el("div", { class: "plant" });
    for (let b = 0; b < LEAVES_PER_PLANT; b++) {
      const i = p * LEAVES_PER_PLANT + b;
      const leaf = leaves[i];
      let cls = "leaf";
      if (leaf) cls += ` tone-${leaf.label}${i === leaves.length - 1 ? " latest" : ""}`;
      else if (i === leaves.length) cls += " next";
      plant.append(el("span", { class: cls }));
    }
    map.append(plant);
  }
  return map;
}

const STEPS = [
  { name: "Nitidez", fails: ["borrosa"], value: (q) => `${q.sharpness >= QUALITY.minSharpness ? "nítida" : "movida"} · ${q.sharpness}` },
  {
    name: "Luz",
    fails: ["oscura", "quemada"],
    value: (q) => `${q.brightness < QUALITY.minBrightness ? "oscura" : q.brightness > QUALITY.maxBrightness ? "quemada" : "buena"} · ${q.brightness}`,
  },
  { name: "Hoja en el plato", fails: ["sin_hoja", "sin_plato"], value: (q) => `${Math.round(q.leafArea * 100)} % del plato` },
  { name: "Clasificación", fails: [], value: (q, seconds) => (seconds ? `${seconds.toFixed(1)} s` : "en el teléfono") },
];

/** Estado de cada paso: done | active | pending | fail. */
function stepStates(shot) {
  if (shot.step !== undefined) return STEPS.map((_, i) => (i < shot.step ? "done" : i === shot.step ? "active" : "pending"));
  const failAt = STEPS.findIndex((s) => s.fails.includes(shot.quality.reason));
  return STEPS.map((_, i) => (failAt < 0 ? "done" : i < failAt ? "done" : i === failAt ? "fail" : "pending"));
}

function scanSteps(shot) {
  const states = stepStates(shot);
  return el(
    "ol",
    { class: "scan-steps" },
    ...STEPS.map((s, i) =>
      el(
        "li",
        { class: "step", dataset: { state: states[i] } },
        el("span", { class: "step-name" }, s.name),
        el("span", { class: "step-value" }, states[i] === "pending" ? "" : s.value(shot.quality, states[i] === "done" ? shot.seconds : 0)),
      ),
    ),
  );
}

/** Medidor de confianza con la marca del umbral calibrado y la zona de duda. */
function meter(confidence) {
  const below = confidence < CALIBRATION.threshold;
  const fill = el("div", { class: "meter-fill" });
  fill.style.width = pct(confidence).replace(" ", "");
  const box = el(
    "div",
    { class: below ? "meter below" : "meter" },
    el("div", { class: "meter-head" }, el("span", {}, "Confianza"), el("strong", {}, String(Math.round(confidence * 100)), el("span", { class: "unit" }, "%"))),
    el("div", { class: "meter-track" }, fill, el("span", { class: "meter-threshold" })),
    el("p", { class: "meter-note" }, below ? `Bajo el umbral de ${pct(CALIBRATION.threshold)}: la app no nombra la hoja.` : `Umbral ${pct(CALIBRATION.threshold)}: por debajo, la app diría «No estoy seguro».`),
  );
  box.style.setProperty("--threshold", String(CALIBRATION.threshold));
  box.setAttribute("role", "meter");
  box.setAttribute("aria-valuenow", String(Math.round(confidence * 100)));
  box.setAttribute("aria-valuemin", "0");
  box.setAttribute("aria-valuemax", "100");
  box.setAttribute("aria-label", "Confianza del modelo");
  return box;
}

function alternatives(alts) {
  const list = el("ul", { class: "alternatives" });
  list.setAttribute("aria-label", "Clases más probables");
  list.append(
    ...alts.map(([label, p]) => {
      const bar = el("span", { class: "alt-fill" });
      bar.style.width = `${Math.max(2, p * 100)}%`;
      return el("li", { class: `alt tone-${label}` }, el("span", { class: "alt-name" }, LABEL_NAMES[label]), el("span", { class: "alt-bar" }, bar), el("span", { class: "alt-pct" }, pct(p)));
    }),
  );
  return list;
}

/** Visor de análisis: la foto con su encuadre, los pasos reales y el resultado. */
function scanCard(shot, { fresh = false } = {}) {
  const working = shot.step !== undefined;
  const retry = !working && shot.leaf.quality === "repetir";
  const state = working ? "working" : retry ? "retry" : "done";
  const label = working || retry ? null : shot.leaf.label;

  const photo = el("img", { class: "scan-photo", src: shot.photo, alt: "Foto de la hoja" });
  if (shot.dim) photo.style.filter = "brightness(.42)";
  const frame = el("div", { class: label ? `scan-frame tone-${label}` : "scan-frame" }, photo, working ? el("span", { class: "scan-line" }) : null);

  const card = el("section", { class: fresh ? "scan fresh" : "scan", dataset: { state } });
  card.setAttribute("aria-live", "polite");
  card.append(el("div", { class: "scan-top" }, frame, scanSteps(shot)));

  if (retry) {
    card.append(
      el("h2", { class: "scan-title" }, "Repite la foto"),
      messageCard({ id: "M07" }),
      el(
        "figure",
        { class: "scan-guide" },
        el("img", { src: `${ASSETS}/ilustraciones/guia-foto-correcta.svg`, alt: "Una hoja sola, centrada en un plato blanco, con buena luz" }),
        el("figcaption", {}, "Así: una hoja sola en el centro del plato, con luz pareja."),
      ),
    );
  } else if (!working) {
    const unsure = label === "duda";
    const parts = [
      el("div", { class: `result-head tone-${label}` }, classIcon(label), el("h2", {}, LABEL_NAMES[label])),
      meter(shot.leaf.confidence || shot.alts[0][1]),
      unsure && el("p", { class: "scan-say" }, "La hoja se cuenta como duda para que la vea el técnico."),
      el("p", { class: "scan-label" }, unsure ? "Lo que el modelo alcanzó a ver" : "Otras clases que consideró"),
      alternatives(unsure ? shot.alts : shot.alts.slice(1)),
    ];
    card.append(...parts.filter(Boolean));
  }
  card.append(el("p", { class: "scan-meta" }, `${CALIBRATION.model} · sin internet`));
  return card;
}

// ---------- Pantallas ----------

// Resultados que devuelve la cámara de mentira, en este orden.
const FAKE_SHOTS = [
  { leaf: { label: "roya", confidence: 0.87, quality: "ok" }, photo: "muestras/hoja-roya.svg", quality: { sharpness: 182, brightness: 146, leafArea: 0.34 }, alts: [["roya", 0.87], ["cercospora", 0.08], ["sana", 0.03]], seconds: 1.2 },
  { leaf: { label: "sana", confidence: 0.93, quality: "ok" }, photo: "muestras/hoja-sana.svg", quality: { sharpness: 205, brightness: 152, leafArea: 0.36 }, alts: [["sana", 0.93], ["roya", 0.04], ["minador", 0.02]], seconds: 1.1 },
  { leaf: { label: "duda", confidence: 0.41, quality: "ok" }, photo: "muestras/hoja-roya.svg", quality: { sharpness: 96, brightness: 131, leafArea: 0.33 }, alts: [["roya", 0.41], ["phoma", 0.33], ["sana", 0.18]], seconds: 1.3 },
  { leaf: { label: "duda", confidence: 0, quality: "repetir" }, photo: "muestras/hoja-sana.svg", dim: true, quality: { sharpness: 150, brightness: 38, leafArea: 0.31, reason: "oscura" }, alts: [], seconds: 0.3 },
  { leaf: { label: "sana", confidence: 0.95, quality: "ok" }, photo: "muestras/hoja-sana.svg", quality: { sharpness: 214, brightness: 158, leafArea: 0.35 }, alts: [["sana", 0.95], ["phoma", 0.03], ["roya", 0.01]], seconds: 1.0 },
];
let shot = 0;
const STEP_MS = 380;

function renderMuestra(root) {
  if (!app.sample) { renderPlotForm(root); return; }
  const sample = app.sample;
  const done = sample.leaves.length >= TARGET_LEAVES;

  const input = el("input", { type: "file", accept: "image/*", hidden: true });
  input.setAttribute("capture", "environment");
  const shoot = el("button", { class: "primary big", type: "button", disabled: done || Boolean(app.scan) }, icon("camera"), "Foto de una hoja");
  const scanSlot = el("div", { class: "scan-slot" });

  shoot.onclick = () => {
    const next = FAKE_SHOTS[shot++ % FAKE_SHOTS.length];
    shoot.disabled = true;
    const working = { ...next, step: 0 };
    const draw = () => scanSlot.replaceChildren(scanCard(working));
    draw();
    // Los pasos avanzan en el mismo nodo, como haría la app al terminar cada medida.
    const tick = setInterval(() => {
      working.step += 1;
      if (next.quality.reason && STEPS[working.step - 1]?.fails.includes(next.quality.reason)) working.step = STEPS.length;
      if (working.step >= STEPS.length) {
        clearInterval(tick);
        app.last = next;
        app.fresh = true;
        const accepted = next.leaf.quality === "ok" && sample.leaves.length < TARGET_LEAVES;
        app.update(accepted ? { ...sample, leaves: [...sample.leaves, next.leaf] } : sample);
        return;
      }
      scanSlot.querySelector(".scan-steps").replaceWith(scanSteps(working));
    }, STEP_MS);
  };

  const undo = el("button", { type: "button", disabled: sample.leaves.length === 0 }, icon("undo"), "Quitar la última");
  undo.onclick = () => { app.last = null; app.update({ ...sample, leaves: sample.leaves.slice(0, -1) }); };
  const next = el("button", { class: "primary", type: "button", disabled: sample.leaves.length === 0 }, "Ver resultado", icon("arrow"));
  next.onclick = () => app.go("resultado");

  if (app.scan) scanSlot.append(scanCard(app.scan));
  else if (app.last) scanSlot.append(scanCard(app.last, { fresh: app.fresh }));

  root.append(
    el("h1", {}, `Parcela ${sample.plot}`),
    el(
      "section",
      { class: "card" },
      el("p", { class: "counter" }, el("strong", {}, String(sample.leaves.length)), `de ${TARGET_LEAVES} hojas`),
      sampleMap(sample.leaves, { fresh: app.fresh }),
      done
        ? el("p", { class: "done" }, icon("check"), "Muestra completa. Mira el resultado.")
        : el("p", { class: "hint" }, "Una hoja sola sobre un plato blanco, con luz. 3 hojas por planta, 10 plantas."),
    ),
    shoot,
    input,
    scanSlot,
    el("div", { class: "row" }, undo, next),
  );
  app.refs = { shoot };
}

function renderPlotForm(root) {
  const input = el("input", { type: "text", placeholder: "P114", maxLength: 8, autocapitalize: "characters" });
  const error = el("p", { class: "error" });
  const form = el(
    "form",
    {},
    el("div", { class: "intro" }, el("img", { class: "brand-hero", src: `${ASSETS}/marca/logo-marca.svg`, alt: "" }), el("h1", {}, "Nueva muestra"), el("p", {}, `${TARGET_LEAVES} hojas de tu parcela, una foto por hoja.`)),
    el(
      "section",
      { class: "card" },
      el("label", {}, "Código de tu parcela (solo letras y números)", input),
      error,
      el("button", { class: "primary big", type: "submit" }, "Empezar", icon("arrow")),
    ),
    el(
      "ol",
      { class: "steps" },
      el("li", {}, "Pon una hoja sola sobre un plato blanco, con luz."),
      el("li", {}, "Toma la foto: 3 hojas por planta, 10 plantas."),
      el("li", {}, "Envía el código al técnico por SMS."),
    ),
    el(
      "figure",
      { class: "guide" },
      el("img", { src: `${ASSETS}/ilustraciones/muestreo-plantas.svg`, alt: "Diez plantas de la parcela y, en una, las ramas baja, media y alta" }),
      el("figcaption", {}, "10 plantas repartidas por la parcela. En cada una, una hoja de la rama baja, una de la media y una de la alta."),
    ),
  );
  form.onsubmit = (event) => {
    event.preventDefault();
    const plot = normalizePlot(input.value);
    if (!plot) { error.textContent = "Escribe el código de la parcela, por ejemplo P114."; return; }
    app.last = null;
    app.update({ plot, leaves: [], over15: null });
  };
  root.append(form);
  app.refs = { input, error };
}

function renderResultado(root) {
  const sample = app.sample;
  if (!sample || sample.leaves.length === 0) { root.append(emptyState("Resultado", "chart", () => app.go("muestra"))); return; }
  const counts = countLeaves(sample.leaves);

  const table = el("section", { class: "card counts" });
  table.append(
    sampleMap(sample.leaves),
    el("p", { class: "summary" }, el("strong", {}, `${sickCount(counts)} de ${counts.total}`), ` hojas con señales · ${Math.round(sickPct(counts))} %`),
  );
  for (const label of [...LEAF_LABELS, "duda"]) {
    if (counts[label] === 0) continue;
    const fill = el("div", { class: "bar-fill" });
    fill.style.width = `${(counts[label] / counts.total) * 100}%`;
    table.append(el("div", { class: `count-row tone-${label}` }, classIcon(label), el("span", { class: "count-name" }, LABEL_NAMES[label]), el("div", { class: "bar" }, fill), el("strong", {}, String(counts[label]))));
  }
  table.append(el("div", { class: "count-row total" }, el("span", { class: "count-name" }, "Hojas"), el("strong", {}, String(counts.total))));

  const yes = el("button", { type: "button", class: sample.over15 === true ? "chosen" : "" }, "Sí");
  const no = el("button", { type: "button", class: sample.over15 === false ? "chosen" : "" }, "No");
  yes.onclick = () => app.update({ ...sample, over15: true });
  no.onclick = () => app.update({ ...sample, over15: false });

  const next = el("button", { class: "primary big", type: "button", disabled: sample.over15 === null }, "Preparar mensaje", icon("arrow"));
  next.onclick = () => app.go("enviar");

  root.append(
    el("h1", {}, `Parcela ${sample.plot}`),
    table,
    ...chooseMessages(counts).map((ref) => messageCard(ref)),
    el("div", { class: "card" }, el("h2", {}, "¿Tus plantas tienen más de 15 años?"), el("div", { class: "row" }, yes, no)),
    next,
  );
}

/** Lo que significa cada pieza del código SMS. */
function codeParts(code) {
  const meaning = (part, i) => {
    if (i === 0) return "Leaf Plate";
    if (i === 1) return "parcela";
    if (i === 2) return "hojas";
    if (part === "E15+") return "plantas de más de 15 años";
    const match = /^([A-Z]+)(\d+)$/.exec(part);
    const token = match && TOKENS.find(([name]) => name === match[1]);
    if (!token) return "";
    return token[1] === "duda" ? `${match[2]} sin certeza` : `${match[2]} con ${token[1]}`;
  };
  return el("dl", { class: "code-parts" }, ...code.split(" ").map((part, i) => el("div", { class: "code-part" }, el("dt", {}, part), el("dd", {}, meaning(part, i)))));
}

function renderEnviar(root) {
  const sample = app.sample;
  if (!sample || sample.leaves.length === 0) { root.append(emptyState("Enviar", "send", () => app.go("muestra"))); return; }
  const code = encodeSms(sample.plot, countLeaves(sample.leaves), sample.over15);
  let sms = code;

  const link = el("a", { class: "button primary big" }, icon("message"), "Abrir SMS para el técnico");
  const codeBox = el("p", { class: "code" }, code);
  const sentenceBox = el("p", { class: "sentence" });
  const sentenceLabel = el("p", { class: "hint" });
  const setLink = () => { link.href = `sms:${app.techNumber.replace(/[^\d+]/g, "")}?body=${encodeURIComponent(sms)}`; };
  if (app.serviceEnabled) {
    sms = app.sentence ? `${code}\n${app.sentence}` : code;
    sentenceBox.textContent = app.sentence ?? "";
    sentenceLabel.textContent = app.sentence ? "Frase redactada por IA en la laptop. Léela antes de enviar." : "Sin frase de la laptop: el mensaje lleva solo el código.";
  }
  setLink();

  const number = el("input", { type: "tel", value: app.techNumber, placeholder: "Número del técnico" });
  number.oninput = () => { app.techNumber = number.value; setLink(); };
  const server = el("input", { type: "url", value: "", placeholder: "http://192.168.43.1:8000" });
  const retry = el("button", { type: "button" }, icon("refresh"), "Pedir la frase otra vez");

  const copy = el("button", { type: "button" }, icon("copy"), "Copiar mensaje");
  copy.onclick = async () => {
    try { await navigator.clipboard.writeText(sms); copy.textContent = "Copiado"; } catch { copy.textContent = "Cópialo a mano"; }
  };
  const restart = el("button", { type: "button" }, icon("plus"), "Empezar otra parcela");
  restart.onclick = () => { app.last = null; app.update(null); app.go("muestra"); };

  root.append(
    el("h1", {}, "Mensaje para el técnico"),
    messageCard({ id: "M08" }),
    el(
      "section",
      { class: "card" },
      el("h2", {}, "Tu mensaje"),
      codeBox,
      codeParts(code),
      sentenceBox,
      sentenceLabel,
      el("p", { class: "hint" }, "El mensaje lleva solo el código de parcela y los conteos. Las fotos no salen del teléfono."),
    ),
    el("label", {}, "Número del técnico", number),
    link,
    el("div", { class: "row" }, copy, restart),
  );
  if (app.serviceEnabled) {
    root.append(el("details", { open: app.detailsOpen }, el("summary", {}, "Laptop que redacta la frase"), el("label", {}, "Dirección del servidor (vacío = el mismo que sirve la app)", server), retry));
  }
}

function renderTecnico(root) {
  const text = el("textarea", { rows: 6, placeholder: "Pega aquí los códigos recibidos, uno por línea" });
  const file = el("input", { type: "file", accept: ".txt,.csv,text/plain", hidden: true });
  const upload = el("button", { type: "button" }, icon("upload"), "Subir archivo");
  upload.onclick = () => file.click();
  const output = el("div", {});

  const refresh = () => {
    output.replaceChildren();
    const { payloads, invalid } = parseCodes(text.value);
    const rows = rankPlots(payloads);
    if (rows.length > 0) {
      const table = el("table", { class: "ranking" }, el("tr", {}, ...["Parcela", "% enfermas", "Hojas", "Detalle", "Avisos"].map((h) => el("th", {}, h))));
      for (const row of rows) {
        const c = row.counts;
        const detail = [c.roya && `roya ${c.roya}`, c.minador && `minador ${c.minador}`, c.cercospora && `cercospora ${c.cercospora}`, c.phoma && `phoma ${c.phoma}`, c.duda && `duda ${c.duda}`].filter(Boolean);
        const flags = [row.over15 && "Plantas > 15 años", row.flagUnsure && "Muchas dudas"].filter(Boolean);
        const sev = el("span", { class: "sev-fill" });
        sev.style.width = `${row.sickPct}%`;
        table.append(
          el(
            "tr",
            {},
            el("td", {}, row.plot),
            el("td", {}, el("span", { class: "pill" }, `${Math.round(row.sickPct)} %`), el("span", { class: "sev" }, sev)),
            el("td", {}, String(c.total)),
            el("td", {}, detail.join(", ") || "sin enfermas"),
            el("td", {}, ...flags.map((flag) => el("span", { class: "chip" }, flag))),
          ),
        );
      }
      output.append(el("div", { class: "card scroll" }, table));
    }
    if (invalid.length > 0) {
      output.append(el("div", { class: "card warn" }, el("p", { class: "error" }, "Líneas que no se entienden:"), el("ul", { class: "invalid" }, ...invalid.map((line) => el("li", {}, line)))));
    }
  };

  text.oninput = refresh;
  file.onchange = async () => {
    const chosen = file.files?.[0];
    if (!chosen) return;
    text.value = [text.value.trim(), await chosen.text()].filter(Boolean).join("\n");
    refresh();
  };
  const examples = el("button", { type: "button" }, icon("list"), "Cargar ejemplos");
  examples.onclick = () => { text.value = EXAMPLES; refresh(); };

  root.append(
    el("h1", {}, "Lista del técnico"),
    el("p", { class: "hint" }, "Ordena las parcelas por % de hojas con señales. Son 30 hojas por parcela: a quién visitar lo decide el técnico."),
    text,
    el("div", { class: "row" }, upload, examples, file),
    output,
  );
  if (app.tecnicoText) { text.value = app.tecnicoText; refresh(); }
}

// ---------- Estados de ejemplo ----------

/** Hojas mezcladas de forma fija (siempre el mismo orden); `last` queda al final. */
function leaves(counts, last) {
  const list = [];
  for (const [label, n] of Object.entries(counts)) for (let i = 0; i < n; i++) list.push(label);
  let seed = 7;
  for (let i = list.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    const j = seed % (i + 1);
    [list[i], list[j]] = [list[j], list[i]];
  }
  if (last && list.includes(last)) { list.splice(list.lastIndexOf(last), 1); list.push(last); }
  return list.map((label) => ({ label, confidence: 0.9, quality: "ok" }));
}
const S = (counts, over15 = null, last) => ({ plot: "P114", leaves: leaves(counts, last), over15 });
const shotOf = (i) => FAKE_SHOTS[i];

const ESTADOS = {
  "a-formulario": { titulo: "A · Formulario de parcela", nota: "Sin muestra todavía.", route: "muestra", sample: null },
  "a-error": {
    titulo: "A · Código no válido", nota: "Error bajo el campo, con borde rojo.", route: "muestra", sample: null,
    after: () => { app.refs.input.value = "P-11 4"; app.refs.error.textContent = "Escribe el código de la parcela, por ejemplo P114."; },
  },
  "b-vacia": { titulo: "B · Muestra recién creada", nota: "El mapa marca dónde va la primera hoja.", route: "muestra", sample: S({}) },
  "b-analizando": {
    titulo: "B · Analizando", nota: "Visor: la foto, la línea de escaneo y los pasos reales del filtro y del modelo.", route: "muestra",
    sample: S({ sana: 8, roya: 3, duda: 1 }), scan: { ...FAKE_SHOTS[0], step: 2 },
  },
  "b-clasificada": { titulo: "B · Hoja clasificada", nota: "Confianza frente al umbral calibrado y otras clases consideradas.", route: "muestra", sample: S({ sana: 9, roya: 4 }, null, "roya"), last: shotOf(0) },
  "b-duda": { titulo: "B · No estoy seguro", nota: "Bajo el umbral: la app no nombra la hoja y lo explica.", route: "muestra", sample: S({ sana: 9, roya: 4, duda: 1 }, null, "duda"), last: shotOf(2) },
  "b-repetir": { titulo: "B · Repite la foto", nota: "El paso que falló dice por qué (luz: oscura).", route: "muestra", sample: S({ sana: 9, roya: 4, duda: 1 }), last: shotOf(3) },
  "b-completa": { titulo: "B · Muestra completa", nota: "La huella de la parcela: 10 plantas × 3 hojas por clase.", route: "muestra", sample: S({ sana: 20, roya: 7, cercospora: 1, duda: 2 }, null, "sana"), last: shotOf(4) },
  "c-resultado": { titulo: "C · Resultado sin responder", nota: "Huella de la muestra y resumen arriba del conteo.", route: "resultado", sample: S({ sana: 18, roya: 7, cercospora: 1, duda: 2 }) },
  "c-respondida": { titulo: "C · Edad respondida", nota: "Sí elegido: marca, no solo color.", route: "resultado", sample: S({ sana: 18, roya: 7, cercospora: 1, duda: 2 }, true) },
  "c-dudas": { titulo: "C · Muchas dudas, sin audio", nota: "Más de 20 % de dudas (M06); clips de audio ausentes.", route: "resultado", sample: S({ sana: 14, roya: 6, duda: 8 }, false), audioFails: true },
  "c-sana": { titulo: "C · Todas sanas", nota: "M01: una sola fila y un mensaje corto.", route: "resultado", sample: S({ sana: 30 }, false) },
  "d-enviar": { titulo: "D · Enviar", nota: "El SMS como globo enviado y lo que significa cada pieza.", route: "enviar", sample: S({ sana: 18, roya: 7, cercospora: 1, duda: 2 }, true), techNumber: "+51 984 123 456" },
  "d-frase": {
    titulo: "D · Con frase de la laptop", nota: "Bandera apagada hoy; estilos listos.", route: "enviar", sample: S({ sana: 18, roya: 7, cercospora: 1, duda: 2 }, true), techNumber: "+51 984 123 456",
    serviceEnabled: true, detailsOpen: true, sentence: "Roya en 7 de 28 hojas; plantas de mas de 15 anos.",
  },
  "e-tecnico": { titulo: "E · Técnico, vacío", nota: "Pegar o cargar códigos.", route: "tecnico", sample: null },
  "e-lista": {
    titulo: "E · Lista ordenada", nota: "Gravedad por parcela; la tabla se desliza con la parcela fija.", route: "tecnico", sample: null,
    tecnicoText: `${EXAMPLES}\nHola, ya te mandé las hojas\nLP P5 10H ROYA12`,
  },
  "f-vacio": { titulo: "F · Estado vacío", nota: "Resultado sin hojas: el plato vacío.", route: "resultado", sample: null },
};

// ---------- Shell (main.ts) ----------

const ROUTES = {
  muestra: { name: "Muestra", icon: "leaf" },
  resultado: { name: "Resultado", icon: "chart" },
  enviar: { name: "Enviar", icon: "send" },
  tecnico: { name: "Técnico", icon: "list" },
};

const app = {
  sample: null,
  last: null,
  scan: null,
  fresh: false,
  techNumber: "",
  refs: {},
  update(next) { app.sample = next; app.render(); },
  go(route) { location.hash = `#/${route}`; },
  render() {
    const root = document.getElementById("app");
    const hash = location.hash.replace("#/", "");
    const route = hash in ROUTES ? hash : "muestra";
    const main = el("main", {});
    if (route === "muestra") renderMuestra(main);
    else if (route === "resultado") renderResultado(main);
    else if (route === "enviar") renderEnviar(main);
    else renderTecnico(main);
    // La animación de "hoja nueva" solo se ve en el repintado que sigue a una foto.
    app.fresh = false;

    const header = el(
      "header",
      { class: "appbar" },
      el("span", { class: "brand" }, brandLogo(), "Leaf Plate"),
      app.demo ? null : el("span", { class: "ai-status" }, icon("local-ai"), "IA en el teléfono"),
    );
    const nav = el("nav", {});
    for (const [key, tab] of Object.entries(ROUTES)) {
      const link = el("a", { href: `#/${key}`, class: key === route ? "active" : "" }, icon(tab.icon), tab.name);
      if (key === route) link.setAttribute("aria-current", "page");
      nav.append(link);
    }
    root.replaceChildren(header, main, nav);
    if (app.demo) header.after(el("p", { class: "banner" }, icon("alert"), "MODO DEMOSTRACIÓN: no hay modelo cargado; las clases son inventadas."));
  },
};

function start() {
  const params = new URLSearchParams(location.search);
  const preset = ESTADOS[params.get("estado")] ?? ESTADOS["a-formulario"];
  Object.assign(app, structuredClone({ ...preset, after: undefined }));
  app.demo = params.get("demo") === "1";
  history.replaceState(null, "", `${location.pathname}${location.search}#/${preset.route}`);
  app.render();
  preset.after?.();
  window.addEventListener("hashchange", () => { app.scan = null; app.render(); });
}
