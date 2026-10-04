"""Mide el archivo que va al teléfono (leaf-int8.onnx + calibration.json) y escribe
ml/out/results.md y results.json con las filas de la tabla de medidas:

- Precisión 5 clases en BRACOL test (por hoja) + matriz de confusión.
- E1, país no visto: Saposoa sana/roya (entrenado solo con BRACOL).
- Abstención ante clase desconocida: Saposoa "desconocida" (ojo de gallo).
- Cobertura con 90 % de precisión en validación (viene de calibration.json).
- Conjunto dorado: tests/golden/labels.csv (archivo, esperado), donde esperado puede ser "duda".
"""
import argparse
import csv
import json

import numpy as np

from common import APP_MODELS, DATA_DIR, LABELS, ML_DIR, OUT_DIR, UNKNOWN, app_model, predict_logits, readable, read_manifest, softmax

GOLDEN_DIR = ML_DIR.parent / "tests" / "golden"


def predict(model, calibration, paths):
    """Etiqueta final de cada foto, con abstención ("duda"), y la clase más probable sin abstención."""
    probs = softmax(predict_logits(model, paths), calibration["temperature"])
    top = [LABELS[i] for i in probs.argmax(axis=1)]
    final = [label if p >= calibration["threshold"] else "duda" for label, p in zip(top, probs.max(axis=1))]
    return np.array(top), np.array(final)


def score(model, calibration, rows):
    truth = np.array([r["etiqueta"] for r in rows])
    top, final = predict(model, calibration, [DATA_DIR / r["ruta"] for r in rows])
    accepted = final != "duda"
    return {
        "n": len(rows),
        "accuracy": float((top == truth).mean()),
        "coverage": float(accepted.mean()),
        "acceptedAccuracy": float((final[accepted] == truth[accepted]).mean()) if accepted.any() else None,
        "confusion": [[int(((truth == t) & (top == p)).sum()) for p in LABELS] for t in LABELS],
    }


def pct(value):
    return "n/d" if value is None else f"{value * 100:.1f} %"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", default=str(app_model()))
    args = parser.parse_args()
    calibration = json.loads((APP_MODELS / "calibration.json").read_text(encoding="utf-8"))
    results = {"model": args.model, "calibration": calibration}
    lines = [f"# Resultados ({calibration['model']}, el archivo que va al teléfono)", "", "| Medida | Dónde | Resultado |", "|---|---|---|"]

    test = score(args.model, calibration, read_manifest(fuente="bracol", particion="test"))
    results["bracolTest"] = test
    lines.append(f"| Precisión 5 clases | BRACOL test, {test['n']} hojas | {pct(test['accuracy'])} |")

    e1_rows = readable([r for r in read_manifest(fuente="saposoa") if r["etiqueta"] in ("sana", "roya")])
    if e1_rows:
        e1 = score(args.model, calibration, e1_rows)
        results["e1Saposoa"] = e1
        lines.append(
            f"| Precisión país no visto (E1) | Saposoa sana/roya, {e1['n']} fotos | {pct(e1['accuracy'])} "
            f"(aceptadas: {pct(e1['acceptedAccuracy'])} con cobertura {pct(e1['coverage'])}) |"
        )

    unknown_rows = readable(read_manifest(fuente="saposoa", etiqueta=UNKNOWN))
    if unknown_rows:
        _, final = predict(args.model, calibration, [DATA_DIR / r["ruta"] for r in unknown_rows])
        results["abstentionUnknown"] = {"n": len(unknown_rows), "abstained": float((final == "duda").mean())}
        lines.append(
            f"| Abstención ante clase desconocida | Saposoa, {len(unknown_rows)} fotos | {pct((final == 'duda').mean())} |"
        )

    val = calibration["val"]
    lines.append(f"| Cobertura con 90 % de precisión | Validación calibrada, {val['n']} hojas | {pct(val['coverage'])} |")

    labels_csv = GOLDEN_DIR / "labels.csv"
    if labels_csv.exists():
        with open(labels_csv, newline="", encoding="utf-8") as f:
            golden = list(csv.DictReader(f))
        _, final = predict(args.model, calibration, [GOLDEN_DIR / r["archivo"] for r in golden])
        hits = int(sum(f == r["esperado"] for f, r in zip(final, golden)))
        results["golden"] = {"n": len(golden), "hits": hits}
        lines.append(f"| Conjunto dorado | tests/golden | {hits} de {len(golden)} |")
        for row, got in zip(golden, final):
            if got != row["esperado"]:
                print(f"dorado: {row['archivo']} esperado {row['esperado']}, salió {got}")

    lines += ["", "## Matriz de confusión, BRACOL test (filas = verdad, columnas = predicción)", ""]
    lines += ["| | " + " | ".join(LABELS) + " |", "|---|" + "---|" * len(LABELS)]
    lines += [f"| **{t}** | " + " | ".join(map(str, row)) + " |" for t, row in zip(LABELS, test["confusion"])]

    OUT_DIR.mkdir(exist_ok=True)
    (OUT_DIR / "results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    (OUT_DIR / "results.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
