// Guarda la muestra en curso y el historial en IndexedDB, solo en el teléfono.
// Las fotos no se guardan: se clasifican y se descartan.

import { Sample } from "../domain/sample";

const DB_NAME = "leaf-plate";
const STORE = "kv";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function get<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function set(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Si IndexedDB no está (modo privado), la app sigue funcionando sin recordar nada.
async function safe<T>(action: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await action();
  } catch {
    return fallback;
  }
}

export const storage = {
  loadCurrent: () => safe(async () => (await get<Sample | null>("current")) ?? null, null),
  saveCurrent: (sample: Sample | null) => safe(() => set("current", sample), undefined),
  loadHistory: () => safe(async () => (await get<Sample[]>("history")) ?? [], []),
  async archive(sample: Sample): Promise<void> {
    const history = await this.loadHistory();
    await safe(() => set("history", [...history, sample]), undefined);
  },
  loadTechNumber: () => safe(async () => (await get<string>("techNumber")) ?? "", ""),
  saveTechNumber: (value: string) => safe(() => set("techNumber", value), undefined),
};
