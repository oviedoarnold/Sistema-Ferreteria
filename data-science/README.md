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

> **Los productos son reales. El historial de ventas es simulado.**

| | Origen |
|---|---|
| **Productos** | Los 9 productos activos del Sistema Ferretería: código, nombre, categoría, precio, costo y existencia mínima. Instantánea del 2026-09-16 en `data/raw/productos_sistema.csv` |
| **Ventas** | **Simuladas.** La base real tiene 7 ventas en 3 fechas, insuficientes para calcular siquiera un promedio semanal. |
| **Período** | 2026-01-01 a 2026-08-31 (243 días) |
| **Semilla** | `42` |

La simulación no sortea números independientes. La demanda de cada día se
construye por capas —demanda base del producto, día de la semana, temporada,
tendencia— y se sortea con una binomial negativa, que reproduce la variabilidad
real de un comercio. Cada parámetro está justificado en
`src/generate_dataset.py` y resumido en el
[diccionario de datos](data/processed/diccionario_datos.md).

**Ningún resultado de esta carpeta debe presentarse como dato real de ventas.**

## Pipeline

```
Catálogo real ─┐
               ├─→ Generación ─→ ETL ─→ EDA ─→ Modelo ─→ Predicción ─→ Recomendación ─→ Dashboard
Simulación ────┘       │          │       │
                  tickets     demanda   gráficas
                  crudos      diaria    y resumen
```

| Etapa | Script | Entrada | Salida | Estado |
|---|---|---|---|---|
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
| Filas crudas | 2,828 |
| Filas procesadas | 2,187 (243 días × 9 productos) |
| Nulos en el procesado | 0 |
| Duplicados fecha-producto | 0 |
| Cantidades o ingresos negativos | 0 |
| Tickets duplicados quitados | 25 |
| Cantidades inválidas quitadas | 6 |
| Precios recuperados del catálogo | 12 |
| Ingresos recalculados | 8 |
| Registros producto-día sin venta | 807 (36.9%) |
| Total de unidades | 5,352 |
| Ingreso total | L 876,446.00 |

Los defectos del archivo crudo se **inyectaron a propósito** para que la limpieza
tenga algo que hacer; el detalle está en el diccionario de datos. La prueba de que
la limpieza es correcta: después de quitarlos, el total vuelve a ser exactamente
las 5,352 unidades del historial limpio.

### Hallazgos del EDA

El detalle, con todas las cifras calculadas, está en
[`outputs/eda/resumen_eda.md`](outputs/eda/resumen_eda.md).

- **Cemento** es el producto más vendido: 29.4% de todas las unidades.
- El **sábado** vende 40% más que un día entre semana. El domingo, cero.
- El **36.9%** de los registros producto-día no tienen venta.
- La **temporada** pesa más que la tendencia: la temporada seca vende 10.3% más
  que la de lluvias.

### Reproducibilidad

Los tres scripts se ejecutaron dos veces desde cero y produjeron archivos
idénticos byte a byte (mismo hash SHA-256).

## Estructura

```
data-science/
├── README.md
├── requirements.txt          versiones fijadas
├── data/
│   ├── raw/
│   │   ├── productos_sistema.csv       catálogo real
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
