"""Piezas compartidas por los scripts de ml/: etiquetas, manifiesto y preprocesado.

El preprocesado de evaluación debe ser idéntico al de la app
(app/src/adapters/classifier.ts): recorte central cuadrado -> 224x224 -> normalizar.
"""
import csv
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

LABELS = ["sana", "roya", "minador", "cercospora", "phoma"]
UNKNOWN = "desconocida"  # clases que el modelo no conoce (p. ej. ojo de gallo): debe abstenerse
INPUT_SIZE = 224
MEAN = [0.485, 0.456, 0.406]
STD = [0.229, 0.224, 0.225]
MODEL_NAME = "mobilenetv3_small_100"

ML_DIR = Path(__file__).parent
DATA_DIR = ML_DIR / "data"
OUT_DIR = ML_DIR / "out"
MANIFEST = ML_DIR / "manifest.csv"
APP_MODELS = ML_DIR.parent / "app" / "public" / "models"
MANIFEST_FIELDS = ["ruta", "fuente", "pais", "etiqueta", "particion"]


def read_manifest(path=MANIFEST, **filters):
    """Filas del manifiesto que cumplen los filtros, p. ej. particion="val", fuente="bracol"."""
    with open(path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    return [r for r in rows if all(r[k] == v for k, v in filters.items())]


def open_rgb(path):
    return ImageOps.exif_transpose(Image.open(path)).convert("RGB")


def center_square(image):
    side = min(image.size)
    left = (image.width - side) // 2
    top = (image.height - side) // 2
    return image.crop((left, top, left + side, top + side))


def load_image(path):
    """Imagen -> array float32 CHW normalizado, como lo hace la app."""
    image = center_square(open_rgb(path)).resize((INPUT_SIZE, INPUT_SIZE), Image.BILINEAR)
    array = (np.asarray(image, dtype=np.float32) / 255.0 - MEAN) / STD
    return array.transpose(2, 0, 1).astype(np.float32)


def build_model(pretrained=False):
    import timm

    return timm.create_model(MODEL_NAME, pretrained=pretrained, num_classes=len(LABELS))


def predict_logits(model_path, paths, batch_size=32):
    """Logits de un .onnx (el archivo que va al teléfono) o de un .pt."""
    model_path = Path(model_path)
    if model_path.suffix == ".onnx":
        import onnxruntime as ort

        session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
        name = session.get_inputs()[0].name
        run = lambda batch: session.run(None, {name: batch})[0]
    else:
        import torch

        model = build_model()
        model.load_state_dict(torch.load(model_path, map_location="cpu"))
        model.eval()
        run = lambda batch: model(torch.from_numpy(batch)).detach().numpy()

    out = []
    for start in range(0, len(paths), batch_size):
        batch = np.stack([load_image(p) for p in paths[start : start + batch_size]])
        # El .onnx se exporta con lote fijo de 1, igual que en la app.
        out.extend(run(batch[i : i + 1])[0] for i in range(len(batch)))
    return np.array(out, dtype=np.float32)


def softmax(logits, temperature=1.0):
    z = logits / temperature
    z = z - z.max(axis=1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=1, keepdims=True)
