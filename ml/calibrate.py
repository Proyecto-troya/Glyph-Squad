"""Calibra la confianza y fija el umbral de abstención sobre validación.

1. Temperatura (Guo et al. 2017): la T que minimiza la log-verosimilitud negativa.
2. Umbral: el más bajo con precisión >= 90 % entre las hojas aceptadas; se reporta la cobertura.

Se calibra el archivo que va al teléfono (int8). Escribe app/public/models/calibration.json.
"""
import argparse
import json

import numpy as np

from common import APP_MODELS, DATA_DIR, INPUT_SIZE, LABELS, MEAN, STD, predict_logits, read_manifest, softmax


def fit_temperature(logits, y):
    def nll(t):
        return -np.log(softmax(logits, t)[np.arange(len(y)), y] + 1e-12).mean()

    grid = np.exp(np.linspace(np.log(0.05), np.log(20), 400))
    return float(grid[np.argmin([nll(t) for t in grid])])


def fit_threshold(probs, y, target):
    """Umbral más bajo cuya precisión entre aceptadas llega al objetivo. Devuelve (umbral, precisión, cobertura)."""
    confidence = probs.max(axis=1)
    correct = probs.argmax(axis=1) == y
    for threshold in np.unique(np.concatenate([[0.0], confidence])):
        accepted = confidence >= threshold
        precision = correct[accepted].mean()
        if precision >= target:
            return float(threshold), float(precision), float(accepted.mean())
    # Ni la hoja más segura llega al objetivo: abstenerse siempre.
    return 1.0, 0.0, 0.0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", default=str(APP_MODELS / "leaf-int8.onnx"))
    parser.add_argument("--target-precision", type=float, default=0.90)
    args = parser.parse_args()

    rows = read_manifest(fuente="bracol", particion="val")
    y = np.array([LABELS.index(r["etiqueta"]) for r in rows])
    logits = predict_logits(args.model, [DATA_DIR / r["ruta"] for r in rows])

    temperature = fit_temperature(logits, y)
    threshold, precision, coverage = fit_threshold(softmax(logits, temperature), y, args.target_precision)

    calibration = {
        "labels": LABELS,
        "temperature": round(temperature, 4),
        "threshold": round(threshold, 4),
        "inputSize": INPUT_SIZE,
        "mean": MEAN,
        "std": STD,
        "val": {"n": len(y), "acceptedPrecision": round(precision, 4), "coverage": round(coverage, 4)},
    }
    out = APP_MODELS / "calibration.json"
    out.write_text(json.dumps(calibration, indent=2), encoding="utf-8")
    print(json.dumps(calibration, indent=2))
    print(f"-> {out}")


if __name__ == "__main__":
    main()
