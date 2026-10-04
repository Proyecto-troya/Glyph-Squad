// Reproduce clips Opus grabados de antemano (public/audio/{quz,es}/<clip>.opus).
// Si falta un clip, se calla: el texto en pantalla sigue siendo la referencia.

import { Lang } from "../domain/message";

let current: HTMLAudioElement | null = null;
let playId = 0;

function playOne(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const audio = new Audio(url);
    current = audio;
    audio.onended = () => resolve(true);
    audio.onerror = () => resolve(false);
    audio.play().catch(() => resolve(false));
  });
}

export function stopAudio(): void {
  playId++;
  current?.pause();
  current = null;
}

/** Devuelve false si algún clip no existe o no se pudo reproducir. */
export async function playClips(lang: Lang, clips: string[]): Promise<boolean> {
  stopAudio();
  const id = playId;
  for (const clip of clips) {
    const ok = await playOne(`audio/${lang}/${clip}.opus`);
    if (!ok || id !== playId) return false;
  }
  return true;
}
