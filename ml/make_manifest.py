"""Construye ml/manifest.csv (ruta, fuente, pais, etiqueta, particion).

BRACOL (Brasil): se usa el conjunto de HOJAS COMPLETAS (1.747 hojas), no los recortes
de síntomas, y la partición 70/15/15 se hace por hoja, estratificada por etiqueta.
Se espera <bracol>/dataset.csv con columnas id y predominant_stress, y las fotos en
<bracol>/images/<id>.jpg. Comprobar el código de predominant_stress con el README
del dataset antes de entrenar (BRACOL_STRESS más abajo).

Saposoa (Perú): nunca se usa para entrenar; va entero a la partición "externo".
Se espera una carpeta por clase; el mapeo carpeta -> etiqueta se pasa con --saposoa-map.
Las clases que el modelo no conoce (ojo de gallo) se etiquetan como "desconocida".

Ejemplo:
  python ml/make_manifest.py --bracol ml/data/bracol/leaf --saposoa ml/data/saposoa \
      --saposoa-map "healthy=sana,rust=roya,ojo_de_gallo=desconocida"
"""
import argparse
import csv
import random
from collections import Counter, defaultdict
from pathlib import Path

from common import DATA_DIR, MANIFEST, MANIFEST_FIELDS

BRACOL_STRESS = {"0": "sana", "1": "minador", "2": "roya", "3": "phoma", "4": "cercospora"}
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png"}


def bracol_rows(root, seed):
    by_label = defaultdict(list)
    with open(root / "dataset.csv", newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            image = root / "images" / f"{row['id']}.jpg"
            label = BRACOL_STRESS.get(row["predominant_stress"].strip())
            if label and image.exists():
                by_label[label].append(image)

    rng = random.Random(seed)
    rows = []
    for label, images in sorted(by_label.items()):
        images.sort()
        rng.shuffle(images)
        n_train = round(len(images) * 0.70)
        n_val = round(len(images) * 0.15)
        for i, image in enumerate(images):
            split = "train" if i < n_train else "val" if i < n_train + n_val else "test"
            rows.append([image, "bracol", "Brasil", label, split])
    return rows


def saposoa_rows(root, mapping):
    rows = []
    for folder, label in mapping.items():
        images = [p for p in sorted((root / folder).rglob("*")) if p.suffix.lower() in IMAGE_SUFFIXES]
        if not images:
            raise SystemExit(f"No hay imágenes en {root / folder}")
        rows.extend([image, "saposoa", "Perú", label, "externo"] for image in images)
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--bracol", type=Path, required=True)
    parser.add_argument("--saposoa", type=Path)
    parser.add_argument("--saposoa-map", default="", help="carpeta=etiqueta,carpeta=etiqueta")
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--out", type=Path, default=MANIFEST)
    args = parser.parse_args()

    rows = bracol_rows(args.bracol, args.seed)
    if args.saposoa:
        mapping = dict(pair.split("=") for pair in args.saposoa_map.split(",") if pair)
        rows += saposoa_rows(args.saposoa, mapping)

    with open(args.out, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(MANIFEST_FIELDS)
        for image, *rest in rows:
            # Rutas relativas a ml/data si se puede, para que el manifiesto sirva en otra máquina.
            try:
                ruta = image.resolve().relative_to(DATA_DIR.resolve()).as_posix()
            except ValueError:
                ruta = image.resolve().as_posix()
            writer.writerow([ruta, *rest])

    summary = Counter((fuente, split, label) for _, fuente, _, label, split in rows)
    for key, n in sorted(summary.items()):
        print(*key, n, sep="\t")
    print(f"{len(rows)} filas -> {args.out}")


if __name__ == "__main__":
    main()
