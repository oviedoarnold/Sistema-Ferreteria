# Ciencia de Datos — Demanda e Inventario

Parte del **Sistema Ferretería**. Convierte el historial de ventas en una
predicción de demanda y en una recomendación de cuánto reponer de cada producto.

## Objetivo

Predecir cuántas unidades de cada producto se van a vender en los próximos 7 y
30 días, y a partir de eso recomendar cuánto comprar.

## Problema

La ferretería sabe cuánto tiene en bodega, pero no cuánto va a necesitar. Hoy la
reposición se decide mirando el stock: se compra cuando algo se acaba, o cuando
cae por debajo de un mínimo fijo.

Eso falla en los dos sentidos. Un producto que se vende rápido se agota antes de
llegar al mínimo, y uno que casi no se mueve se vuelve a comprar aunque el stock
alcance para meses. Conocer la demanda esperada permite comprar a tiempo y no de
más.

## Fuente de datos

> **9 productos son reales. 41 son sintéticos. Todas las ventas son simuladas.**

| | Origen |
|---|---|
| **9 productos** | **Reales.** Los productos activos del Sistema Ferretería, sin ninguna modificación. Instantánea del 2026-09-16 en `data/raw/productos_sistema.csv` |
| **41 productos** | **Sintéticos académicos**, en `data/raw/productos_sinteticos.csv`. Artículos típicos de una ferretería hondureña. Nombres, códigos, precios y costos son propios del análisis. **No existen en Supabase.** |
| **Ventas** | **Simuladas** para los 50 productos. La base real tiene 7 ventas en 3 fechas, insuficientes para calcular siquiera un promedio semanal. |
| **Período** | 2026-01-01 a 2026-08-31 (243 días) |
| **Semilla** | `42` |

**Ningún resultado de esta carpeta debe presentarse como dato real de ventas.**

### Por qué se amplió el catálogo a 50 productos

El Sistema Ferretería está en desarrollo y hoy tiene 9 productos. Con ellos:

- **No se representa el surtido de una ferretería**, que maneja desde codos de PVC
  de L9 hasta rotomartillos de casi L4,000, con comportamientos de venta muy
  distintos.
- **La categoría no aportaba nada.** Cinco de las siete categorías tenían un solo
  producto, así que la categoría repetía exactamente lo que ya decía el producto.
- **No había variedad de perfiles** para que un modelo aprenda a distinguir un
  consumible que se vende a diario de un equipo que se vende de vez en cuando.

Se completó hasta 50 con productos sintéticos: 11 categorías, todas con entre 3
y 6 productos, y tres perfiles de rotación. **Los 41 productos nuevos existen solo
en esta carpeta.** No se insertaron en Supabase, ni se creó inventario, ventas o
movimientos para ellos. Los 9 productos reales no se modificaron.

Los productos sintéticos se inspiran en el surtido habitual de una ferretería
hondureña, pero **no copian ningún catálogo comercial**: no se hizo scraping, no
se usan códigos de ninguna tienda, y los precios no afirman ser los de nadie.

### Cómo se simulan las ventas

No se sortean números independientes, ni se aplica una misma curva multiplicada
por una constante. Cada producto combina:

- su **rotación** (alta, media, baja), que fija cuánto se vende y cuán a ráfagas;
- su **categoría**, que fija la forma de la semana y de la temporada — Jardinería,
  por ejemplo, sube con las lluvias justo cuando la construcción baja;
- **parámetros propios** sorteados con su propia semilla: cuánto reacciona a la
  temporada, si crece o decae, y pequeñas variaciones por día.

La cantidad se sortea con una binomial negativa, que reproduce la variabilidad
real de un comercio. Cada parámetro está justificado en `src/generate_dataset.py`
y resumido en el [diccionario de datos](data/processed/diccionario_datos.md).

## Pipeline

```
productos_sistema.csv ──┐
                        ├─→ catálogo ─→ Generación ─→ ETL ─→ EDA ─→ Modelo ─→ Predicción ─→ Recomendación ─→ Dashboard
productos_sinteticos.csv┘   (50)            │          │       │
                                         tickets    demanda  gráficas
                                         crudos     diaria   y resumen
```

| Etapa | Script | Entrada | Salida | Estado |
|---|---|---|---|---|
| Catálogo | `src/catalogo.py` | los dos CSV de productos | 50 productos validados | ✅ |
| Generación | `src/generate_dataset.py` | catálogo | `data/raw/ventas_simuladas_2026.csv` | ✅ |
| ETL | `src/etl.py` | tickets crudos | `data/processed/demanda_diaria.csv` + `outputs/reporte_calidad.json` | ✅ |
| EDA | `src/eda.py` | demanda diaria | `outputs/eda/*.png` + `outputs/eda/resumen_eda.md` | ✅ |
| Variables | `src/features.py` | demanda diaria | variables, objetivos y baseline | ✅ |
| Modelo | `src/train.py` | variables | `models/*.joblib` + `outputs/model/` | ✅ |
| Recomendación | `src/predict.py` | modelos + stock | `outputs/predictions/` | ✅ |
| Exportación | `src/export_dashboard.py` | recomendaciones + demanda diaria + métricas | `../public/data/predicciones-inventario.json` | ✅ |
| Dashboard | Sistema Ferretería (React) | JSON publicado | sección del Dashboard | ✅ |

## Ejecución

Requiere **Python 3.12**. Desde esta carpeta (`data-science/`):

```bash
pip install -r requirements.txt

python src/generate_dataset.py
python src/etl.py
python src/eda.py
python src/train.py      # evaluación completa y modelos finales, ~1 min
python src/predict.py    # predicción de septiembre y recomendaciones
python src/export_dashboard.py  # JSON que lee el Dashboard
```

Cada script lee lo que produjo el anterior. Se pueden volver a ejecutar en
cualquier momento: sobrescriben sus salidas y, con la semilla 42, producen
**exactamente los mismos archivos**.

## Resultados: datos

### Calidad del ETL

| Métrica | Valor |
|---|---|
| Productos | 50 (9 del sistema, 41 sintéticos) |
| Categorías | 11 |
| Filas crudas | 11,194 |
| Filas procesadas | 12,150 (243 días × 50 productos) |
| Nulos en el procesado | 0 |
| Duplicados fecha-producto | 0 |
| Cantidades o ingresos negativos | 0 |
| Tickets duplicados quitados | 100 |
| Cantidades inválidas quitadas | 22 |
| Precios recuperados del catálogo | 44 |
| Ingresos recalculados | 33 |
| Registros producto-día sin venta | 5,789 (47.6%) |
| Total de unidades | 20,542 |
| Ingreso total | L 2,651,777.00 |

Los defectos del archivo crudo se **inyectaron a propósito** para que la limpieza
tenga algo que hacer. La prueba de que la limpieza es correcta: después de
quitarlos, el total vuelve a ser exactamente las 20,542 unidades del historial
limpio.

### Hallazgos del EDA

El detalle, con todas las cifras calculadas y el ranking completo, está en
[`outputs/eda/resumen_eda.md`](outputs/eda/resumen_eda.md).

- **Ningún producto domina.** El más vendido, el cemento, es el 8.5% de las
  unidades; hacen falta 23 productos para llegar al 80%.
- **En unidades lidera Plomería (22.6%); en ingreso, Construcción (32.5%).** Las
  unidades no se comparan entre categorías: un codo de PVC y un taladro cuentan
  igual. Herramientas Eléctricas es el 0.5% de las unidades y el 9.0% del ingreso.
- El **sábado** vende 34% más que un día entre semana. El domingo, cero.
- El **47.6%** de los registros no tienen venta: 1,950 por días cerrados y 3,839
  por demanda intermitente con la tienda abierta.
- La **temporada** pesa más que la tendencia: la temporada seca vende 10.7% más
  que la de lluvias.

## Modelo

> **Los datos históricos son sintéticos y el modelo aprende parcialmente la
> estructura del generador. Por ello, las métricas pueden ser más optimistas que
> las obtenidas con ventas reales.**

El detalle completo está en
[`outputs/model/evaluacion_modelo.md`](outputs/model/evaluacion_modelo.md).

### Qué se predice

Cada predicción se hace **al cierre del día t**, con las ventas de t y anteriores
ya registradas.

| Objetivo | Definición |
|---|---|
| `demanda_7d` | Unidades vendidas del día **t+1 al t+7** |
| `demanda_30d` | Unidades vendidas del día **t+1 al t+30** |

Se predice la suma directamente, no día por día: encadenar predicciones diarias
arrastraría el error de cada día al siguiente. No se predice ingreso: la compra
se decide en unidades.

### Variables

| Grupo | Variables |
|---|---|
| Identidad | `producto_id`, `categoria` (one-hot) |
| Calendario | `dia_semana`, `mes`, `dia_mes` |
| Calendario futuro | `dias_abiertos_7` / `dias_abiertos_30`: días que abre la ferretería entre t+1 y t+h |
| Historia | `lag_1`, `lag_7`, `lag_14`, `lag_28`, `media_7`, `media_14`, `media_28` |

**Excluidas:** `origen` (etiqueta administrativa, sin relación con la demanda),
`precio` y `costo` (constantes por producto), `ingreso` (contiene la venta que se
quiere predecir), y la rotación, que ni siquiera está en el dataset.

### Fuga de información

- Las variables solo usan días ≤ t. `dias_abiertos` mira el futuro, pero solo el
  calendario, que se conoce de antemano.
- Una fila entra al entrenamiento solo si su objetivo ya se conocía al corte:
  `t + h ≤ corte`. No basta con que t sea anterior.
- **Se verifica con datos en cada ejecución:** se altera el futuro y se exige que
  ninguna variable cambie, se altera el presente y se exige que el objetivo no
  cambie, y se comprueba que el objetivo sea exactamente la suma de t+1 a t+h.
- **La verificación se prueba a sí misma:** se le inyectan tres fugas conocidas y
  se exige que las detecte. Si no, el entrenamiento se detiene.

### Modelo y baseline

| | Definición |
|---|---|
| **Baseline** | `promedio diario de los 28 días que terminan en t × h` |
| **Modelo** | `RandomForestRegressor(n_estimators=200, min_samples_leaf=5, max_features=0.5, random_state=42)` en un `Pipeline` con `OneHotEncoder` |

La configuración se fijó antes de ver resultados y **no hubo búsqueda de
hiperparámetros**.

### Evaluación

- **Agosto:** entrenamiento con lo conocido al 31 de julio, prueba desde cada día
  de agosto con futuro completo. Son 1,200 predicciones a 7 días, pero solo 50 a
  30 días: una sola fecha.
- **Backtesting de origen móvil** (evaluación principal): un corte cada 7 días
  desde el 1 de mayo; en cada corte se entrena un modelo nuevo solo con lo
  conocido hasta ese día. 17 cortes a 7 días (850 predicciones) y 14 a 30 días
  (700).

### Resultados

**Backtesting:**

| Horizonte | | MAE | RMSE | WAPE |
|---|---|---|---|---|
| 7 días | Baseline | 3.78 | 5.73 | 33.0% |
| 7 días | Random Forest | 3.94 | 5.92 | 34.4% |
| 7 días | **Mejora del modelo** | **−4.2%** | **−3.4%** | **−4.2%** |
| 30 días | Baseline | 10.18 | 14.77 | 21.2% |
| 30 días | Random Forest | 10.20 | 15.10 | 21.2% |
| 30 días | **Mejora del modelo** | **−0.2%** | **−2.2%** | **−0.2%** |

**El Random Forest no supera al baseline.** A 7 días se equivoca algo más; a 30
días empatan en la práctica.

- **El modelo redescubre el baseline:** el 86% de su importancia está en las tres
  medias móviles.
- **Predice de más:** sesgo medio de +2.02 unidades a 30 días, frente a +1.27 del
  baseline.
- **Donde sí aporta es en baja rotación:** +9.1% de MAE a 30 días y +2.1% a 7.
- **Una sola fecha habría engañado:** evaluando solo el 1 de agosto, el modelo
  parecía mejorar el MAE a 30 días en un 20.1%. Con 14 cortes, la mejora es −0.2%.

Estos resultados se reportan tal como salieron. No se modificaron los datos, los
parámetros de simulación ni el modelo después de verlos.

## Predicción de septiembre y recomendaciones

El detalle está en
[`outputs/predictions/resumen_predicciones.md`](outputs/predictions/resumen_predicciones.md).
El archivo del que parte el Dashboard es
[`outputs/predictions/recomendaciones_inventario.csv`](outputs/predictions/recomendaciones_inventario.csv).

Con la información al **31 de agosto de 2026** y los modelos finales, entrenados
con todo el historial:

| Métrica | Valor |
|---|---|
| Demanda prevista próximos 7 días | 570.1 unidades |
| Demanda prevista próximos 30 días | 2,470.9 unidades |
| Riesgo alto · medio · bajo | 28 · 6 · 16 |
| Productos que requieren compra | 34 de 50 |
| Unidades recomendadas | 1,286 |
| Inversión estimada | L 119,380.60 |

### Stock

| Productos | Stock | Origen |
|---|---|---|
| 9 del sistema | **Real** | Vista `stock_actual` de Supabase, instantánea del 16 de septiembre en `data/raw/stock_sistema.csv` |
| 41 sintéticos | **Simulado** | `redondeo(venta diaria media de enero a agosto × días de cobertura)`, con días sorteados entre 5 y 50 y semilla fija por producto |

El stock simulado **no está en Supabase**, y la columna `tipo_stock` lo distingue
en cada fila.

### Reglas

| Concepto | Fórmula |
|---|---|
| Stock de seguridad | `techo(promedio diario de los últimos 28 días × 7)` |
| Recomendación | `máximo(0, techo(demanda prevista 30d + stock de seguridad − stock actual))` |
| Inversión estimada | `recomendación × costo` |
| Riesgo **alto** | `stock < demanda 30d` — no alcanza para el mes |
| Riesgo **medio** | `demanda 30d ≤ stock < demanda 30d + seguridad` — cubre el mes, no el colchón |
| Riesgo **bajo** | `stock ≥ demanda 30d + seguridad` — cubre el mes y el colchón |

Riesgo bajo equivale exactamente a recomendación cero, y se verifica en cada
ejecución.

## Integración con el Dashboard

```
Python (data-science/) ─→ public/data/predicciones-inventario.json ─→ React: Dashboard
```

`src/export_dashboard.py` toma las recomendaciones, la demanda diaria y las
métricas del modelo, y escribe un solo JSON en `public/data/` del Sistema
Ferretería. Vite lo publica como archivo estático y el Dashboard (`/dashboard`)
lo lee con `fetch`, en el bloque **Análisis y proyección**, debajo de los
indicadores de la operación.

El JSON contiene:

| Parte | Contenido |
|---|---|
| `metadata` | modelo (Random Forest), fecha de corte, período histórico, período proyectado, horizontes, cantidad de productos por origen y la aclaración del escenario académico |
| `resumen` | demanda total a 7 y 30 días, productos por riesgo, productos con compra, unidades e inversión — calculado a partir del detalle |
| `serie_mensual` | unidades históricas de enero a agosto y la demanda proyectada de los 30 días siguientes, marcada como `proyeccion` |
| `productos` | los 50 productos con origen, tipo de stock, demanda prevista, riesgo, recomendación, inversión y `historico_mensual`: sus unidades vendidas en cada mes de enero a agosto |

Septiembre es **un solo valor**, la demanda acumulada que predice el modelo: no
se dibuja una curva diaria que el modelo no produjo.

Antes de escribir, el script **valida el resultado** y se detiene si algo no
cuadra: 50 productos sin repetir (9 del sistema y 41 simulados), sin negativos
ni valores no finitos, stock real solo en los productos del sistema, riesgos
válidos, resumen igual al detalle, la proyección igual a la demanda a 30 días,
y el histórico de cada producto sumando exactamente la serie mensual.
Las pruebas del Sistema Ferretería repiten las comprobaciones esenciales sobre
el archivo publicado, así que el CI detecta un JSON editado a mano.

El archivo no lleva fecha de generación: dos ejecuciones producen el mismo JSON
byte a byte.

### Por qué un JSON estático

- **Sin servidor de Python.** El Sistema Ferretería sigue siendo una aplicación
  estática en Vercel; no hay un proceso más que mantener ni que pueda caerse.
- **Sin cambios en Supabase.** No se creó una tabla de predicciones ni se
  insertaron productos, ventas o stock simulados. La base operativa queda
  intacta.
- **Lo analítico separado de lo operativo.** Las ventas simuladas nunca se
  mezclan con las reales, ni con el inventario, el Kardex o las facturas.
- **Demostración sencilla.** Funciona igual en local y en producción, sin
  credenciales adicionales.
- **Reproducible.** El archivo publicado es una salida más del pipeline, con
  versión en git.

### Cómo lo usa el Dashboard

- **Filtros de categoría y riesgo**, combinables. Todo se recalcula en el
  navegador sobre el detalle ya cargado: sin otra petición, sin Python y sin
  volver a ejecutar el modelo. Sin filtros, las cifras son exactamente el
  `resumen` publicado; una prueba lo comprueba en cada combinación posible.
- **Histórico filtrado.** Cada mes es la suma de `historico_mensual` de los
  productos filtrados, y septiembre la suma de su demanda predicha a 30 días.
  El riesgo es una clasificación del inventario actual: filtrar por riesgo alto
  muestra el histórico de los productos que hoy están en riesgo alto.
- **Filtrar desde las gráficas.** Un clic en la dona de riesgo o en una barra de
  inversión por categoría aplica ese filtro; los selectores hacen lo mismo con
  el teclado.
- **Fuentes separadas.** Los filtros solo afectan la proyección. Las ventas
  registradas, el stock y los clientes vienen de Supabase y no se recalculan.

El bloque es independiente del resto: si el JSON no carga, muestra un aviso y
los indicadores operativos siguen funcionando. Es visible para quien puede
entrar al Dashboard, sin un permiso aparte.

La interfaz no muestra que el escenario es académico ni qué productos son
simulados: eso se explica en esta documentación y en la defensa. Los datos
siguen marcados en el JSON (`origen`, `tipo_stock`, `metadata.escenario`),
y los componentes no dependen de esas marcas: con datos reales solo cambiaría
el pipeline que genera el archivo.

### Actualización futura

Con ventas reales, el JSON dejaría de alcanzar: habría que regenerar la
predicción con cada cierre. Las opciones naturales son un pipeline programado
que vuelva a entrenar y publicar, una API que sirva la predicción, o una tabla
analítica en Supabase que llene un proceso periódico. **Nada de esto está
implementado**; hoy el JSON se regenera a mano ejecutando el pipeline.

**Deuda técnica: el JSON es público.** Cualquiera puede descargar
`/data/predicciones-inventario.json` sin iniciar sesión. Con el escenario
académico no expone datos del negocio, pero con ventas y costos reales habría
que servirlo con autenticación, por ejemplo desde Supabase con sus políticas.

## Limitaciones

- **Datos sintéticos.** El historial lo produjo un generador con reglas
  conocidas, y el modelo aprende en parte esas reglas. Con ventas reales el error
  sería mayor.
- **El modelo no supera al baseline.** Las recomendaciones serían muy parecidas
  con la media de 28 días; las predicciones del baseline se guardan al lado.
- **Ocho meses de historia.** El modelo ve una temporada seca y una de lluvias,
  pero no puede aprender estacionalidad anual.
- **Ventanas solapadas.** A 30 días, cortes separados por 7 días se solapan en 23:
  las 700 predicciones del backtesting no son independientes.
- **Baja rotación.** El error proporcional supera el 50% en varios productos. Con
  ventas de a una unidad, ningún modelo lo resuelve con este volumen de datos.
- **La proporción de riesgo alto la fijan las reglas de stock, no el modelo.**
  Riesgo alto equivale a menos de 30 días de cobertura; en los sintéticos, el
  rango de stock simulado decide cuántos caen ahí, y el stock real de los 9 del
  sistema es de demostración.
- **Stock real con demanda simulada.** En los 9 productos del sistema se cruzan
  dos fuentes de distinta naturaleza: la recomendación es un ejercicio académico,
  no una orden de compra.

## Reproducibilidad

- Los cinco scripts se ejecutaron dos veces desde cero y produjeron archivos
  **idénticos byte a byte** (mismo hash SHA-256): dataset, gráficas, métricas,
  predicciones, recomendaciones y los dos modelos `.joblib`.
- Las salidas de texto se escriben con saltos de línea LF en cualquier sistema.
- **La demanda de cada producto usa su propia semilla**, derivada de su código.
  Se comprobó que invertir el orden del catálogo produce la misma demanda, y que
  quitar un producto deja intactos los otros 49.

## Estructura

```
data-science/
├── README.md
├── requirements.txt          versiones fijadas
├── data/
│   ├── raw/
│   │   ├── productos_sistema.csv       9 productos reales
│   │   ├── productos_sinteticos.csv    41 productos sintéticos
│   │   ├── stock_sistema.csv           stock real de los 9 del sistema
│   │   └── ventas_simuladas_2026.csv   tickets simulados
│   └── processed/
│       ├── demanda_diaria.csv          dataset para el modelo
│       └── diccionario_datos.md
├── models/
│   ├── random_forest_7d.joblib         modelo final a 7 días
│   └── random_forest_30d.joblib        modelo final a 30 días
├── outputs/
│   ├── reporte_calidad.json
│   ├── model/
│   │   ├── 01_real_vs_predicho_7d.png
│   │   ├── 02_real_vs_predicho_30d.png
│   │   ├── 03_modelo_vs_baseline.png
│   │   ├── 04_error_por_producto.png
│   │   ├── evaluacion_modelo.md
│   │   ├── evaluacion_por_producto.csv
│   │   ├── metricas.json
│   │   └── predicciones_backtest.csv
│   ├── predictions/
│   │   ├── predicciones_septiembre.csv
│   │   ├── recomendaciones_inventario.csv
│   │   └── resumen_predicciones.md
│   └── eda/
│       ├── 01_demanda_tiempo.png
│       ├── 02_productos_mas_vendidos.png
│       ├── 03_demanda_categoria.png
│       ├── 04_demanda_dia_semana.png
│       ├── 05_distribucion_demanda.png
│       └── resumen_eda.md
└── src/
    ├── catalogo.py
    ├── generate_dataset.py
    ├── etl.py
    ├── eda.py
    ├── features.py
    ├── train.py
    ├── predict.py
    └── export_dashboard.py     JSON para el Dashboard
```

Fuera de esta carpeta, el pipeline escribe
`public/data/predicciones-inventario.json`, que publica el Sistema Ferretería.

## Estado

Las predicciones y recomendaciones se muestran en el Dashboard del Sistema
Ferretería a través del JSON publicado. **Nada de esto está en Supabase**, y el
Dashboard presenta los resultados como un escenario académico con ventas
simuladas.
