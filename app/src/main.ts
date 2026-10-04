import "./style.css";
import { loadClassifier } from "./adapters/classifier";
import { stopAudio } from "./adapters/audio";
import { isLocalAddress, normalizeServiceUrl } from "./adapters/smsService";
import { storage } from "./adapters/storage";
import { DEFAULT_LANG, isLang, LANG_INFO, LANGS, TextKey, translate } from "./domain/i18n";
import { MessageCatalog } from "./domain/message";
import { App, Route } from "./ui/app";
import { el } from "./ui/dom";
import { brandLogo, icon, IconName } from "./ui/icons";
import { renderEnviar } from "./ui/Enviar";
import { renderMuestra } from "./ui/Muestra";
import { renderResultado } from "./ui/Resultado";
import { renderTecnico } from "./ui/Tecnico";

/** La lista del técnico es una vista aparte (#/tecnico), con su propio marco y sin estas pestañas. */
const TECH_ROUTE = "tecnico";

/** Pestañas de la caficultora. */
const TABS: Record<Exclude<Route, typeof TECH_ROUTE>, { name: TextKey; icon: IconName }> = {
  muestra: { name: "tabSample", icon: "leaf" },
  resultado: { name: "tabResult", icon: "chart" },
  enviar: { name: "tabSend", icon: "send" },
};

function currentRoute(): Route {
  const route = location.hash.replace("#/", "");
  return route === TECH_ROUTE || route in TABS ? (route as Route) : "muestra";
}

/** Paso de una vista a la otra: de las pestañas a la lista del técnico y de vuelta. */
function viewLink(app: App, tech: boolean): HTMLElement {
  return tech
    ? el("a", { class: "view-link", href: "#/muestra" }, icon("leaf"), app.t("emptyGo"))
    : el("a", { class: "view-link", href: `#/${TECH_ROUTE}` }, icon("technician"), app.t("viewTech"));
}

/** Botón de idioma, bajo la barra superior: un toque por idioma, con el actual marcado. */
function languageSwitch(app: App): HTMLElement {
  const group = el("div", { class: "lang-switch" });
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", app.t("langLabel"));
  for (const lang of LANGS) {
    const button = el("button", { type: "button", title: LANG_INFO[lang].name }, LANG_INFO[lang].short);
    button.setAttribute("aria-label", LANG_INFO[lang].name);
    button.setAttribute("aria-pressed", String(lang === app.lang));
    button.onclick = () => app.setLang(lang);
    group.append(button);
  }
  return group;
}

/**
 * La laptop que redacta el mensaje de la IA no se configura en pantalla: no es cosa de la
 * caficultora. El equipo la deja guardada en el teléfono abriendo una vez la app con
 * ?laptop=192.168.43.1:8000 (con ?laptop= vacío se olvida). Solo vale una dirección de la red local.
 */
async function loadLaptopUrl(): Promise<string> {
  const saved = await storage.loadServiceUrl();
  const current = isLocalAddress(saved) ? saved : "";
  const fromLink = new URLSearchParams(location.search).get("laptop");
  if (fromLink === null) return current;
  history.replaceState(null, "", location.pathname + location.hash);
  const url = normalizeServiceUrl(fromLink);
  if (url && !isLocalAddress(url)) return current;
  await storage.saveServiceUrl(url);
  return url;
}

async function start(): Promise<void> {
  const root = document.getElementById("app")!;
  const [catalog, classifier, sample, techNumber, serviceUrl, savedLang] = await Promise.all([
    fetch("data/messages.json").then((r) => r.json() as Promise<MessageCatalog>),
    loadClassifier(),
    storage.loadCurrent(),
    storage.loadTechNumber(),
    loadLaptopUrl(),
    storage.loadLang(),
  ]);

  const app: App = {
    sample,
    last: null,
    fresh: false,
    techNumber,
    serviceUrl,
    sentence: null,
    techText: "",
    catalog,
    classifier,
    lang: isLang(savedLang) ? savedLang : DEFAULT_LANG,
    t: (key, values) => translate(app.lang, key, values),
    setLang(lang) {
      app.lang = lang;
      void storage.saveLang(lang);
      app.render();
    },
    update(next) {
      app.sample = next;
      void storage.saveCurrent(next);
      app.render();
    },
    go(route) {
      location.hash = `#/${route}`;
    },
    render() {
      stopAudio();
      document.documentElement.lang = LANG_INFO[app.lang].html;
      const route = currentRoute();
      const tech = route === TECH_ROUTE;
      const main = el("main", {});
      if (route === "muestra") renderMuestra(main, app);
      else if (route === "resultado") renderResultado(main, app);
      else if (route === "enviar") renderEnviar(main, app);
      else renderTecnico(main, app);
      // La entrada del resultado solo se anima en el repintado que sigue a una foto.
      app.fresh = false;

      const header = el(
        "header",
        { class: "appbar" },
        el("span", { class: "brand" }, brandLogo(), "Leaf Plate"),
        // Con el clasificador de mentira ya avisa la franja de demostración. La lista del técnico no usa IA.
        !tech && classifier.kind === "onnx" && el("span", { class: "ai-status" }, icon("local-ai"), app.t("aiLocal")),
      );
      // En su propia fila: en la barra, junto a la marca y al indicador de IA, no cabe a ancho de teléfono.
      const langRow = el("div", { class: "lang-row" }, viewLink(app, tech), languageSwitch(app));

      const banners: HTMLElement[] = [];
      // El quechua de la interfaz no lo ha revisado nadie que lo hable: se avisa siempre.
      if (app.lang === "quz") banners.push(el("p", { class: "banner" }, icon("alert"), app.t("quzNotice")));
      if (classifier.kind === "fake") banners.push(el("p", { class: "banner" }, icon("alert"), app.t("demoBanner")));

      // La vista del técnico va sin pestañas y, en una laptop, a todo el ancho de la tabla.
      root.classList.toggle("tech-view", tech);
      if (tech) {
        root.replaceChildren(header, langRow, ...banners, main);
        return;
      }
      const nav = el("nav", {});
      for (const [key, tab] of Object.entries(TABS)) {
        const link = el("a", { href: `#/${key}`, class: key === route ? "active" : "" }, icon(tab.icon), app.t(tab.name));
        if (key === route) link.setAttribute("aria-current", "page");
        nav.append(link);
      }
      root.replaceChildren(header, langRow, ...banners, main, nav);
    },
  };

  window.addEventListener("hashchange", () => app.render());
  app.render();

  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(console.error);
  }
}

void start();
