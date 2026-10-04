import { Classifier } from "../adapters/classifier";
import { RejectReason } from "../adapters/photoQuality";
import { TextKey } from "../domain/i18n";
import { Lang, MessageCatalog } from "../domain/message";
import { LeafResult, Sample } from "../domain/sample";

export type Route = "muestra" | "resultado" | "enviar" | "tecnico";

export interface LastPhoto {
  leaf: LeafResult;
  reason?: RejectReason;
  seconds: number;
}

export interface App {
  sample: Sample | null;
  last: LastPhoto | null;
  techNumber: string;
  /** Dirección del servidor de la laptop; vacío = el mismo servidor que sirve la app. */
  serviceUrl: string;
  /** Frase del LLM ya recibida para un código, para no pedirla en cada repintado. */
  sentence: { code: string; text: string | null } | null;
  /** Códigos pegados en la lista del técnico: se conservan al cambiar de idioma o de pestaña. */
  techText: string;
  catalog: MessageCatalog;
  classifier: Classifier;
  /** Idioma de la interfaz, elegido con el botón de la barra superior. */
  lang: Lang;
  /** Texto de la interfaz en el idioma actual. */
  t(key: TextKey, values?: Record<string, string | number>): string;
  setLang(lang: Lang): void;
  /** Guarda la muestra en el teléfono y vuelve a pintar la pantalla. */
  update(sample: Sample | null): void;
  go(route: Route): void;
  render(): void;
}
