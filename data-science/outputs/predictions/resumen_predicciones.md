# Predicción de septiembre y recomendaciones de inventario

> Generado por `src/predict.py` con la información disponible al **31 de agosto de 2026**.
>
> **Ejercicio académico.** Las ventas históricas son simuladas. El stock de los 9 productos del
> sistema es real; el de los 41 sintéticos, simulado. La inversión es una estimación, no una
> orden de compra.

## Antes de leer las cifras

En el backtesting, el Random Forest **empató con el baseline a 30 días** (MAE 10.20 contra 10.18) y fue **4.2% peor a 7 días**. Las recomendaciones usan el modelo, como se definió en el diseño, pero la predicción del baseline está al lado en `predicciones_septiembre.csv`.

A 30 días, el modelo prevé **2,471 unidades** y el baseline **2,457**: +0.6%.

## Totales

| Métrica | Valor |
|---|---|
| Demanda prevista próximos 7 días | 570.1 unidades |
| Demanda prevista próximos 30 días | 2,470.9 unidades |
| Productos en riesgo alto | 28 |
| Productos en riesgo medio | 6 |
| Productos en riesgo bajo | 16 |
| Productos que requieren compra | 34 de 50 |
| Unidades recomendadas | 1,286 |
| Inversión estimada | L 119,380.60 |

## Por origen

| Origen | Productos | Tipo de stock | Demanda 7d | Demanda 30d | Riesgo alto | Riesgo medio | Riesgo bajo | Requieren compra | Unidades | Inversión |
|---|---|---|---|---|---|---|---|---|---|---|
| sistema | 9.0 | real | 146.0 | 657.9 | 8 | 0 | 1 | 8.0 | 602 | L 77,540.00 |
| sintético | 41.0 | simulado | 424.1 | 1,813.0 | 20 | 6 | 15 | 26.0 | 684 | L 41,840.60 |

## Top 10 por recomendación de compra

| # | Código | Producto | Origen | Stock | Tipo de stock | Demanda 7d | Demanda 30d | Riesgo | Comprar | Inversión |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | CEM-001 | Cemento gris 42.5 kg | sistema | 60 | real | 45.0 | 205.7 | alto | 196 | L 38,808.00 |
| 2 | PLO-001 | Tubo PVC 1/2" x 6 m | sistema | 45 | real | 35.4 | 149.5 | alto | 145 | L 8,845.00 |
| 3 | FER-036 | Clavo de acero 2-1/2" (libra) | sintético | 46 | simulado | 32.4 | 145.7 | alto | 127 | L 2,667.00 |
| 4 | TOR-001 | Tornillo para madera 1" (caja 100 u) | sistema | 4 | real | 22.6 | 105.2 | alto | 126 | L 3,276.00 |
| 5 | FER-020 | Codo PVC 1/2" x 90° | sintético | 194 | simulado | 52.0 | 239.3 | alto | 96 | L 518.40 |
| 6 | FER-014 | Alambre de amarre (libra) | sintético | 30 | simulado | 23.6 | 99.4 | alto | 94 | L 2,256.00 |
| 7 | FER-018 | Cinta aislante 3/4" x 20 m | sintético | 99 | simulado | 28.4 | 119.0 | alto | 54 | L 918.00 |
| 8 | HER-002 | Cinta métrica 5 m | sistema | 33 | real | 13.8 | 70.0 | alto | 53 | L 2,385.00 |
| 9 | PIN-001 | Pintura acrílica blanca 1 galón | sistema | 18 | real | 9.1 | 47.3 | alto | 41 | L 11,480.00 |
| 10 | FER-021 | Tee PVC 1/2" | sintético | 116 | simulado | 27.7 | 118.5 | alto | 32 | L 211.20 |

## Top 10 por demanda prevista a 30 días

| # | Código | Producto | Origen | Stock | Tipo de stock | Demanda 7d | Demanda 30d | Riesgo | Comprar | Inversión |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | FER-020 | Codo PVC 1/2" x 90° | sintético | 194 | simulado | 52.0 | 239.3 | alto | 96 | L 518.40 |
| 2 | CEM-001 | Cemento gris 42.5 kg | sistema | 60 | real | 45.0 | 205.7 | alto | 196 | L 38,808.00 |
| 3 | PLO-001 | Tubo PVC 1/2" x 6 m | sistema | 45 | real | 35.4 | 149.5 | alto | 145 | L 8,845.00 |
| 4 | FER-036 | Clavo de acero 2-1/2" (libra) | sintético | 46 | simulado | 32.4 | 145.7 | alto | 127 | L 2,667.00 |
| 5 | FER-018 | Cinta aislante 3/4" x 20 m | sintético | 99 | simulado | 28.4 | 119.0 | alto | 54 | L 918.00 |
| 6 | FER-021 | Tee PVC 1/2" | sintético | 116 | simulado | 27.7 | 118.5 | alto | 32 | L 211.20 |
| 7 | TOR-001 | Tornillo para madera 1" (caja 100 u) | sistema | 4 | real | 22.6 | 105.2 | alto | 126 | L 3,276.00 |
| 8 | FER-014 | Alambre de amarre (libra) | sintético | 30 | simulado | 23.6 | 99.4 | alto | 94 | L 2,256.00 |
| 9 | FER-022 | Pegamento PVC 1/4 galón | sintético | 125 | simulado | 20.2 | 88.5 | bajo | 0 | L 0.00 |
| 10 | FER-019 | Bombillo LED 12 W | sintético | 90 | simulado | 20.4 | 76.8 | medio | 7 | L 308.00 |

## Productos del sistema

Los únicos con stock real. Su demanda sigue siendo simulada.

| # | Código | Producto | Origen | Stock | Tipo de stock | Demanda 7d | Demanda 30d | Riesgo | Comprar | Inversión |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | CEM-001 | Cemento gris 42.5 kg | sistema | 60 | real | 45.0 | 205.7 | alto | 196 | L 38,808.00 |
| 2 | CER-001 | Candado de bronce 40 mm | sistema | 3 | real | 6.0 | 21.9 | alto | 23 | L 2,116.00 |
| 3 | CER-023 | Candado de bronce 40 mm | sistema | 60 | real | 6.2 | 26.4 | bajo | 0 | L 0.00 |
| 4 | ELE-001 | Cable THHN #12 (rollo 100 m) | sistema | 0 | real | 2.6 | 7.4 | alto | 11 | L 9,790.00 |
| 5 | HER-001 | Martillo de uña 16 oz | sistema | 24 | real | 5.2 | 24.6 | alto | 7 | L 840.00 |
| 6 | HER-002 | Cinta métrica 5 m | sistema | 33 | real | 13.8 | 70.0 | alto | 53 | L 2,385.00 |
| 7 | PIN-001 | Pintura acrílica blanca 1 galón | sistema | 18 | real | 9.1 | 47.3 | alto | 41 | L 11,480.00 |
| 8 | PLO-001 | Tubo PVC 1/2" x 6 m | sistema | 45 | real | 35.4 | 149.5 | alto | 145 | L 8,845.00 |
| 9 | TOR-001 | Tornillo para madera 1" (caja 100 u) | sistema | 4 | real | 22.6 | 105.2 | alto | 126 | L 3,276.00 |

## Reglas

| Concepto | Fórmula |
|---|---|
| Stock de seguridad | `techo(promedio diario de los últimos 28 días × 7)` |
| Necesidad | `demanda prevista 30d + stock de seguridad − stock actual` |
| Recomendación | `máximo(0, techo(necesidad))` |
| Inversión estimada | `recomendación × costo` |
| Riesgo **alto** | `stock actual < demanda prevista 30d` — no alcanza para el mes |
| Riesgo **medio** | `demanda 30d ≤ stock < demanda 30d + seguridad` — cubre el mes, pero no el colchón |
| Riesgo **bajo** | `stock ≥ demanda 30d + seguridad` — cubre el mes y el colchón |
| Stock simulado | `redondeo(venta diaria media de enero a agosto × días de cobertura)`, con días de cobertura sorteados entre 5 y 50 con semilla fija por producto |

Riesgo bajo equivale exactamente a recomendación cero: los productos que requieren compra son los de
riesgo alto y medio.

## Validaciones

| Comprobación | Resultado |
|---|---|
| 50 predicciones | ✅ |
| 50 recomendaciones | ✅ |
| los 50 productos del catálogo, sin faltantes | ✅ |
| identificadores únicos | ✅ |
| sin valores vacíos | ✅ |
| ninguna predicción negativa | ✅ |
| ninguna recomendación negativa | ✅ |
| stock no negativo | ✅ |
| inversión no negativa | ✅ |
| sin valores infinitos | ✅ |
| fecha de corte 2026-08-31 en todas | ✅ |
| stock real solo en los 9 del sistema | ✅ |
| riesgo bajo ⇔ recomendación cero | ✅ |
| variables sin información futura (verificado en train.py) | ✅ |

## Limitaciones

- **La proporción de riesgo alto la fijan las reglas de stock, no el modelo.** Riesgo alto (`stock < demanda 30d`) equivale, por definición, a tener menos de 30 días de cobertura. En los sintéticos, el stock se simuló con entre 5 y 50 días, así que el rango elegido decide cuántos caen ahí: 20 de 41. De los 9 del sistema, 8 están en riesgo alto porque su stock real es de demostración: CEM-001 tiene 60 unidades frente a 206 previstas.
- **Demanda simulada y stock real mezclados.** En los 9 productos del sistema, el stock sale de
  Supabase y la demanda de la simulación. Que el cemento aparezca en riesgo no dice nada sobre la
  bodega real: dice que 60 bolsas no alcanzan para la demanda simulada.
- **El stock real es del 16 de septiembre** (fecha de la extracción) y la predicción se hace al 31 de
  agosto.
- **El modelo no supera al baseline.** Las recomendaciones serían muy parecidas con la media de 28 días.
- **No considera** tiempos de entrega por proveedor, lotes mínimos de compra ni presupuesto.
