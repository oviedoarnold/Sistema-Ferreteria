# Resumen del análisis exploratorio

> Calculado por `src/eda.py` a partir de `data/processed/demanda_diaria.csv`.
> **Los datos son simulados** (semilla 42) sobre los 9 productos reales del
> Sistema Ferretería. Ninguna cifra de este archivo se escribió a mano.

## Volumen

| Métrica | Valor |
|---|---|
| Período | 2026-01-01 a 2026-08-31 |
| Registros producto-día | 2,187 |
| Total de unidades vendidas | 5,352 |
| Ingreso total | L 876,446.00 |
| Demanda promedio diaria (todos los productos) | 22.02 unidades |
| Demanda promedio en días de atención | 26.24 unidades |
| Días con ventas | 204 de 243 |
| Registros producto-día sin venta | 36.9% |

## Hallazgos

### 1. Producto más vendido

**CEM-001 · Cemento gris 42.5 kg**, con 1,575 unidades (29.4% del total).

Un solo producto concentra una parte grande del volumen. Es el que más impacto tiene sobre el error del modelo y el que menos margen deja para equivocarse en la reposición.

### 2. Producto menos vendido

**ELE-001 · Cable THHN #12 (rollo 100 m)**, con 80 unidades.

Vende 20 veces menos que el más vendido. Productos así pasan muchos días sin venta, y un modelo que prediga demanda media constante les recomendaría comprar de más.

### 3. Categoría con mayor demanda

**Construcción**, con 1,575 unidades (29.4% del total).

De las 7 categorías, solo Cerrajería (2) y Herramientas (2) tienen más de un producto. El resto refleja un único producto, así que este resultado dice más del producto que de la categoría.

### 4. Día de semana con mayor demanda

**Sábado**, con 33.7 unidades promedio, frente a 24.1 de lunes a viernes (+40%). El domingo es 0: la ferretería no abre.

El día de la semana es una variable útil para el modelo: la diferencia es grande y sistemática.

### 5. Registros sin venta

El **36.9%** de los registros producto-día tienen cero ventas.

Una parte viene de los días cerrados (domingos y feriados) y el resto de productos de baja rotación. Es la razón de haber completado la matriz con ceros en el ETL, y la razón para no usar MAPE como métrica: con demanda real en cero, el error porcentual se vuelve infinito.

### 6. Tendencia general

Promedio diario de unidades por mes:

| Mes | Unidades por día |
|---|---|
| enero | 21.74 |
| febrero | 24.04 |
| marzo | 23.39 |
| abril | 23.00 |
| mayo | 20.39 |
| junio | 21.33 |
| julio | 20.97 |
| agosto | 21.55 |

Primer bimestre: 22.83 unidades/día · último bimestre: 21.26 · cambio: **-6.9%**. Pendiente de la recta sobre los promedios mensuales: -0.303 unidades/día por mes.

Lectura: **decreciente**. El pico es febrero y el valle mayo.

La temporada seca (febrero a abril) promedia 23.47 unidades/día y la de lluvias (junio a agosto) 21.28: +10.3%. Esa diferencia estacional es mayor que el cambio entre el inicio y el final del período, así que la variación está dominada por la temporada y no por un crecimiento sostenido. El modelo tendrá que capturar la estacionalidad; una tendencia lineal sola no la explicaría.
