// Tipografías empaquetadas con la app (solo latín) para que funcionen sin conexión.
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-400-italic.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-sans/latin-700.css";
import "@fontsource/ibm-plex-mono/latin-600.css";
import "./style.css";
import { loadClassifier } from "./adapters/classifier";
import { stopAudio } from "./adapters/audio";
import { storage } from "./adapters/storage";
import { MessageCatalog } from "./domain/message";
import { App, Route } from "./ui/app";
import { el } from "./ui/dom";
import { icon, IconName } from "./ui/icons";
import { renderEnviar } from "./ui/Enviar";
import { renderMuestra } from "./ui/Muestra";
import { renderResultado } from "./ui/Resultado";
import { renderTecnico } from "./ui/Tecnico";

const ROUTES: Record<Route, { name: string; icon: IconName }> = {
  muestra: { name: "Muestra", icon: "leaf" },
  resultado: { name: "Resultado", icon: "chart" },
  enviar: { name: "Enviar", icon: "send" },
  tecnico: { name: "Técnico", icon: "list" },
};

function currentRoute(): Route {
  const route = location.hash.replace("#/", "");
  return route in ROUTES ? (route as Route) : "muestra";
}

async function start(): Promise<void> {
  const root = document.getElementById("app")!;
  const [catalog, classifier, sample, techNumber, serviceUrl] = await Promise.all([
    fetch("data/messages.json").then((r) => r.json() as Promise<MessageCatalog>),
    loadClassifier(),
    storage.loadCurrent(),
    storage.loadTechNumber(),
    storage.loadServiceUrl(),
  ]);

  const app: App = {
    sample,
    last: null,
    techNumber,
    serviceUrl,
    sentence: null,
    catalog,
    classifier,
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
      const route = currentRoute();
      const main = el("main", {});
      if (route === "muestra") renderMuestra(main, app);
      else if (route === "resultado") renderResultado(main, app);
      else if (route === "enviar") renderEnviar(main, app);
      else renderTecnico(main);

      const header = el(
        "header",
        { class: "appbar" },
        el("span", { class: "brand" }, el("span", { class: "brand-mark" }, icon("leaf")), "Leaf Plate"),
      );
      const nav = el("nav", {});
      for (const [key, tab] of Object.entries(ROUTES)) {
        const link = el("a", { href: `#/${key}`, class: key === route ? "active" : "" }, icon(tab.icon), tab.name);
        if (key === route) link.setAttribute("aria-current", "page");
        nav.append(link);
      }
      root.replaceChildren(header, main, nav);
      if (classifier.kind === "fake") {
        header.after(
          el(
            "p",
            { class: "banner" },
            icon("alert"),
            "MODO DEMOSTRACIÓN: no hay modelo cargado; las clases son inventadas.",
          ),
        );
      }
    },
  };

  window.addEventListener("hashchange", () => app.render());
  app.render();

  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(console.error);
  }
}

void start();
