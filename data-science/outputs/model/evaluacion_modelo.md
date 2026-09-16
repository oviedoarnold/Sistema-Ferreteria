# Evaluación del modelo de demanda

> Generado por `src/train.py`. Todas las cifras se calculan al ejecutar el script.
>
> **Los datos históricos son sintéticos** y el modelo aprende parcialmente la estructura del
> generador. Por ello, las métricas pueden ser más optimistas que las obtenidas con ventas reales.

## Problema

Predecir cuántas unidades de cada producto se venderán en los próximos días, para decidir
cuánto reponer. No se predice ingreso: la decisión de compra se toma en unidades.

## Objetivos

Cada predicción se hace **al cierre del día t**, con las ventas de t y anteriores ya registradas.

| Objetivo | Definición |
|---|---|
| `demanda_7d` | Unidades vendidas del día **t+1 al t+7** |
| `demanda_30d` | Unidades vendidas del día **t+1 al t+30** |

Se predice la suma directamente, no día por día. Encadenar 30 predicciones diarias haría que
el error de cada día se arrastrara al siguiente.

Las filas cuyo futuro necesario no existe en el historial no tienen objetivo y no se usan.

## Variables

| Grupo | Variables | Definición |
|---|---|---|
| Identidad | `producto_id`, `categoria` | One-hot |
| Calendario | `dia_semana`, `mes`, `dia_mes` | De la fecha t |
| Calendario futuro | `dias_abiertos_7`, `dias_abiertos_30` | Días que abre la ferretería entre t+1 y t+h |
| Historia | `lag_1`, `lag_7`, `lag_14`, `lag_28` | Venta k días antes de t+1; `lag_1` es la venta de t |
| Historia | `media_7`, `media_14`, `media_28` | Promedio de los k días que terminan en t |

`dias_abiertos` mira el futuro, pero solo el calendario, que se conoce de antemano. El 15 de
septiembre se trata como feriado: cae fuera del historial simulado, pero la ferretería no abre.

### Excluidas

| Columna | Por qué no entra |
|---|---|
| `origen` | Solo dice si el producto es del sistema o sintético. No tiene relación con la demanda: el modelo memorizaría una etiqueta administrativa. |
| `precio` | Constante por producto en todo el período. No aporta nada que producto_id no diga ya. |
| `costo` | Constante por producto. Se usa después para calcular la inversión, no para predecir cuánto se vende. |
| `ingreso` | Es cantidad × precio: contiene la misma venta que se quiere predecir. |
| `codigo` | Mismo producto que producto_id, en otro formato. |
| `producto` | Mismo producto que producto_id, en otro formato. |
| `fin_de_semana` | Redundante con dia_semana. Además, una ventana de 7 días siempre contiene exactamente un sábado. |
| `rotacion` | No está en el dataset: es un parámetro del generador. Se usa solo para agrupar resultados. |

## Prevención de fuga de información

Tres reglas, y una verificación que las comprueba con datos:

1. **Las variables solo usan días ≤ t.** Las medias móviles incluyen t porque el objetivo empieza en t+1.
2. **Una fila entra al entrenamiento solo si su objetivo ya se conocía al corte:** `t + h ≤ corte`.
   No basta con que t sea anterior al corte. Una fila del 20 de julio tiene como objetivo a 30 días
   las ventas hasta el 19 de agosto, que al 31 de julio todavía no existen.
3. **El one-hot y el bosque se ajustan dentro del pipeline**, con las filas de entrenamiento de cada
   corte y nada más.

**Verificación** (`features.verificar_sin_fuga`, 200 filas al azar):

| Comprobación | Resultado |
|---|---|
| Reemplazar toda la venta posterior a t no cambia ninguna variable de la fila t | ✅ |
| Reemplazar la venta de t y anteriores no cambia el objetivo de la fila t | ✅ |
| El objetivo es exactamente la suma de t+1 a t+h | ✅ |

**La verificación se prueba a sí misma en cada ejecución.** Una verificación que siempre dice
"sin fuga" no demostraría nada, así que se le inyectan tres fugas y se exige que las detecte:

| Fuga inyectada | ¿Detectada? |
|---|---|
| Media móvil centrada, que mira tres días al futuro | ✅ |
| `lag_1` que toma la venta de mañana | ✅ |
| Objetivo que incluye el día t | ✅ |

## Modelo

`RandomForestRegressor` dentro de un `Pipeline` de scikit-learn 1.7.1, uno por horizonte:

| Parámetro | Valor | Por qué |
|---|---|---|
| `n_estimators` | 200 | Suficientes árboles para que el promedio sea estable |
| `min_samples_leaf` | 5 | Con 47% de ceros, hojas de una fila memorizarían días sueltos |
| `max_features` | 0.5 | Cada árbol mira una parte distinta de las variables |
| `random_state` | 42 | Reproducible |

**No hubo búsqueda de hiperparámetros.** La configuración se fijó antes de ver resultados. Con un
solo período de evaluación, elegir la que mejor sale en agosto y reportar su error en agosto
sería medir el modelo contra los mismos datos con los que se eligió.

## Baseline

`baseline_h(t) = promedio diario de los 28 días que terminan en t × h`

Es lo que haría una persona con una hoja de cálculo. Si el modelo no la supera, no aporta.

## Evaluación

### Entrenamiento con enero a julio, prueba en agosto

El modelo se entrena con lo conocido al cierre del 31 de julio y predice desde cada día de agosto
que tenga su futuro completo.

#### A 7 días (orígenes del 1 al 24 de agosto)

1,200 predicciones · demanda real total 13,540 unidades

| | MAE (unidades) | RMSE | WAPE |
|---|---|---|---|
| Baseline (media 28 días × h) | 3.69 | 5.55 | 32.8% |
| Random Forest | 3.80 | 5.81 | 33.6% |
| **Mejora del modelo** | **-2.7%** | **-4.7%** | **-2.7%** |

#### A 30 días (solo el 1 de agosto)

50 predicciones · demanda real total 2,374 unidades

| | MAE (unidades) | RMSE | WAPE |
|---|---|---|---|
| Baseline (media 28 días × h) | 12.68 | 19.45 | 26.7% |
| Random Forest | 10.13 | 13.55 | 21.3% |
| **Mejora del modelo** | **+20.1%** | **+30.4%** | **+20.1%** |

A 30 días agosto deja una sola fecha evaluable: 50 predicciones, una por
producto. Es válido pero es poco, y por eso la evaluación principal es el backtesting.

### Backtesting de origen móvil

Un corte cada 7 días desde el 01/05/2026, mientras quede el futuro completo
del horizonte dentro del historial. En cada corte se entrena un modelo nuevo solo con lo conocido
hasta ese día, se predice, y se avanza una semana.

| Horizonte | Cortes | Primer corte | Último corte | Predicciones |
|---|---|---|---|---|
| 7 días | 17 | 2026-05-01 | 2026-08-21 | 850 |
| 30 días | 14 | 2026-05-01 | 2026-07-31 | 700 |

Todos los cortes cumplen que el último día de objetivo usado para entrenar es anterior o igual al
corte: ✅ verificado en cada uno.

#### A 7 días

850 predicciones · demanda real total 9,724 unidades

| | MAE (unidades) | RMSE | WAPE |
|---|---|---|---|
| Baseline (media 28 días × h) | 3.78 | 5.73 | 33.0% |
| Random Forest | 3.94 | 5.92 | 34.4% |
| **Mejora del modelo** | **-4.2%** | **-3.4%** | **-4.2%** |

#### A 30 días

700 predicciones · demanda real total 33,687 unidades

| | MAE (unidades) | RMSE | WAPE |
|---|---|---|---|
| Baseline (media 28 días × h) | 10.18 | 14.77 | 21.2% |
| Random Forest | 10.20 | 15.10 | 21.2% |
| **Mejora del modelo** | **-0.2%** | **-2.2%** | **-0.2%** |

**Advertencia sobre independencia:** a 30 días, cortes separados por 7 días producen ventanas que
se solapan en 23 días. Los errores de cortes vecinos están correlacionados, así que el backtesting
da una estimación más estable que un solo corte, pero no 700 observaciones independientes.

## Interpretación

- A 7 días **el baseline es mejor**: se equivoca en 3.8 unidades por predicción, frente a 3.9 del Random Forest (4.2% más error del modelo).
- A 30 días **empatan en la práctica**: 10.18 unidades de error del baseline frente a 10.20 del Random Forest, una diferencia de 0.2%. El modelo no mejora al baseline.

### Por qué el modelo no supera al baseline

- **El modelo redescubre el baseline.** El 86% de su importancia a 30 días (y el 84% a 7) está en las tres medias móviles. El producto, la categoría y el calendario aportan poco más. *Explicación probable, no comprobada por separado:* un bosque aproxima con escalones una relación casi proporcional —la demanda futura se parece a la media reciente por el horizonte—, y eso puede costarle precisión frente a la multiplicación exacta del baseline.
- **Predice de más.** El sesgo medio a 30 días es +2.02 unidades para el modelo y +1.27 para el baseline. *Explicación consistente con los datos, no comprobada por separado:* el backtesting evalúa de mayo a agosto, temporada de lluvias, con modelos entrenados en parte con la temporada seca, que vende más; la media de 28 días solo mira lo reciente.
- **Una sola fecha de evaluación habría engañado.** Evaluando solo el 1 de agosto, el modelo parece mejorar el MAE en +20.1%. Con 14 cortes, la mejora es -0.2%. Es exactamente la razón para hacer backtesting.
- **Donde sí aporta:** rotación baja a 7 días (+2.1% de MAE) y rotación baja a 30 días (+9.1% de MAE). *Explicación probable, no comprobada por separado:* con ventas escasas la media de 28 días de un solo producto es ruidosa, y el modelo puede suavizarla con lo que aprende del conjunto.

### Por rotación

La rotación no es una variable del modelo; se usa solo para agrupar los resultados del backtesting.

| Horizonte | Rotación | Predicciones | MAE baseline | MAE RF | Mejora MAE | WAPE baseline | WAPE RF |
|---|---|---|---|---|---|---|---|
| 7 días | alta | 187 | 7.81 | 8.26 | -5.8% | 26.3% | 27.9% |
| 7 días | media | 442 | 3.23 | 3.36 | -4.0% | 38.8% | 40.4% |
| 7 días | baja | 221 | 1.47 | 1.44 | +2.1% | 64.5% | 63.1% |
| 30 días | alta | 154 | 19.79 | 19.95 | -0.8% | 15.9% | 16.0% |
| 30 días | media | 364 | 9.19 | 9.34 | -1.6% | 26.2% | 26.6% |
| 30 días | baja | 182 | 4.04 | 3.67 | +9.1% | 42.7% | 38.8% |

- A 7 días, el error proporcional del modelo es menor en rotación **alta** (27.9%) y mayor en rotación **baja** (63.1%).
- A 30 días, el error proporcional del modelo es menor en rotación **alta** (16.0%) y mayor en rotación **baja** (38.8%).

### Productos difíciles (30 días, backtesting)

Por producto, a lo largo de todos los cortes. **"Real total" y "Predicho total" suman ventanas
de 30 días que se solapan**: sirven para comparar lo real contra lo predicho, pero no son la venta
del período. Para comparar productos entre sí, usar MAE y WAPE.

**Mayor error en unidades** — los que más venden:

| Código | Producto | Rotación | Real total | Predicho total | MAE RF | MAE baseline | WAPE RF |
|---|---|---|---|---|---|---|---|
| TOR-001 | Tornillo para madera 1" (caja 100 u) | alta | 1,921 | 1,945.1 | 35.21 | 31.80 | 26% |
| FER-020 | Codo PVC 1/2" x 90° | alta | 3,147 | 2,750.9 | 30.21 | 23.32 | 13% |
| FER-036 | Clavo de acero 2-1/2" (libra) | alta | 1,851 | 1,881.0 | 29.14 | 27.05 | 22% |
| FER-034 | Brocha 3" | media | 663 | 906.6 | 22.43 | 14.95 | 47% |
| CEM-001 | Cemento gris 42.5 kg | alta | 2,691 | 2,742.2 | 21.21 | 22.13 | 11% |

**Mayor error proporcional** — los de venta escasa:

| Código | Producto | Rotación | Real total | Predicho total | MAE RF | MAE baseline | WAPE RF |
|---|---|---|---|---|---|---|---|
| FER-050 | Pegamento epóxico 2 componentes | baja | 157 | 259.0 | 7.37 | 6.31 | 66% |
| FER-031 | Rotomartillo SDS 800 W | baja | 25 | 27.2 | 1.16 | 1.75 | 65% |
| FER-049 | Adhesivo de contacto 1/4 galón | media | 179 | 277.9 | 7.83 | 7.05 | 61% |
| FER-030 | Sierra circular 7-1/4" | baja | 31 | 30.1 | 1.28 | 1.33 | 58% |
| FER-027 | Llave ajustable 10" | baja | 256 | 303.9 | 10.30 | 9.83 | 56% |

**Menor error proporcional:**

| Código | Producto | Rotación | Real total | Predicho total | MAE RF | MAE baseline | WAPE RF |
|---|---|---|---|---|---|---|---|
| FER-017 | Breaker 20 A enchufable | media | 344 | 373.3 | 2.22 | 3.76 | 9% |
| FER-022 | Pegamento PVC 1/4 galón | alta | 1,139 | 1,161.4 | 8.26 | 13.28 | 10% |
| PLO-001 | Tubo PVC 1/2" x 6 m | alta | 1,902 | 1,745.0 | 13.84 | 12.31 | 10% |
| FER-018 | Cinta aislante 3/4" x 20 m | alta | 1,437 | 1,338.2 | 10.55 | 11.98 | 10% |
| CEM-001 | Cemento gris 42.5 kg | alta | 2,691 | 2,742.2 | 21.21 | 22.13 | 11% |

**Herramientas eléctricas y demás productos de baja rotación:**

| Código | Producto | Rotación | Real total | Predicho total | MAE RF | MAE baseline | WAPE RF |
|---|---|---|---|---|---|---|---|
| ELE-001 | Cable THHN #12 (rollo 100 m) | baja | 108 | 153.1 | 4.01 | 5.26 | 52% |
| FER-012 | Impermeabilizante acrílico 1 galón | baja | 240 | 213.7 | 3.10 | 4.21 | 18% |
| FER-024 | Grifo metálico para lavamanos | baja | 136 | 156.4 | 2.40 | 2.52 | 25% |
| FER-027 | Llave ajustable 10" | baja | 256 | 303.9 | 10.30 | 9.83 | 56% |
| FER-028 | Taladro percutor 1/2" 750 W | baja | 51 | 60.0 | 1.41 | 2.11 | 39% |
| FER-029 | Pulidora angular 4-1/2" | baja | 41 | 32.6 | 1.18 | 1.44 | 40% |
| FER-030 | Sierra circular 7-1/4" | baja | 31 | 30.1 | 1.28 | 1.33 | 58% |
| FER-031 | Rotomartillo SDS 800 W | baja | 25 | 27.2 | 1.16 | 1.75 | 65% |
| FER-040 | Cerradura de pomo para puerta | baja | 165 | 186.6 | 3.82 | 4.72 | 32% |
| FER-043 | Rastrillo metálico 16 dientes | baja | 148 | 179.5 | 5.43 | 5.75 | 51% |
| FER-044 | Manguera de jardín 1/2" x 15 m | baja | 176 | 147.7 | 3.45 | 4.10 | 27% |
| FER-047 | Casco de seguridad | baja | 186 | 215.5 | 2.80 | 3.13 | 21% |
| FER-050 | Pegamento epóxico 2 componentes | baja | 157 | 259.0 | 7.37 | 6.31 | 66% |

En **18 de 50 productos** el baseline tiene menor MAE que el modelo: TOR-001, FER-020, FER-036, FER-034, HER-002, FER-010, FER-014, FER-011, FER-042, PLO-001, FER-038, FER-045, FER-027, FER-013, FER-048, FER-049, FER-050, FER-032.

### Qué variables usa el modelo

Importancia por reducción de impureza del modelo final, agrupada por variable original. Favorece a
las variables con muchos valores posibles: indica qué usa el modelo, no qué causa la demanda.

| Variable | 7 días | 30 días |
|---|---|---|
| `media_28` | 50.8% | 52.1% |
| `media_14` | 20.2% | 21.0% |
| `media_7` | 13.0% | 13.2% |
| `producto_id` | 4.3% | 5.3% |
| `categoria` | 1.9% | 2.1% |
| `mes` | 2.6% | 1.9% |
| `lag_7` | 1.8% | 1.3% |
| `lag_1` | 0.9% | 1.1% |
| `lag_14` | 0.8% | 0.7% |
| `lag_28` | 1.1% | 0.6% |
| `dias_abiertos_30` | 0.0% | 0.4% |
| `dia_mes` | 1.7% | 0.3% |
| `dia_semana` | 0.3% | 0.1% |

## Limitaciones

- **Datos sintéticos.** El historial lo produjo un generador con reglas conocidas, y el modelo aprende
  en parte esas reglas. Con ventas reales el error sería mayor.
- **Ocho meses de historia.** El modelo ve una temporada seca y una de lluvias, pero no un año
  completo: no puede aprender estacionalidad anual.
- **Ventanas solapadas en el backtesting a 30 días.** Las predicciones no son independientes.
- **Baja rotación.** Con ventas de a una unidad y semanas sin venta, un error de dos unidades es
  un error proporcional enorme, y ningún modelo lo resuelve con este volumen de datos.
