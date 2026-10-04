# Conjunto dorado

20–30 fotos propias de hojas sobre un plato, hechas con el Android de la demo. Varias
deben dar "duda" (hojas que no son de café, fotos dudosas, síntomas que el modelo no conoce).

Poner las fotos en esta carpeta y listarlas en `labels.csv`:

```csv
archivo,esperado
sana_01.jpg,sana
roya_01.jpg,roya
limon_01.jpg,duda
```

`esperado` es una de: sana, roya, minador, cercospora, phoma, duda.
`python ml/evaluate.py` las pasa por el modelo int8 y reporta "N de M".
Las hojas impresas o sintéticas se nombran como tales (`impresa_roya_01.jpg`).
