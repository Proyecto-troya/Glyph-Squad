"""Entrena MobileNetV3-small (timm) a 224x224 sobre BRACOL (hojas completas).

Fase 1: solo la cabeza (AdamW 1e-3, 5 épocas).
Fase 2: red completa (AdamW 1e-4 con coseno, 15 épocas).
Label smoothing 0,1 y pesos por clase. Guarda el mejor modelo en validación: ml/out/model.pt
"""
import argparse
from collections import Counter

import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms

from common import DATA_DIR, INPUT_SIZE, LABELS, MEAN, OUT_DIR, STD, build_model, load_image, open_rgb, read_manifest

# "Aumentos de patio": encuadre, giro, luz y desenfoque de una foto hecha a mano sobre un plato.
TRAIN_TRANSFORM = transforms.Compose(
    [
        transforms.RandomResizedCrop(INPUT_SIZE, scale=(0.5, 1.0)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomVerticalFlip(),
        transforms.RandomRotation(25, fill=255),
        transforms.RandomPerspective(0.2, p=0.3, fill=255),
        transforms.ColorJitter(0.3, 0.3, 0.3, 0.03),
        transforms.RandomApply([transforms.GaussianBlur(5, (0.1, 1.5))], p=0.2),
        transforms.ToTensor(),
        transforms.Normalize(MEAN, STD),
    ]
)


class Leaves(Dataset):
    def __init__(self, rows, train):
        self.rows = rows
        self.train = train

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, i):
        path = DATA_DIR / self.rows[i]["ruta"]
        label = LABELS.index(self.rows[i]["etiqueta"])
        if self.train:
            return TRAIN_TRANSFORM(open_rgb(path)), label
        return torch.from_numpy(load_image(path)), label


def accuracy(model, loader, device):
    model.eval()
    hits = total = 0
    with torch.no_grad():
        for x, y in loader:
            hits += (model(x.to(device)).argmax(1).cpu() == y).sum().item()
            total += len(y)
    return hits / total


def run_phase(name, model, epochs, lr, cosine, loaders, criterion, device, best):
    params = [p for p in model.parameters() if p.requires_grad]
    optimizer = torch.optim.AdamW(params, lr=lr)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, epochs) if cosine else None
    for epoch in range(1, epochs + 1):
        model.train()
        losses = []
        for x, y in loaders["train"]:
            optimizer.zero_grad()
            loss = criterion(model(x.to(device)), y.to(device))
            loss.backward()
            optimizer.step()
            losses.append(loss.item())
        if scheduler:
            scheduler.step()
        val = accuracy(model, loaders["val"], device)
        print(f"{name} época {epoch}/{epochs}  pérdida {np.mean(losses):.3f}  val {val:.3f}")
        if val > best:
            best = val
            torch.save(model.state_dict(), OUT_DIR / "model.pt")
    return best


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--head-epochs", type=int, default=5)
    parser.add_argument("--full-epochs", type=int, default=15)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--workers", type=int, default=2)
    args = parser.parse_args()

    torch.manual_seed(7)
    OUT_DIR.mkdir(exist_ok=True)
    device = "cuda" if torch.cuda.is_available() else "cpu"

    rows = {split: read_manifest(fuente="bracol", particion=split) for split in ("train", "val")}
    loaders = {
        split: DataLoader(
            Leaves(rows[split], train=split == "train"),
            batch_size=args.batch_size,
            shuffle=split == "train",
            num_workers=args.workers,
        )
        for split in rows
    }
    counts = Counter(r["etiqueta"] for r in rows["train"])
    weights = torch.tensor([len(rows["train"]) / (len(LABELS) * counts[label]) for label in LABELS])
    criterion = nn.CrossEntropyLoss(weight=weights.float().to(device), label_smoothing=0.1)
    print(f"dispositivo {device}  train {len(rows['train'])}  val {len(rows['val'])}  {dict(counts)}")

    model = build_model(pretrained=True).to(device)
    head = model.get_classifier()
    for p in model.parameters():
        p.requires_grad = False
    for p in head.parameters():
        p.requires_grad = True
    best = run_phase("cabeza", model, args.head_epochs, 1e-3, False, loaders, criterion, device, 0.0)

    for p in model.parameters():
        p.requires_grad = True
    best = run_phase("completa", model, args.full_epochs, 1e-4, True, loaders, criterion, device, best)
    print(f"mejor val {best:.3f} -> {OUT_DIR / 'model.pt'}")


if __name__ == "__main__":
    main()
