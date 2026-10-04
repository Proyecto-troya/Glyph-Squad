import { Classifier } from "../adapters/classifier";
import { RejectReason } from "../adapters/photoQuality";
import { MessageCatalog } from "../domain/message";
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
  catalog: MessageCatalog;
  classifier: Classifier;
  /** Guarda la muestra en el teléfono y vuelve a pintar la pantalla. */
  update(sample: Sample | null): void;
  go(route: Route): void;
  render(): void;
}
