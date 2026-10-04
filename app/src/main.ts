import "./style.css";
import { loadClassifier } from "./adapters/classifier";
import { stopAudio } from "./adapters/audio";
import { storage } from "./adapters/storage";
import { MessageCatalog } from "./domain/message";
import { App, Route } from "./ui/app";
import { el } from "./ui/dom";
import { renderEnviar } from "./ui/Enviar";
import { renderMuestra } from "./ui/Muestra";
import { renderResultado } from "./ui/Resultado";
import { renderTecnico } from "./ui/Tecnico";

const ROUTES: Record<Route, string> = {
  muestra: "Muestra",
  resultado: "Resultado",
  enviar: "Enviar",
  tecnico: "Técnico",
};

function currentRoute(): Route {
  const route = location.hash.replace("#/", "");
  return route in ROUTES ? (route as Route) : "muestra";
}

async function start(): Promise<void> {
  const root = document.getElementById("app")!;
  const [catalog, classifier, sample, techNumber] = await Promise.all([
    fetch("data/messages.json").then((r) => r.json() as Promise<MessageCatalog>),
    loadClassifier(),
    storage.loadCurrent(),
    storage.loadTechNumber(),
  ]);

  const app: App = {
    sample,
    last: null,
    techNumber,
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

      const nav = el("nav", {});
      for (const [key, name] of Object.entries(ROUTES)) {
        nav.append(el("a", { href: `#/${key}`, class: key === route ? "active" : "" }, name));
      }
      root.replaceChildren(main, nav);
      if (classifier.kind === "fake") {
        root.prepend(
          el("p", { class: "banner" }, "MODO DEMOSTRACIÓN: no hay modelo cargado; las clases son inventadas."),
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
