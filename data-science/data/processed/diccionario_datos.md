# Diccionario de datos

Describe los archivos del pipeline, en el orden en que se producen.

> ## Sobre el origen de los datos
>
> | Qué | Origen |
> |---|---|
> | **9 productos** | **Reales.** Catálogo actual del Sistema Ferretería: identificador, código, nombre, categoría, precio y costo tal como están en Supabase. |
> | **41 productos** | **Sintéticos académicos.** Artículos típicos de una ferretería hondureña, creados para este análisis. Nombres, códigos, precios y costos son propios: no provienen de ninguna tienda ni de ningún catálogo comercial. **No existen en Supabase.** |
> | **Ventas enero–agosto 2026** | **Simuladas**, para los 50 productos, con semilla 42. |
>
> Nada de este documento presenta datos sintéticos o simulados como reales.

Cada columna lleva su origen marcado:

| Marca | Significado |
|---|---|
| **REAL** | Copiado del catálogo del Sistema Ferretería (solo para los 9 productos del sistema) |
| **SINTÉTICO** | Definido a mano para el análisis (los 41 productos adicionales) |
| **SIMULADO** | Producido por `generate_dataset.py` con semilla 42 |
| **DERIVADO** | Calculado por el ETL a partir de otras columnas |

---

## 1. Catálogo

Dos archivos que nunca se mezclan en disco. `src/catalogo.py` los une al
ejecutar el pipeline y agrega la columna `origen`.

Se mantienen separados para que en el propio repositorio quede a la vista qué
vino del sistema y qué se creó para el análisis, y para poder comparar el archivo
real contra Supabase sin ruido.

### 1.1 `data/raw/productos_sistema.csv` — 9 productos REALES

Instantánea tomada el 2026-09-16 de la tabla `productos` de Supabase, con una
consulta de solo lectura. Se guarda como archivo y no se consulta en cada
ejecución: si alguien cambia un precio en el sistema, el dataset sigue siendo
reproducible, y el pipeline no necesita credenciales.

### 1.2 `data/raw/productos_sinteticos.csv` — 41 productos SINTÉTICOS

Identificadores `DS-P010` a `DS-P050` y códigos `FER-010` a `FER-050`, ambos
propios y claramente distinguibles de los del sistema.

### Columnas (mismas en ambos archivos)

| Columna | Tipo | Origen | Descripción |
|---|---|---|---|
| `producto_id` | texto | REAL / SINTÉTICO | UUID del sistema, o `DS-Pnnn` para los sintéticos |
| `codigo` | texto | REAL / SINTÉTICO | SKU: `CEM-001` en el sistema, `FER-0nn` en los sintéticos |
| `producto` | texto | REAL / SINTÉTICO | Nombre comercial |
| `categoria` | texto | REAL / SINTÉTICO | Una de las 11 categorías |
| `precio` | decimal | REAL / SINTÉTICO | Precio de venta, en lempiras |
| `costo` | decimal | REAL / SINTÉTICO | Costo de adquisición, en lempiras |
| `stock_minimo` | entero | REAL / SINTÉTICO | Existencia mínima de referencia |

**Precios y costos sintéticos:** valores académicos razonables. No son precios
actuales de ninguna tienda. Todos cumplen `precio > costo > 0`; los márgenes van
de 19.2% a 46.9% y los 50 precios son distintos entre sí.

**Atención:** `CER-001` y `CER-023` se llaman igual ("Candado de bronce 40 mm")
pero son productos distintos del sistema, con precio diferente. No se pueden
renombrar. Todo el pipeline agrupa por `producto_id` y nunca por nombre.

### Categorías

Se reutilizan los nombres que ya usa el sistema —`Eléctrico` y no Electricidad,
`Plomería` y no Fontanería— porque las categorías de los 9 productos reales no se
modifican. Por la misma razón, lo que en otros catálogos sería "Herrajes y
Fijación" aquí queda repartido en `Tornillería` y `Cerrajería`, que ya existían.
De ahí que sean 11 y no 10.

| Categoría | Productos | Del sistema | Sintéticos |
|---|---|---|---|
| Construcción | 6 | 1 | 5 |
| Eléctrico | 6 | 1 | 5 |
| Plomería | 6 | 1 | 5 |
| Herramientas | 5 | 2 | 3 |
| Pinturas | 5 | 1 | 4 |
| Cerrajería | 4 | 2 | 2 |
| Tornillería | 4 | 1 | 3 |
| Herramientas Eléctricas | 4 | 0 | 4 |
| Jardinería | 4 | 0 | 4 |
| Seguridad | 3 | 0 | 3 |
| Adhesivos y Selladores | 3 | 0 | 3 |
| **Total** | **50** | **9** | **41** |

Ninguna categoría tiene un solo producto. Con 9 productos, cinco de siete lo
tenían, y la categoría no aportaba nada que el producto no dijera ya.

---

## 2. `data/raw/ventas_simuladas_2026.csv`

Tickets de venta simulados. **Una fila por ticket**: cada vez que un cliente
llevó un producto. **11,194 filas**, del 2026-01-02 al 2026-08-31.

| Columna | Tipo | Origen | Descripción |
|---|---|---|---|
| `evento_id` | texto | SIMULADO | Identificador del ticket, `EV-000001`. Las filas inválidas inyectadas usan `EV-X00001` |
| `fecha_hora` | fecha y hora | SIMULADO | Momento de la venta, entre 07:00 y 16:59 |
| `producto_id` | texto | REAL / SINTÉTICO | Ver catálogo |
| `codigo` | texto | REAL / SINTÉTICO | Ver catálogo |
| `producto` | texto | REAL / SINTÉTICO | Ver catálogo |
| `categoria` | texto | REAL / SINTÉTICO | Ver catálogo |
| `cantidad` | entero | SIMULADO | Unidades del ticket |
| `precio_unitario` | decimal | REAL / SINTÉTICO | Precio del catálogo. Vacío en algunas filas por defecto inyectado |
| `ingreso` | decimal | SIMULADO | `cantidad × precio_unitario`. Mal calculado en algunas filas por defecto inyectado |

### Defectos inyectados deliberadamente

Un archivo perfecto no dejaría nada que limpiar, y la limpieza es parte del
entregable. Se inyectan defectos típicos de una exportación real, como
proporción de los 11,072 tickets limpios y con semilla propia:

| Defecto | Proporción | Filas | Cómo lo resuelve el ETL |
|---|---|---|---|
| Ticket exportado dos veces | 0.9% | 100 | Se conserva una fila por `evento_id` |
| Cantidad cero o negativa | 0.2% | 22 | Se descarta: no es una venta |
| Precio vacío | 0.4% | 44 | Se recupera del catálogo |
| Ingreso mal calculado | 0.3% | 33 | Se recalcula como cantidad × precio |

**Ningún defecto altera la demanda verdadera.** Las filas duplicadas e inválidas
son filas de más; los precios y los ingresos se reconstruyen. El ETL tiene que
llegar exactamente a las 20,542 unidades del historial limpio, y llega.

---

## 3. `data/processed/demanda_diaria.csv`

Salida del ETL. **Una fila por producto por día**: 243 días × 50 productos =
**12,150 filas**, del 2026-01-01 al 2026-08-31. Es el dataset que usarán el EDA y
el modelo.

| Columna | Tipo | Origen | Descripción | Uso en el modelo |
|---|---|---|---|---|
| `fecha` | fecha | DERIVADO | Día calendario, sin hora | Base para día de semana, mes y desfases |
| `producto_id` | texto | REAL / SINTÉTICO | Identificador del producto | Clave de agrupación; variable categórica |
| `codigo` | texto | REAL / SINTÉTICO | Código o SKU | Etiqueta legible; no es variable |
| `producto` | texto | REAL / SINTÉTICO | Nombre comercial | Etiqueta legible; no es variable |
| `categoria` | texto | REAL / SINTÉTICO | Categoría | Variable categórica |
| `origen` | texto | DERIVADO | `sistema` o `sintetico` | **No es variable**: solo trazabilidad |
| `precio` | decimal | REAL / SINTÉTICO | Precio de venta, en lempiras | Solo para el EDA |
| `costo` | decimal | REAL / SINTÉTICO | Costo de adquisición, en lempiras | Monto estimado de la compra recomendada |
| `cantidad_vendida` | entero ≥ 0 | DERIVADO | Suma de unidades de los tickets del día. **0 si no hubo venta** | **Variable objetivo**, sumada a 7 y 30 días |
| `ingreso` | decimal ≥ 0 | DERIVADO | Suma de `cantidad × precio` del día | Solo para el EDA |

### Por qué hay filas con cero

5,789 de las 12,150 filas (47.6%) tienen `cantidad_vendida = 0`. **No son datos
faltantes: son días en que ese producto no se vendió.** Son de dos clases:

- **1,950** son días en que la ferretería no abrió. Ceros estructurales.
- **3,839** son días abiertos sin venta de ese producto. Demanda intermitente.

Sin esas filas un modelo solo vería días con venta, aprendería que la demanda
mínima es 1, y recomendaría comprar de más justo los productos que menos rotan.

### Columnas que NO serán variables del modelo

- **`origen`** no tiene relación con la demanda: se simuló igual para productos
  reales y sintéticos. Usarla solo permitiría al modelo memorizar una etiqueta
  administrativa.
- **`precio`** es constante por producto en todo el período: no aporta nada que
  `producto_id` no aporte ya.
- **`ingreso`** es `cantidad_vendida × precio`. Usarlo para predecir la cantidad
  sería darle al modelo la respuesta dentro de la pregunta: una fuga de
  información.

### Lo que NO está en el dataset, a propósito

La **rotación** de cada producto (alta, media, baja) es un parámetro de la
simulación y no se guarda. Sería una columna que resume la respuesta: el modelo
aprendería a leerla en vez de aprender a predecir la demanda.

---

## Parámetros de la simulación

Todos están en `src/generate_dataset.py`, con la justificación de cada uno.

### Generales

| Parámetro | Valor |
|---|---|
| Semilla | `42`, con una secuencia propia por producto derivada de su código |
| Período | 2026-01-01 a 2026-08-31 (243 días) |
| Días cerrados | Domingos, 1 de enero, 2 y 3 de abril (Semana Santa), 1 de mayo |
| Distribución de la demanda diaria | Binomial negativa (mezcla gamma-Poisson) |
| Crecimiento por producto | Entre −5% y +12% en el período, más un paseo aleatorio suavizado |

**La ferretería no abre los domingos.** Los domingos existen en el dataset
procesado, con demanda 0: son parte del calendario que el modelo tiene que
aprender.

### Rotación

| Rotación | Productos | Unidades base por día | Dispersión | Comportamiento |
|---|---|---|---|---|
| Alta | 11 | 2.8 a 7.0 | 5.0 | Consumibles: venta casi diaria y regular |
| Media | 26 | 0.7 a 2.4 | 3.0 | Accesorios, pinturas, herramientas manuales |
| Baja | 13 | 0.06 a 0.55 | 1.2 | Equipos y artículos caros: venta a ráfagas |

### Por categoría

| Categoría | Semana | Temporada | Sensibilidad | Pedidos grandes |
|---|---|---|---|---|
| Construcción | obra | seca | 0.9–1.4 | 2.0% de los días |
| Plomería | reparación | seca + lluvias | 0.7–1.3 | 1.2% |
| Eléctrico | reparación | estable | 0.5–1.0 | 0.8% |
| Herramientas | obra | estable | 0.5–1.2 | — |
| Herramientas Eléctricas | obra | seca | 0.2–0.5 | — |
| Pinturas | obra | pintura | 0.8–1.3 | 0.6% |
| Tornillería | obra | seca | 0.4–0.8 | 1.5% |
| Cerrajería | reparación | estable | 0.5–1.0 | — |
| Jardinería | jardín | **lluvias** | 0.9–1.4 | — |
| Seguridad | contratista | seca | 0.4–0.9 | 1.0% |
| Adhesivos y Selladores | reparación | seca | 0.3–0.7 | — |

- **Semana** (lunes a domingo): *obra* 0.90 · 0.95 · 1.00 · 1.00 · 1.15 · 1.45 · 0 ·
  *reparación* 1.05 · 1.00 · 1.00 · 1.00 · 1.05 · 1.20 · 0 · *jardín* 0.80 · 0.85 ·
  0.90 · 0.95 · 1.10 · 1.70 · 0 · *contratista* 1.30 · 1.10 · 1.00 · 0.95 · 0.95 ·
  1.00 · 0. Cada producto varía ±4% sobre la de su categoría.
- **Temporada:** *seca* con pico en marzo; *lluvias* con pico en junio, al revés
  que la construcción; *seca + lluvias* para obra en seco y reparaciones cuando
  las lluvias revientan tuberías.
- **Sensibilidad:** cada producto sortea un exponente dentro del rango de su
  categoría y lo aplica a la curva de temporada. Es lo que evita que todos los
  productos de una categoría suban y bajen igual.
- **Pedidos grandes:** probabilidad diaria de una compra por volumen de un
  contratista, que multiplica la demanda del día entre 2.5 y 5 veces.
