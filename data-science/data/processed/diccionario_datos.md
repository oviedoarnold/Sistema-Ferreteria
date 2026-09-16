# Diccionario de datos

Describe los tres archivos del pipeline, en el orden en que se producen.

> **Sobre el origen de los datos.** Los **productos son reales**: código, nombre,
> categoría, precio y costo se tomaron del catálogo del Sistema Ferretería. El
> **historial de ventas es simulado**: la base real tiene 7 ventas en 3 fechas,
> insuficientes para modelar demanda. Nada de este documento presenta datos
> simulados como reales.

Cada columna lleva su origen marcado:

| Marca | Significado |
|---|---|
| **REAL** | Copiado del catálogo del Sistema Ferretería |
| **SIMULADO** | Producido por `generate_dataset.py` con semilla 42 |
| **DERIVADO** | Calculado por el ETL a partir de otras columnas |

---

## 1. `data/raw/productos_sistema.csv`

Instantánea del catálogo, tomada el 2026-09-16 de la tabla `productos` de
Supabase (solo lectura). **9 filas, una por producto activo.**

Se guarda como archivo y no se consulta en cada ejecución: si alguien edita un
precio en el sistema mañana, el dataset seguiría siendo reproducible, y el
pipeline no necesita credenciales para correr.

| Columna | Tipo | Origen | Descripción |
|---|---|---|---|
| `producto_id` | texto (UUID) | REAL | Identificador del producto en el sistema |
| `codigo` | texto | REAL | Código o SKU, por ejemplo `CEM-001` |
| `producto` | texto | REAL | Nombre comercial |
| `categoria` | texto | REAL | Categoría del catálogo |
| `precio` | decimal | REAL | Precio de venta, en lempiras |
| `costo` | decimal | REAL | Costo de adquisición, en lempiras |
| `stock_minimo` | entero | REAL | Existencia mínima configurada por la ferretería |

**Atención:** `CER-001` y `CER-023` se llaman igual ("Candado de bronce 40 mm")
pero son productos distintos, con precio y existencias diferentes. Todo el
pipeline agrupa por `producto_id` y nunca por nombre.

---

## 2. `data/raw/ventas_simuladas_2026.csv`

Tickets de venta simulados. **Una fila por ticket**, es decir, por cada vez que
un cliente llevó un producto. **2,828 filas**, del 2026-01-02 al 2026-08-31.

| Columna | Tipo | Origen | Descripción |
|---|---|---|---|
| `evento_id` | texto | SIMULADO | Identificador del ticket, `EV-000001`. Las filas inválidas inyectadas usan `EV-X00001` |
| `fecha_hora` | fecha y hora | SIMULADO | Momento de la venta, entre 07:00 y 16:59 |
| `producto_id` | texto (UUID) | REAL | Ver catálogo |
| `codigo` | texto | REAL | Ver catálogo |
| `producto` | texto | REAL | Ver catálogo |
| `categoria` | texto | REAL | Ver catálogo |
| `cantidad` | entero | SIMULADO | Unidades del ticket |
| `precio_unitario` | decimal | REAL | Precio del catálogo. Vacío en 12 filas por defecto inyectado |
| `ingreso` | decimal | SIMULADO | `cantidad × precio_unitario`. Mal calculado en 8 filas por defecto inyectado |

### Defectos inyectados deliberadamente

Un archivo perfecto no dejaría nada que limpiar, y la limpieza es parte del
entregable. Se inyectaron defectos típicos de una exportación real, en
cantidades conocidas y con la misma semilla:

| Defecto | Filas | Cómo lo resuelve el ETL |
|---|---|---|
| Ticket exportado dos veces | 25 | Se conserva una fila por `evento_id` |
| Cantidad cero o negativa | 6 | Se descarta: no es una venta |
| Precio vacío | 12 | Se recupera del catálogo |
| Ingreso mal calculado | 8 | Se recalcula como cantidad × precio |

**Ningún defecto altera la demanda verdadera.** Las filas duplicadas e inválidas
son filas de más; los precios y los ingresos se reconstruyen. El ETL tiene que
llegar exactamente a las 5,352 unidades del historial limpio, y llega.

---

## 3. `data/processed/demanda_diaria.csv`

Salida del ETL. **Una fila por producto por día**: 243 días × 9 productos =
**2,187 filas**, del 2026-01-01 al 2026-08-31. Es el dataset que usarán el EDA y
el modelo.

| Columna | Tipo | Origen | Descripción | Uso en el modelo |
|---|---|---|---|---|
| `fecha` | fecha | DERIVADO | Día calendario, sin hora | Base para día de semana, mes y desfases |
| `producto_id` | texto (UUID) | REAL | Identificador del producto | Clave de agrupación; variable categórica |
| `codigo` | texto | REAL | Código o SKU | Etiqueta legible; no es variable |
| `producto` | texto | REAL | Nombre comercial | Etiqueta legible; no es variable |
| `categoria` | texto | REAL | Categoría del catálogo | Variable categórica |
| `precio` | decimal | REAL | Precio de venta, en lempiras | Solo para el EDA; ver nota |
| `costo` | decimal | REAL | Costo de adquisición, en lempiras | Monto estimado de la compra recomendada |
| `cantidad_vendida` | entero ≥ 0 | DERIVADO | Suma de unidades de los tickets del día. **0 si no hubo venta** | **Variable objetivo**, sumada a 7 y 30 días |
| `ingreso` | decimal ≥ 0 | DERIVADO | Suma de `cantidad × precio` del día | Solo para el EDA; ver nota |

### Por qué hay filas con cero

807 de las 2,187 filas (36.9%) tienen `cantidad_vendida = 0`. **No son datos
faltantes: son días en que ese producto no se vendió.** Vienen de los días en que
la ferretería no abre (domingos y feriados) y de los productos de baja rotación.

Sin esas filas un modelo solo vería días con venta, aprendería que la demanda
mínima es 1, y recomendaría comprar de más justo los productos que menos rotan.

### Por qué `precio` e `ingreso` no serán variables del modelo

- **`precio`** es constante por producto en todo el período: no aporta nada que
  `producto_id` no aporte ya.
- **`ingreso`** es `cantidad_vendida × precio`. Usarlo para predecir la cantidad
  sería darle al modelo la respuesta dentro de la pregunta: una fuga de
  información.

---

## Parámetros de la simulación

Todos están en `src/generate_dataset.py`, con la justificación de cada uno.

| Parámetro | Valor |
|---|---|
| Semilla | `42` |
| Período | 2026-01-01 a 2026-08-31 (243 días) |
| Distribución de la demanda diaria | Binomial negativa (mezcla gamma-Poisson), dispersión 4 |
| Día de semana, lunes a domingo | 0.90 · 0.95 · 1.00 · 1.00 · 1.15 · 1.45 · 0 |
| Días cerrados | Domingos, 1 de enero, 2 y 3 de abril (Semana Santa), 1 de mayo |
| Temporada de obra (Construcción, Plomería) | Pico en marzo ×1.25, valle en julio ×0.82 |
| Temporada de pintura | Pico en abril ×1.24, valle en julio ×0.84 |
| Demás categorías | Casi plano, entre ×0.97 y ×1.03 |
| Crecimiento por producto | Entre +2% y +10% en el período, más un paseo aleatorio suavizado |

| Producto | Unidades base por día |
|---|---|
| CEM-001 Cemento | 7.00 |
| TOR-001 Tornillos | 5.50 |
| PLO-001 Tubo PVC | 4.00 |
| HER-002 Cinta métrica | 2.20 |
| PIN-001 Pintura | 1.80 |
| HER-001 Martillo | 1.30 |
| CER-023 Candado económico | 1.10 |
| CER-001 Candado estándar | 0.80 |
| ELE-001 Cable | 0.35 |
