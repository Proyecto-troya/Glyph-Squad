import { Classifier } from "../adapters/classifier";
import { QualityReport, RejectReason } from "../adapters/photoQuality";
import { TextKey } from "../domain/i18n";
import { Lang, MessageCatalog } from "../domain/message";
import { ClassProb, LeafResult, Sample } from "../domain/sample";

export type Route = "muestra" | "resultado" | "enviar" | "tecnico";

export interface LastPhoto {
  leaf: LeafResult;
  reason?: RejectReason;
  seconds: number;
  /** La foto como `blob:`, solo en memoria: no se guarda ni sale del teléfono. */
  photoUrl: string;
  /** Medidas del filtro de calidad; null si la foto no se pudo leer. */
  quality: QualityReport | null;
  /** Las clases más probables según el modelo; vacío si no se llegó a clasificar. */
  alternatives: ClassProb[];
}

export interface App {
  sample: Sample | null;
  last: LastPhoto | null;
  /** Solo en el repintado que sigue a una foto: anima la entrada del resultado y de la hoja nueva. */
  fresh: boolean;
  techNumber: string;
  /** Dirección de la laptop que redacta el mensaje de la IA (su gateway), guardada con el enlace de preparación; vacío = ninguna. */
  serviceUrl: string;
  /** Mensaje de la IA ya recibido para un código, para no pedirlo en cada repintado. */
  sentence: { code: string; ai: string } | null;
  /** Códigos pegados en la lista del técnico: se conservan al cambiar de idioma o de vista. */
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

/** Olvida la última foto y libera su `blob:`. */
export function forgetLast(app: App): void {
  if (app.last) URL.revokeObjectURL(app.last.photoUrl);
  app.last = null;
}
