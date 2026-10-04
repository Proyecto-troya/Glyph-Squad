"""Genera los ~40 clips de audio de la app: 8 mensajes + números 0-30, en quechua
cusqueño (facebook/mms-tts-quz) y en español (facebook/mms-tts-spa).

Los textos salen de app/public/data/messages.json ("say"); los clips van a
app/public/audio/{quz,es}/<clip>.opus. Necesita ffmpeg en el PATH.

AVISO: MMS-TTS es CC BY-NC (solo demo). El quechua es traducción automática y voz
sintética, sin validar por hablante: la app lo rotula así.
"""
import json
import subprocess
import tempfile
from pathlib import Path

import scipy.io.wavfile
import torch
from transformers import AutoTokenizer, VitsModel

APP_PUBLIC = Path(__file__).parent.parent / "app" / "public"
MODELS = {"quz": "facebook/mms-tts-quz", "es": "facebook/mms-tts-spa"}

ES_NUMBERS = (
    "cero uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince "
    "dieciséis diecisiete dieciocho diecinueve veinte veintiuno veintidós veintitrés veinticuatro "
    "veinticinco veintiséis veintisiete veintiocho veintinueve treinta"
).split()
QUZ_UNITS = ["", "huk", "iskay", "kimsa", "tawa", "pisqa", "suqta", "qanchis", "pusaq", "isqun"]


def quz_number(n):
    if n == 0:
        return "ch'usaq"
    tens, unit = divmod(n, 10)
    words = [] if tens == 0 else ["chunka"] if tens == 1 else [QUZ_UNITS[tens], "chunka"]
    if unit and tens:
        # -yuq tras vocal, -niyuq tras consonante: chunka kimsayuq, chunka hukniyuq.
        words.append(QUZ_UNITS[unit] + ("yuq" if QUZ_UNITS[unit][-1] in "aiu" else "niyuq"))
    elif unit:
        words.append(QUZ_UNITS[unit])
    return " ".join(words)


def main():
    catalog = json.loads((APP_PUBLIC / "data" / "messages.json").read_text(encoding="utf-8"))
    say = {k: v for k, v in catalog["say"].items() if not k.startswith("_")}

    for lang, model_name in MODELS.items():
        texts = {clip: entry[lang] for clip, entry in say.items()}
        for n in range(31):
            texts[f"n{n}"] = quz_number(n) if lang == "quz" else ES_NUMBERS[n]

        model = VitsModel.from_pretrained(model_name)
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        out_dir = APP_PUBLIC / "audio" / lang
        out_dir.mkdir(parents=True, exist_ok=True)
        for clip, text in texts.items():
            with torch.no_grad():
                wave = model(**tokenizer(text, return_tensors="pt")).waveform[0].numpy()
            with tempfile.TemporaryDirectory() as tmp:
                wav = Path(tmp) / "clip.wav"
                scipy.io.wavfile.write(wav, model.config.sampling_rate, wave)
                subprocess.run(
                    ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-c:a", "libopus", "-b:a", "16k",
                     str(out_dir / f"{clip}.opus")],
                    check=True,
                )
            print(lang, clip, text)


if __name__ == "__main__":
    main()
