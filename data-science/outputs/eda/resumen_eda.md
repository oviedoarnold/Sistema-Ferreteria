# Resumen del análisis exploratorio

> Calculado por `src/eda.py` a partir de `data/processed/demanda_diaria.csv`.
> Ninguna cifra de este archivo se escribió a mano.
>
> **Transparencia sobre los datos:** de los 50 productos, 9 son reales del
> catálogo del Sistema Ferretería y 41 son sintéticos académicos. **Todas las ventas son
> simuladas** (semilla 42). Nada de esto describe ventas reales.

## Volumen

| Métrica | Valor |
|---|---|
| Período | 2026-01-01 a 2026-08-31 |
| Productos | 50 (9 del sistema, 41 sintéticos) |
| Categorías | 11 |
| Registros producto-día | 12,150 |
| Total de unidades vendidas | 20,542 |
| Ingreso total | L 2,651,777.00 |
| Demanda promedio diaria (todos los productos) | 84.53 unidades |
| Demanda promedio en días de atención | 100.70 unidades |
| Días con ventas | 204 de 243 |
| Registros producto-día sin venta | 47.6% |

## Top 10 productos

| # | Código | Producto | Categoría | Origen | Unidades | % | % acumulado |
|---|---|---|---|---|---|---|---|
| 1 | CEM-001 | Cemento gris 42.5 kg | Construcción | sistema | 1,745 | 8.5% | 8.5% |
| 2 | FER-020 | Codo PVC 1/2" x 90° | Plomería | sintético | 1,688 | 8.2% | 16.7% |
| 3 | FER-036 | Clavo de acero 2-1/2" (libra) | Tornillería | sintético | 1,226 | 6.0% | 22.7% |
| 4 | TOR-001 | Tornillo para madera 1" (caja 100 u) | Tornillería | sistema | 1,224 | 6.0% | 28.6% |
| 5 | PLO-001 | Tubo PVC 1/2" x 6 m | Plomería | sistema | 985 | 4.8% | 33.4% |
| 6 | FER-021 | Tee PVC 1/2" | Plomería | sintético | 970 | 4.7% | 38.2% |
| 7 | FER-014 | Alambre de amarre (libra) | Construcción | sintético | 968 | 4.7% | 42.9% |
| 8 | FER-018 | Cinta aislante 3/4" x 20 m | Eléctrico | sintético | 809 | 3.9% | 46.8% |
| 9 | FER-010 | Mortero seco 40 kg | Construcción | sintético | 670 | 3.3% | 50.1% |
| 10 | FER-022 | Pegamento PVC 1/4 galón | Plomería | sintético | 658 | 3.2% | 53.3% |

Los 10 primeros suman el **53.3%** de las unidades. 3 de ellos son productos del sistema.

## Categorías

| Categoría | Productos | Unidades | % unidades | Ingreso | % ingreso | Unidades por producto |
|---|---|---|---|---|---|---|
| Plomería | 6 | 4,652 | 22.6% | L 288,346.00 | 10.9% | 775 |
| Construcción | 6 | 4,106 | 20.0% | L 861,709.00 | 32.5% | 684 |
| Tornillería | 4 | 3,392 | 16.5% | L 122,492.00 | 4.6% | 848 |
| Eléctrico | 6 | 2,655 | 12.9% | L 258,687.00 | 9.8% | 442 |
| Pinturas | 5 | 1,647 | 8.0% | L 362,781.00 | 13.7% | 329 |
| Herramientas | 5 | 1,465 | 7.1% | L 174,709.00 | 6.6% | 293 |
| Cerrajería | 4 | 809 | 3.9% | L 101,191.00 | 3.8% | 202 |
| Seguridad | 3 | 616 | 3.0% | L 61,790.00 | 2.3% | 205 |
| Jardinería | 4 | 581 | 2.8% | L 111,537.00 | 4.2% | 145 |
| Adhesivos y Selladores | 3 | 511 | 2.5% | L 70,135.00 | 2.6% | 170 |
| Herramientas Eléctricas | 4 | 108 | 0.5% | L 238,400.00 | 9.0% | 27 |

## Hallazgos

### 1. Producto más vendido

**CEM-001 · Cemento gris 42.5 kg** (Construcción), con 1,745 unidades.

Ningún producto domina: el más vendido representa el 8.5% de las unidades. Hacen falta 23 de los 50 productos para llegar al 80%, así que el error del modelo no quedará dominado por uno solo.

### 2. Producto menos vendido

Empate entre **FER-030 · Sierra circular 7-1/4"** (Herramientas Eléctricas) y **FER-031 · Rotomartillo SDS 800 W** (Herramientas Eléctricas), con 20 unidades cada uno.

Venden 87 veces menos que el más vendido. Productos así pasan la mayoría de los días sin venta: son los más difíciles de predecir, y un modelo que prediga demanda media constante les recomendaría comprar de más.

### 3. Categoría con mayor demanda

**Plomería**, con 4,652 unidades (22.6% del total).

Pero las unidades no son comparables entre categorías: un codo de PVC y un taladro cuentan igual. En ingreso lidera **Construcción** (32.5% del ingreso), no Plomería (10.9%).

Las 11 categorías tienen entre 3 y 6 productos, ninguna con uno solo. Por eso la categoría ahora puede aportar información propia al modelo, en vez de repetir lo que ya dice el producto.

### 4. Día de semana con mayor demanda

**Sábado**, con 125.5 unidades promedio, frente a 93.4 de lunes a viernes (+34%). El domingo es 0: la ferretería no abre.

El día de la semana es una variable útil para el modelo: la diferencia es grande y sistemática.

### 5. Registros sin venta

El **47.6%** de los registros producto-día tienen cero ventas: 5,789 registros.

- **1,950** son días en que la ferretería no abrió (domingos y feriados). Son ceros estructurales: el modelo los aprende del calendario.
- **3,839** son días abiertos en que el producto no se vendió. Incluso con la tienda abierta, el 37.6% de los registros producto-día no tienen venta: eso es demanda intermitente, y es lo difícil.

Es la razón de haber completado la matriz con ceros en el ETL, y la razón para no usar MAPE como métrica: con demanda real en cero, el error porcentual se vuelve infinito.

### 6. Tendencia general

Promedio diario de unidades por mes:

| Mes | Unidades por día |
|---|---|
| enero | 82.52 |
| febrero | 94.39 |
| marzo | 92.13 |
| abril | 84.07 |
| mayo | 79.55 |
| junio | 82.57 |
| julio | 82.26 |
| agosto | 79.68 |

Primer bimestre: 88.15 unidades/día · último bimestre: 80.97 · cambio: **-8.2%**. Pendiente de la recta sobre los promedios mensuales: -1.354 unidades/día por mes.

Lectura: **decreciente**. El pico es febrero y el valle mayo.

La temporada seca (febrero a abril) promedia 90.20 unidades/día y la de lluvias (junio a agosto) 81.50: +10.7%. Esa diferencia estacional es mayor que el cambio entre el inicio y el final del período, así que la variación está dominada por la temporada y no por un crecimiento sostenido. El modelo tendrá que capturar la estacionalidad; una tendencia lineal sola no la explicaría.

## Anexo: ranking completo

| # | Código | Producto | Categoría | Origen | Unidades | % | % acumulado |
|---|---|---|---|---|---|---|---|
| 1 | CEM-001 | Cemento gris 42.5 kg | Construcción | sistema | 1,745 | 8.5% | 8.5% |
| 2 | FER-020 | Codo PVC 1/2" x 90° | Plomería | sintético | 1,688 | 8.2% | 16.7% |
| 3 | FER-036 | Clavo de acero 2-1/2" (libra) | Tornillería | sintético | 1,226 | 6.0% | 22.7% |
| 4 | TOR-001 | Tornillo para madera 1" (caja 100 u) | Tornillería | sistema | 1,224 | 6.0% | 28.6% |
| 5 | PLO-001 | Tubo PVC 1/2" x 6 m | Plomería | sistema | 985 | 4.8% | 33.4% |
| 6 | FER-021 | Tee PVC 1/2" | Plomería | sintético | 970 | 4.7% | 38.2% |
| 7 | FER-014 | Alambre de amarre (libra) | Construcción | sintético | 968 | 4.7% | 42.9% |
| 8 | FER-018 | Cinta aislante 3/4" x 20 m | Eléctrico | sintético | 809 | 3.9% | 46.8% |
| 9 | FER-010 | Mortero seco 40 kg | Construcción | sintético | 670 | 3.3% | 50.1% |
| 10 | FER-022 | Pegamento PVC 1/4 galón | Plomería | sintético | 658 | 3.2% | 53.3% |
| 11 | FER-019 | Bombillo LED 12 W | Eléctrico | sintético | 637 | 3.1% | 56.4% |
| 12 | HER-002 | Cinta métrica 5 m | Herramientas | sistema | 604 | 2.9% | 59.3% |
| 13 | FER-037 | Perno hexagonal 3/8" x 3" con tuerca | Tornillería | sintético | 556 | 2.7% | 62.0% |
| 14 | FER-034 | Brocha 3" | Pinturas | sintético | 491 | 2.4% | 64.4% |
| 15 | FER-015 | Tomacorriente doble polarizado | Eléctrico | sintético | 481 | 2.3% | 66.8% |
| 16 | FER-016 | Interruptor sencillo | Eléctrico | sintético | 448 | 2.2% | 68.9% |
| 17 | PIN-001 | Pintura acrílica blanca 1 galón | Pinturas | sistema | 421 | 2.0% | 71.0% |
| 18 | FER-011 | Pegamento para cerámica 20 kg | Construcción | sintético | 390 | 1.9% | 72.9% |
| 19 | FER-038 | Taquete plástico 1/4" (bolsa 100 u) | Tornillería | sintético | 386 | 1.9% | 74.8% |
| 20 | FER-039 | Bisagra de acero 3" (par) | Cerrajería | sintético | 342 | 1.7% | 76.4% |
| 21 | FER-035 | Rodillo 9" con bandeja | Pinturas | sintético | 307 | 1.5% | 77.9% |
| 22 | FER-045 | Guantes de cuero (par) | Seguridad | sintético | 307 | 1.5% | 79.4% |
| 23 | HER-001 | Martillo de uña 16 oz | Herramientas | sistema | 282 | 1.4% | 80.8% |
| 24 | FER-042 | Machete 22" | Jardinería | sintético | 269 | 1.3% | 82.1% |
| 25 | FER-033 | Diluyente (thinner) 1 galón | Pinturas | sintético | 268 | 1.3% | 83.4% |
| 26 | FER-023 | Llave de paso 1/2" | Plomería | sintético | 265 | 1.3% | 84.7% |
| 27 | FER-026 | Destornillador de estrella #2 | Herramientas | sintético | 252 | 1.2% | 85.9% |
| 28 | FER-048 | Silicón transparente 280 ml | Adhesivos y Selladores | sintético | 250 | 1.2% | 87.1% |
| 29 | CER-023 | Candado de bronce 40 mm | Cerrajería | sistema | 229 | 1.1% | 88.2% |
| 30 | FER-017 | Breaker 20 A enchufable | Eléctrico | sintético | 202 | 1.0% | 89.2% |
| 31 | FER-025 | Alicate universal 8" | Herramientas | sintético | 202 | 1.0% | 90.2% |
| 32 | FER-046 | Lentes de seguridad claros | Seguridad | sintético | 199 | 1.0% | 91.2% |
| 33 | FER-013 | Malla electrosoldada 6x6 (lámina) | Construcción | sintético | 187 | 0.9% | 92.1% |
| 34 | FER-032 | Pintura de aceite color 1 galón | Pinturas | sintético | 160 | 0.8% | 92.9% |
| 35 | FER-012 | Impermeabilizante acrílico 1 galón | Construcción | sintético | 146 | 0.7% | 93.6% |
| 36 | CER-001 | Candado de bronce 40 mm | Cerrajería | sistema | 145 | 0.7% | 94.3% |
| 37 | FER-041 | Pala cuadrada con mango | Jardinería | sintético | 143 | 0.7% | 95.0% |
| 38 | FER-049 | Adhesivo de contacto 1/4 galón | Adhesivos y Selladores | sintético | 142 | 0.7% | 95.7% |
| 39 | FER-027 | Llave ajustable 10" | Herramientas | sintético | 125 | 0.6% | 96.3% |
| 40 | FER-050 | Pegamento epóxico 2 componentes | Adhesivos y Selladores | sintético | 119 | 0.6% | 96.9% |
| 41 | FER-047 | Casco de seguridad | Seguridad | sintético | 110 | 0.5% | 97.4% |
| 42 | FER-040 | Cerradura de pomo para puerta | Cerrajería | sintético | 93 | 0.5% | 97.9% |
| 43 | FER-044 | Manguera de jardín 1/2" x 15 m | Jardinería | sintético | 92 | 0.4% | 98.3% |
| 44 | FER-024 | Grifo metálico para lavamanos | Plomería | sintético | 86 | 0.4% | 98.7% |
| 45 | ELE-001 | Cable THHN #12 (rollo 100 m) | Eléctrico | sistema | 78 | 0.4% | 99.1% |
| 46 | FER-043 | Rastrillo metálico 16 dientes | Jardinería | sintético | 77 | 0.4% | 99.5% |
| 47 | FER-028 | Taladro percutor 1/2" 750 W | Herramientas Eléctricas | sintético | 38 | 0.2% | 99.7% |
| 48 | FER-029 | Pulidora angular 4-1/2" | Herramientas Eléctricas | sintético | 30 | 0.1% | 99.8% |
| 49 | FER-030 | Sierra circular 7-1/4" | Herramientas Eléctricas | sintético | 20 | 0.1% | 99.9% |
| 50 | FER-031 | Rotomartillo SDS 800 W | Herramientas Eléctricas | sintético | 20 | 0.1% | 100.0% |
