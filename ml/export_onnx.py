"""Exporta ml/out/model.pt a ONNX (opset 17) y lo cuantiza a int8 estático con ~200
imágenes de validación. Deja leaf-int8.onnx en app/public/models/.

Si int8 pierde demasiada precisión (plan B), usar --no-quantize y reportar el tamaño real.
"""
import argparse
import shutil

import numpy as np
import torch
from onnxruntime.quantization import CalibrationDataReader, QuantFormat, QuantType, quantize_static

from common import APP_MODELS, DATA_DIR, INPUT_SIZE, OUT_DIR, build_model, load_image, read_manifest


class ValReader(CalibrationDataReader):
    def __init__(self, paths):
        self.batches = iter({"input": load_image(p)[None]} for p in paths)

    def get_next(self):
        return next(self.batches, None)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--calibration-images", type=int, default=200)
    parser.add_argument("--no-quantize", action="store_true")
    args = parser.parse_args()

    model = build_model()
    model.load_state_dict(torch.load(OUT_DIR / "model.pt", map_location="cpu"))
    model.eval()

    fp32 = OUT_DIR / "leaf-fp32.onnx"
    torch.onnx.export(
        model,
        torch.zeros(1, 3, INPUT_SIZE, INPUT_SIZE),
        str(fp32),
        opset_version=17,
        input_names=["input"],
        output_names=["logits"],
        dynamo=False,
    )

    APP_MODELS.mkdir(parents=True, exist_ok=True)
    target = APP_MODELS / "leaf-int8.onnx"
    if args.no_quantize:
        shutil.copy(fp32, target)
    else:
        rows = read_manifest(fuente="bracol", particion="val")
        rng = np.random.default_rng(7)
        chosen = rng.choice(len(rows), min(args.calibration_images, len(rows)), replace=False)
        quantize_static(
            str(fp32),
            str(target),
            ValReader([DATA_DIR / rows[i]["ruta"] for i in chosen]),
            quant_format=QuantFormat.QDQ,
            per_channel=True,
            activation_type=QuantType.QUInt8,
            weight_type=QuantType.QInt8,
        )

    for path in (fp32, target):
        print(f"{path}  {path.stat().st_size / 1024 / 1024:.2f} MB")
    print("Siguiente: python ml/calibrate.py && python ml/evaluate.py (sobre el archivo int8)")


if __name__ == "__main__":
    main()
