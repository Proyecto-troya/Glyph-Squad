import "./style.css";
import { loadClassifier } from "./adapters/classifier";
import { stopAudio } from "./adapters/audio";
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

const ROUTES: Record<Route, { name: TextKey; icon: IconName }> = {
  muestra: { name: "tabSample", icon: "leaf" },
  resultado: { name: "tabResult", icon: "chart" },
  enviar: { name: "tabSend", icon: "send" },
  tecnico: { name: "tabTech", icon: "list" },
};

function currentRoute(): Route {
  const route = location.hash.replace("#/", "");
  return route in ROUTES ? (route as Route) : "muestra";
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

async function start(): Promise<void> {
  const root = document.getElementById("app")!;
  const [catalog, classifier, sample, techNumber, serviceUrl, savedLang] = await Promise.all([
    fetch("data/messages.json").then((r) => r.json() as Promise<MessageCatalog>),
    loadClassifier(),
    storage.loadCurrent(),
    storage.loadTechNumber(),
    storage.loadServiceUrl(),
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
        // Con el clasificador de mentira ya avisa la franja de demostración.
        classifier.kind === "onnx" && el("span", { class: "ai-status" }, icon("local-ai"), app.t("aiLocal")),
      );
      // En su propia fila: en la barra, junto a la marca y al indicador de IA, no cabe a ancho de teléfono.
      const langRow = el("div", { class: "lang-row" }, languageSwitch(app));
      const nav = el("nav", {});
      for (const [key, tab] of Object.entries(ROUTES)) {
        const link = el("a", { href: `#/${key}`, class: key === route ? "active" : "" }, icon(tab.icon), app.t(tab.name));
        if (key === route) link.setAttribute("aria-current", "page");
        nav.append(link);
      }

      const banners: HTMLElement[] = [];
      // El quechua de la interfaz no lo ha revisado nadie que lo hable: se avisa siempre.
      if (app.lang === "quz") banners.push(el("p", { class: "banner" }, icon("alert"), app.t("quzNotice")));
      if (classifier.kind === "fake") banners.push(el("p", { class: "banner" }, icon("alert"), app.t("demoBanner")));
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
