"""
Análisis exploratorio de la demanda diaria.

Lee únicamente data/processed/demanda_diaria.csv —la salida del ETL— y
produce cinco gráficas y un resumen numérico en outputs/eda/.

Todas las cifras del resumen se calculan aquí desde el dataset. Ninguna se
escribe a mano: si el dataset cambia, el resumen cambia con él.

Las cinco gráficas miden magnitud de una sola cosa, así que llevan un solo
color. Pintar cada barra de un color distinto haría pensar que el color
significa algo, y no significa nada.

Uso:
    python src/eda.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # sin ventana: el script corre igual en una terminal sin pantalla

import matplotlib.dates as mdates  # noqa: E402
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

RAIZ = Path(__file__).resolve().parents[1]
DATASET = RAIZ / "data" / "processed" / "demanda_diaria.csv"
SALIDA = RAIZ / "outputs" / "eda"

MESES_CORTOS = {1: "ene", 2: "feb", 3: "mar", 4: "abr", 5: "may", 6: "jun",
                7: "jul", 8: "ago", 9: "sep", 10: "oct", 11: "nov", 12: "dic"}

DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

# Un tono validado contra la superficie (contraste ≥ 3:1, apto para
# daltonismo) para la serie que importa, y grises neutros para el contexto.
SERIE = "#2a78d6"
CONTEXTO = "#b4b2a9"
TEXTO = "#0b0b0b"
TEXTO_SECUNDARIO = "#52514e"
REJILLA = "#e6e5e0"
SUPERFICIE = "#fcfcfb"


def configurar_consola() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")


def configurar_estilo() -> None:
    """
    Marcas finas y ejes discretos: la gráfica se lee por los datos, no por el
    marco. Rejilla sólida y tenue, nunca punteada, y solo en el eje del valor.
    """
    plt.rcParams.update(
        {
            "figure.facecolor": SUPERFICIE,
            "axes.facecolor": SUPERFICIE,
            "axes.edgecolor": REJILLA,
            "axes.labelcolor": TEXTO_SECUNDARIO,
            "axes.titlecolor": TEXTO,
            "axes.titlesize": 13,
            "axes.titleweight": "bold",
            "axes.titlepad": 26,
            "axes.labelsize": 10,
            "axes.spines.top": False,
            "axes.spines.right": False,
            "axes.grid": True,
            "axes.axisbelow": True,
            "grid.color": REJILLA,
            "grid.linestyle": "-",
            "grid.linewidth": 0.8,
            "xtick.color": TEXTO_SECUNDARIO,
            "ytick.color": TEXTO_SECUNDARIO,
            "xtick.labelsize": 9,
            "ytick.labelsize": 9,
            "legend.frameon": False,
            "legend.fontsize": 9,
            "font.family": "sans-serif",
            "savefig.dpi": 150,
            "savefig.bbox": "tight",
        }
    )


def leer_dataset() -> pd.DataFrame:
    datos = pd.read_csv(DATASET, encoding="utf-8", parse_dates=["fecha"])

    # Los dos candados comparten nombre. Sin el código en la etiqueta, las
    # gráficas mostrarían dos barras idénticas imposibles de distinguir.
    datos["etiqueta"] = datos["codigo"] + " · " + datos["producto"]

    return datos


def subtitulo(ax: plt.Axes, texto: str) -> None:
    ax.text(
        0, 1.012, texto, transform=ax.transAxes,
        fontsize=9, color=TEXTO_SECUNDARIO, va="bottom",
    )


def guardar(figura: plt.Figure, nombre: str) -> Path:
    ruta = SALIDA / nombre
    figura.savefig(ruta)
    plt.close(figura)

    return ruta


# ─────────────────────────────────────────────────────────────────────────
# GRÁFICAS
# ─────────────────────────────────────────────────────────────────────────

def demanda_en_el_tiempo(datos: pd.DataFrame) -> Path:
    """
    La demanda diaria es demasiado irregular para leer tendencia a simple
    vista: los domingos caen a cero y los sábados se disparan. Se muestra de
    fondo, y encima el promedio móvil de 28 días, que absorbe cuatro semanas
    completas y deja ver hacia dónde se mueve el negocio.
    """
    diaria = datos.groupby("fecha")["cantidad_vendida"].sum()
    movil = diaria.rolling(28, min_periods=28).mean()

    figura, ax = plt.subplots(figsize=(11, 4.6))

    ax.plot(diaria.index, diaria.values, color=CONTEXTO, linewidth=1, label="Unidades por día")
    ax.plot(movil.index, movil.values, color=SERIE, linewidth=2.2, label="Promedio móvil de 28 días")

    ax.xaxis.set_major_locator(mdates.MonthLocator())
    ax.xaxis.set_major_formatter(
        plt.FuncFormatter(lambda x, _: MESES_CORTOS[mdates.num2date(x).month])
    )

    ax.set_title("Demanda total a lo largo del tiempo", loc="left")
    subtitulo(ax, "Unidades vendidas por día, todos los productos · enero a agosto de 2026")
    ax.set_xlabel("Mes de 2026")
    ax.set_ylabel("Unidades")
    ax.set_ylim(bottom=0)
    ax.grid(axis="x", visible=False)
    ax.legend(loc="upper right")

    return guardar(figura, "01_demanda_tiempo.png")


def barras_horizontales(serie: pd.Series, titulo: str, sub: str, eje: str, nombre: str) -> Path:
    """
    Ranking de mayor a menor, con el valor escrito al final de cada barra:
    en un ranking el número exacto importa y no debería depender de medir
    contra el eje.
    """
    ordenada = serie.sort_values()

    figura, ax = plt.subplots(figsize=(10, 0.55 * len(ordenada) + 1.6))

    barras = ax.barh(ordenada.index, ordenada.values, color=SERIE, height=0.62)
    ax.bar_label(barras, labels=[f"{v:,.0f}" for v in ordenada.values],
                 padding=4, fontsize=9, color=TEXTO)

    ax.set_title(titulo, loc="left")
    subtitulo(ax, sub)
    ax.set_xlabel(eje)
    ax.grid(axis="y", visible=False)
    ax.margins(x=0.12)

    return guardar(figura, nombre)


TOP = 10


def unidades_por_producto(datos: pd.DataFrame) -> pd.Series:
    return datos.groupby("etiqueta")["cantidad_vendida"].sum().sort_values(ascending=False)


def productos_mas_vendidos(datos: pd.DataFrame) -> Path:
    """
    Solo los diez primeros. Cincuenta barras no se leen: el ranking completo
    está en el resumen, y aquí importa quién encabeza.
    """
    unidades = unidades_por_producto(datos)
    top = unidades.head(TOP)

    return barras_horizontales(
        top,
        f"Top {TOP} productos por unidades vendidas",
        f"Enero a agosto de 2026 · estos {TOP} suman el {100 * top.sum() / unidades.sum():.1f}% "
        f"de las unidades de los {len(unidades)} productos",
        "Unidades vendidas",
        "02_productos_mas_vendidos.png",
    )


def demanda_por_categoria(datos: pd.DataFrame) -> Path:
    productos = datos.groupby("categoria")["producto_id"].nunique()
    unidades = datos.groupby("categoria")["cantidad_vendida"].sum()

    # El número de productos va en la etiqueta: una categoría con seis
    # productos no se compara igual que una con tres.
    unidades.index = [f"{c} ({productos[c]})" for c in unidades.index]

    return barras_horizontales(
        unidades,
        "Demanda por categoría",
        "Unidades vendidas de enero a agosto de 2026 · entre paréntesis, productos en la categoría",
        "Unidades vendidas",
        "03_demanda_categoria.png",
    )


def demanda_por_dia_de_semana(datos: pd.DataFrame) -> Path:
    """
    Promedio y no total: el período no tiene el mismo número de lunes que de
    sábados, y un total premiaría al día que más veces aparece.
    """
    promedio = demanda_promedio_por_dia(datos)

    figura, ax = plt.subplots(figsize=(10, 4.6))

    barras = ax.bar(DIAS, promedio.values, color=SERIE, width=0.62)
    ax.bar_label(barras, labels=[f"{v:.1f}" if v > 0 else "" for v in promedio.values],
                 padding=3, fontsize=9, color=TEXTO)

    ax.annotate("Cerrado", xy=(6, 0), xytext=(6, promedio.max() * 0.04),
                ha="center", fontsize=9, color=TEXTO_SECUNDARIO)

    ax.set_title("Demanda promedio por día de la semana", loc="left")
    subtitulo(ax, "Unidades por día, todos los productos · feriados incluidos en su día")
    ax.set_ylabel("Unidades promedio")
    ax.grid(axis="x", visible=False)
    ax.margins(y=0.12)

    return guardar(figura, "04_demanda_dia_semana.png")


def distribucion_de_la_demanda(datos: pd.DataFrame) -> Path:
    """
    Una barra por cada cantidad entera: la demanda son unidades, y un
    histograma con intervalos continuos inventaría valores como 2.5 martillos.

    La cola larga —los pedidos grandes de contratistas— se agrupa en la última
    barra. Con una barra por entero hasta el máximo, esos pocos registros
    estirarían el eje y aplastarían el resto de la distribución.
    """
    cantidades = datos["cantidad_vendida"]
    ceros = 100 * (cantidades == 0).mean()

    # Tope en el percentil 99.5 redondeado a múltiplo de 5: deja casi todo
    # visible con una barra propia y agrupa solo lo excepcional.
    tope = int(np.ceil(np.percentile(cantidades, 99.5) / 5) * 5)
    conteo = cantidades.clip(upper=tope).value_counts().sort_index()
    agrupados = int((cantidades >= tope).sum())

    figura, ax = plt.subplots(figsize=(10, 4.6))

    ax.bar(conteo.index, conteo.values, color=SERIE, width=0.72)

    marcas = list(range(0, tope, 5)) + [tope]
    ax.set_xticks(marcas, [str(m) for m in marcas[:-1]] + [f"≥{tope}"])

    ax.set_title("Distribución de la cantidad vendida por producto por día", loc="left")
    subtitulo(
        ax,
        f"{len(datos):,} registros producto-día · {ceros:.1f}% son días sin venta · "
        f"la última barra agrupa {agrupados} registros de {tope} o más (máximo {cantidades.max()})",
    )
    ax.set_xlabel("Unidades vendidas en el día")
    ax.set_ylabel("Registros producto-día")
    ax.grid(axis="x", visible=False)

    return guardar(figura, "05_distribucion_demanda.png")


# ─────────────────────────────────────────────────────────────────────────
# RESUMEN
# ─────────────────────────────────────────────────────────────────────────

def demanda_promedio_por_dia(datos: pd.DataFrame) -> pd.Series:
    diaria = datos.groupby("fecha")["cantidad_vendida"].sum()

    return diaria.groupby(diaria.index.dayofweek).mean().reindex(range(7), fill_value=0)


def tendencia(datos: pd.DataFrame) -> dict:
    """
    Se compara el promedio diario del primer y del último bimestre, y se
    ajusta una recta sobre el promedio diario de cada mes.

    Promedio diario y no total mensual: febrero tiene 28 días y abril perdió
    dos por Semana Santa, así que comparar totales mezclaría la demanda con
    la longitud del mes.
    """
    diaria = datos.groupby("fecha")["cantidad_vendida"].sum()
    por_mes = diaria.groupby(diaria.index.month).mean()

    inicio = diaria[diaria.index.month.isin([1, 2])].mean()
    final = diaria[diaria.index.month.isin([7, 8])].mean()
    pendiente = np.polyfit(np.arange(len(por_mes)), por_mes.values, 1)[0]

    return {
        "por_mes": por_mes,
        "inicio": inicio,
        "final": final,
        "cambio_pct": 100 * (final - inicio) / inicio,
        "pendiente": pendiente,
        "mes_pico": int(por_mes.idxmax()),
        "mes_valle": int(por_mes.idxmin()),
    }


def enumerar(elementos: list[str]) -> str:
    """"A, B y C" en vez de "A, B, C"."""
    if len(elementos) <= 1:
        return "".join(elementos)

    return ", ".join(elementos[:-1]) + " y " + elementos[-1]


MESES = {1: "enero", 2: "febrero", 3: "marzo", 4: "abril",
         5: "mayo", 6: "junio", 7: "julio", 8: "agosto"}


def tabla_de_productos(datos: pd.DataFrame) -> pd.DataFrame:
    tabla = (
        datos.groupby(["codigo", "producto", "categoria", "origen"], as_index=False)
        .agg(unidades=("cantidad_vendida", "sum"), ingreso=("ingreso", "sum"))
        .sort_values(["unidades", "codigo"], ascending=[False, True])
        .reset_index(drop=True)
    )
    tabla["pct"] = 100 * tabla["unidades"] / tabla["unidades"].sum()
    tabla["pct_acumulado"] = tabla["pct"].cumsum()

    return tabla


def tabla_de_categorias(datos: pd.DataFrame) -> pd.DataFrame:
    tabla = (
        datos.groupby("categoria")
        .agg(
            productos=("producto_id", "nunique"),
            unidades=("cantidad_vendida", "sum"),
            ingreso=("ingreso", "sum"),
        )
        .sort_values("unidades", ascending=False)
    )
    tabla["pct_unidades"] = 100 * tabla["unidades"] / tabla["unidades"].sum()
    tabla["pct_ingreso"] = 100 * tabla["ingreso"] / tabla["ingreso"].sum()
    tabla["unidades_por_producto"] = tabla["unidades"] / tabla["productos"]

    return tabla


# En el dataset el origen es un identificador sin tilde; aquí se muestra legible.
ORIGEN_LEGIBLE = {"sistema": "sistema", "sintetico": "sintético"}


def filas_de_ranking(tabla: pd.DataFrame) -> list[str]:
    return [
        f"| {i} | {f.codigo} | {f.producto} | {f.categoria} | {ORIGEN_LEGIBLE[f.origen]} | "
        f"{f.unidades:,} | {f.pct:.1f}% | {f.pct_acumulado:.1f}% |"
        for i, f in enumerate(tabla.itertuples(index=False), start=1)
    ]


def nombrar(productos: pd.DataFrame) -> str:
    return enumerar([f"**{f.codigo} · {f.producto}** ({f.categoria})" for f in productos.itertuples()])


def escribir_resumen(datos: pd.DataFrame) -> Path:
    productos = tabla_de_productos(datos)
    categorias = tabla_de_categorias(datos)
    por_dia = demanda_promedio_por_dia(datos)
    diaria = datos.groupby("fecha")["cantidad_vendida"].sum()
    t = tendencia(datos)

    total = int(datos["cantidad_vendida"].sum())
    ingreso = float(datos["ingreso"].sum())
    ceros = 100 * (datos["cantidad_vendida"] == 0).mean()
    dias_abiertos = int((diaria > 0).sum())
    origen = datos.groupby("origen")["producto_id"].nunique()

    # Con empate se nombran todos: ordenar por código elegiría uno en silencio.
    mas_vendido = productos.iloc[0]
    menos_vendidos = productos[productos["unidades"] == productos["unidades"].min()]
    minimo = int(menos_vendidos["unidades"].iloc[0])
    dia_fuerte = DIAS[int(por_dia.idxmax())]
    habiles = por_dia.iloc[:5].mean()

    top = productos.head(TOP)
    sistema_en_top = int((top["origen"] == "sistema").sum())
    productos_80 = int((productos["pct_acumulado"] < 80).sum()) + 1

    lectura_concentracion = (
        f"Un solo producto concentra una parte grande del volumen ({mas_vendido.pct:.1f}%): "
        "es el que más pesa sobre el error del modelo."
        if mas_vendido.pct >= 20
        else f"Ningún producto domina: el más vendido representa el {mas_vendido.pct:.1f}% "
        f"de las unidades. Hacen falta {productos_80} de los {len(productos)} productos "
        "para llegar al 80%, así que el error del modelo no quedará dominado por uno solo."
    )

    # ¿Queda alguna categoría con un solo producto? Antes eran cinco de siete.
    unicas = categorias[categorias["productos"] == 1].index.tolist()
    lectura_categorias = (
        f"Las {len(categorias)} categorías tienen entre {categorias['productos'].min()} y "
        f"{categorias['productos'].max()} productos, ninguna con uno solo. Por eso la "
        "categoría ahora puede aportar información propia al modelo, en vez de repetir "
        "lo que ya dice el producto."
        if not unicas
        else f"{enumerar(unicas)} tiene(n) un solo producto: ahí la categoría no aporta "
        "nada que el producto no diga ya."
    )

    # Las unidades no son comparables entre categorías: un codo de PVC y un
    # taladro cuentan igual. Se contrasta contra el ingreso.
    lider_unidades = categorias.index[0]
    lider_ingreso = categorias["ingreso"].idxmax()
    lectura_unidades = (
        f"{lider_unidades} lidera tanto en unidades como en ingreso "
        f"({categorias.loc[lider_ingreso, 'pct_ingreso']:.1f}% del ingreso)."
        if lider_unidades == lider_ingreso
        else f"Pero las unidades no son comparables entre categorías: un codo de PVC y un "
        f"taladro cuentan igual. En ingreso lidera **{lider_ingreso}** "
        f"({categorias.loc[lider_ingreso, 'pct_ingreso']:.1f}% del ingreso), no "
        f"{lider_unidades} ({categorias.loc[lider_unidades, 'pct_ingreso']:.1f}%)."
    )

    # Ceros por estructura (la ferretería no abre) contra ceros por demanda.
    cerrados = datos["fecha"].isin(diaria[diaria == 0].index)
    ceros_por_cierre = int(cerrados.sum())
    ceros_totales = int((datos["cantidad_vendida"] == 0).sum())
    ceros_por_demanda = ceros_totales - ceros_por_cierre
    abiertos = datos[~cerrados]
    ceros_abierto = 100 * (abiertos["cantidad_vendida"] == 0).mean()

    # Temporada seca (febrero a abril) contra lluvias (junio a agosto), medido.
    seca = t["por_mes"].loc[[2, 3, 4]].mean()
    lluvias = t["por_mes"].loc[[6, 7, 8]].mean()
    diferencia_temporada = 100 * (seca - lluvias) / lluvias
    lectura_temporada = (
        f"La temporada seca (febrero a abril) promedia {seca:.2f} unidades/día y la "
        f"de lluvias (junio a agosto) {lluvias:.2f}: {diferencia_temporada:+.1f}%. "
        + (
            "Esa diferencia estacional es mayor que el cambio entre el inicio y el "
            "final del período, así que la variación está dominada por la temporada "
            "y no por un crecimiento sostenido. El modelo tendrá que capturar la "
            "estacionalidad; una tendencia lineal sola no la explicaría."
            if abs(diferencia_temporada) > abs(t["cambio_pct"])
            else "El cambio entre el inicio y el final del período es mayor que la "
            "diferencia estacional, así que la tendencia pesa más que la temporada."
        )
    )

    lectura_tendencia = (
        "estable" if abs(t["cambio_pct"]) < 5
        else "creciente" if t["cambio_pct"] > 0
        else "decreciente"
    )

    lineas = [
        "# Resumen del análisis exploratorio",
        "",
        "> Calculado por `src/eda.py` a partir de `data/processed/demanda_diaria.csv`.",
        "> Ninguna cifra de este archivo se escribió a mano.",
        ">",
        f"> **Transparencia sobre los datos:** de los {len(productos)} productos, "
        f"{origen.get('sistema', 0)} son reales del",
        f"> catálogo del Sistema Ferretería y {origen.get('sintetico', 0)} son sintéticos académicos. "
        "**Todas las ventas son",
        "> simuladas** (semilla 42). Nada de esto describe ventas reales.",
        "",
        "## Volumen",
        "",
        "| Métrica | Valor |",
        "|---|---|",
        f"| Período | {datos['fecha'].min():%Y-%m-%d} a {datos['fecha'].max():%Y-%m-%d} |",
        f"| Productos | {len(productos)} ({origen.get('sistema', 0)} del sistema, "
        f"{origen.get('sintetico', 0)} sintéticos) |",
        f"| Categorías | {len(categorias)} |",
        f"| Registros producto-día | {len(datos):,} |",
        f"| Total de unidades vendidas | {total:,} |",
        f"| Ingreso total | L {ingreso:,.2f} |",
        f"| Demanda promedio diaria (todos los productos) | {diaria.mean():.2f} unidades |",
        f"| Demanda promedio en días de atención | {diaria[diaria > 0].mean():.2f} unidades |",
        f"| Días con ventas | {dias_abiertos} de {len(diaria)} |",
        f"| Registros producto-día sin venta | {ceros:.1f}% |",
        "",
        f"## Top {TOP} productos",
        "",
        "| # | Código | Producto | Categoría | Origen | Unidades | % | % acumulado |",
        "|---|---|---|---|---|---|---|---|",
        *filas_de_ranking(top),
        "",
        f"Los {TOP} primeros suman el **{top['pct'].sum():.1f}%** de las unidades. "
        f"{sistema_en_top} de ellos son productos del sistema.",
        "",
        "## Categorías",
        "",
        "| Categoría | Productos | Unidades | % unidades | Ingreso | % ingreso | Unidades por producto |",
        "|---|---|---|---|---|---|---|",
        # itertuples y no iterrows: iterrows convierte la fila entera a decimal
        # cuando mezcla enteros y decimales, y la tabla mostraría "6.0 productos".
        *[
            f"| {f.Index} | {f.productos} | {f.unidades:,} | {f.pct_unidades:.1f}% | "
            f"L {f.ingreso:,.2f} | {f.pct_ingreso:.1f}% | {f.unidades_por_producto:,.0f} |"
            for f in categorias.itertuples()
        ],
        "",
        "## Hallazgos",
        "",
        "### 1. Producto más vendido",
        "",
        f"**{mas_vendido.codigo} · {mas_vendido.producto}** ({mas_vendido.categoria}), con "
        f"{mas_vendido.unidades:,} unidades.",
        "",
        lectura_concentracion,
        "",
        "### 2. Producto menos vendido",
        "",
        (
            f"{nombrar(menos_vendidos)}, con {minimo:,} unidades."
            if len(menos_vendidos) == 1
            else f"Empate entre {nombrar(menos_vendidos)}, con {minimo:,} unidades cada uno."
        ),
        "",
        f"Vende{'n' if len(menos_vendidos) > 1 else ''} {mas_vendido.unidades / minimo:.0f} "
        "veces menos que el más "
        "vendido. Productos así pasan la mayoría de los días sin venta: son los más difíciles "
        "de predecir, y un modelo que prediga demanda media constante les recomendaría "
        "comprar de más.",
        "",
        "### 3. Categoría con mayor demanda",
        "",
        f"**{lider_unidades}**, con {categorias.loc[lider_unidades, 'unidades']:,} unidades "
        f"({categorias.loc[lider_unidades, 'pct_unidades']:.1f}% del total).",
        "",
        lectura_unidades,
        "",
        lectura_categorias,
        "",
        "### 4. Día de semana con mayor demanda",
        "",
        f"**{dia_fuerte}**, con {por_dia.max():.1f} unidades promedio, frente a "
        f"{habiles:.1f} de lunes a viernes "
        f"({100 * (por_dia.max() - habiles) / habiles:+.0f}%). El domingo es 0: la "
        "ferretería no abre.",
        "",
        "El día de la semana es una variable útil para el modelo: la diferencia es "
        "grande y sistemática.",
        "",
        "### 5. Registros sin venta",
        "",
        f"El **{ceros:.1f}%** de los registros producto-día tienen cero ventas: "
        f"{ceros_totales:,} registros.",
        "",
        f"- **{ceros_por_cierre:,}** son días en que la ferretería no abrió (domingos y "
        "feriados). Son ceros estructurales: el modelo los aprende del calendario.",
        f"- **{ceros_por_demanda:,}** son días abiertos en que el producto no se vendió. "
        f"Incluso con la tienda abierta, el {ceros_abierto:.1f}% de los registros "
        "producto-día no tienen venta: eso es demanda intermitente, y es lo difícil.",
        "",
        "Es la razón de haber completado la matriz con ceros en el ETL, y la razón para no "
        "usar MAPE como métrica: con demanda real en cero, el error porcentual se vuelve "
        "infinito.",
        "",
        "### 6. Tendencia general",
        "",
        "Promedio diario de unidades por mes:",
        "",
        "| Mes | Unidades por día |",
        "|---|---|",
        *[f"| {MESES[m]} | {v:.2f} |" for m, v in t["por_mes"].items()],
        "",
        f"Primer bimestre: {t['inicio']:.2f} unidades/día · último bimestre: "
        f"{t['final']:.2f} · cambio: **{t['cambio_pct']:+.1f}%**. Pendiente de la "
        f"recta sobre los promedios mensuales: {t['pendiente']:+.3f} unidades/día por mes.",
        "",
        f"Lectura: **{lectura_tendencia}**. El pico es {MESES[t['mes_pico']]} y el "
        f"valle {MESES[t['mes_valle']]}.",
        "",
        lectura_temporada,
        "",
        "## Anexo: ranking completo",
        "",
        "| # | Código | Producto | Categoría | Origen | Unidades | % | % acumulado |",
        "|---|---|---|---|---|---|---|---|",
        *filas_de_ranking(productos),
        "",
    ]

    ruta = SALIDA / "resumen_eda.md"
    # newline fijo por la misma razón que en el ETL: sin él, Windows escribe
    # CRLF y el resumen deja de ser idéntico entre sistemas.
    ruta.write_text("\n".join(lineas), encoding="utf-8", newline="\n")

    return ruta


def main() -> None:
    configurar_consola()
    configurar_estilo()
    SALIDA.mkdir(parents=True, exist_ok=True)

    datos = leer_dataset()

    generadas = [
        demanda_en_el_tiempo(datos),
        productos_mas_vendidos(datos),
        demanda_por_categoria(datos),
        demanda_por_dia_de_semana(datos),
        distribucion_de_la_demanda(datos),
        escribir_resumen(datos),
    ]

    print("Archivos generados:")
    for ruta in generadas:
        print(f"  {ruta.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
