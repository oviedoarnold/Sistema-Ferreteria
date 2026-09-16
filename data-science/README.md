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
| Modelo | — | demanda diaria | métricas y predicciones | Fase 5C |
| Recomendación | — | predicciones + stock | cantidades a comprar | Fase 5C |
| Dashboard | Sistema Ferretería | recomendaciones | pantalla | Fase 6 |

## Ejecución

Requiere **Python 3.12**. Desde esta carpeta (`data-science/`):

```bash
pip install -r requirements.txt

python src/generate_dataset.py
python src/etl.py
python src/eda.py
```

Cada script lee lo que produjo el anterior. Se pueden volver a ejecutar en
cualquier momento: sobrescriben sus salidas y, con la semilla 42, producen
**exactamente los mismos archivos**.

## Resultados de esta fase

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

### Reproducibilidad

- Los tres scripts se ejecutaron dos veces desde cero y produjeron archivos
  **idénticos byte a byte** (mismo hash SHA-256), gráficas incluidas.
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
│   │   └── ventas_simuladas_2026.csv   tickets simulados
│   └── processed/
│       ├── demanda_diaria.csv          dataset para el modelo
│       └── diccionario_datos.md
├── outputs/
│   ├── reporte_calidad.json
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
    └── eda.py
```

## Estado

**Esta fase llega hasta el EDA.** Todavía no hay modelo, ni predicciones, ni
recomendaciones: pertenecen a la Fase 5C.

Lo que viene:

- **Modelo:** `RandomForestRegressor`, contra un baseline de promedio móvil de
  28 días.
- **Objetivo:** demanda de los próximos 7 y 30 días por producto.
- **Validación:** entrenamiento con enero a julio, evaluación con agosto. Después
  se reentrena con enero a agosto para predecir septiembre.
