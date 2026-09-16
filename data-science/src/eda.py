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


def productos_mas_vendidos(datos: pd.DataFrame) -> Path:
    return barras_horizontales(
        datos.groupby("etiqueta")["cantidad_vendida"].sum(),
        "Productos por unidades vendidas",
        "Total acumulado de enero a agosto de 2026",
        "Unidades vendidas",
        "02_productos_mas_vendidos.png",
    )


def demanda_por_categoria(datos: pd.DataFrame) -> Path:
    return barras_horizontales(
        datos.groupby("categoria")["cantidad_vendida"].sum(),
        "Demanda por categoría",
        "Unidades vendidas de enero a agosto de 2026",
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
    """
    conteo = datos["cantidad_vendida"].value_counts().sort_index()
    ceros = 100 * (datos["cantidad_vendida"] == 0).mean()

    figura, ax = plt.subplots(figsize=(10, 4.6))

    ax.bar(conteo.index, conteo.values, color=SERIE, width=0.72)

    ax.set_title("Distribución de la cantidad vendida por producto por día", loc="left")
    subtitulo(ax, f"{len(datos):,} registros producto-día · {ceros:.1f}% son días sin venta")
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


def escribir_resumen(datos: pd.DataFrame) -> Path:
    por_producto = datos.groupby("etiqueta")["cantidad_vendida"].sum().sort_values()
    por_categoria = datos.groupby("categoria")["cantidad_vendida"].sum().sort_values()
    por_dia = demanda_promedio_por_dia(datos)
    diaria = datos.groupby("fecha")["cantidad_vendida"].sum()
    t = tendencia(datos)

    total = int(datos["cantidad_vendida"].sum())
    ingreso = float(datos["ingreso"].sum())
    ceros = 100 * (datos["cantidad_vendida"] == 0).mean()
    dias_abiertos = int((diaria > 0).sum())

    mas_vendido, menos_vendido = por_producto.index[-1], por_producto.index[0]
    dia_fuerte = DIAS[int(por_dia.idxmax())]
    habiles = por_dia.iloc[:5].mean()

    productos_por_categoria = datos.groupby("categoria")["producto_id"].nunique()
    compartidas = productos_por_categoria[productos_por_categoria > 1]
    lectura_categorias = (
        "Cada categoría tiene un solo producto, así que este resultado refleja al "
        "producto que la compone y no un patrón de categoría."
        if compartidas.empty
        else f"De las {len(productos_por_categoria)} categorías, solo "
        + enumerar([f"{c} ({n})" for c, n in compartidas.items()])
        + " tienen más de un producto. El resto refleja un único producto, así que "
        "este resultado dice más del producto que de la categoría."
    )

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
        "> **Los datos son simulados** (semilla 42) sobre los 9 productos reales del",
        "> Sistema Ferretería. Ninguna cifra de este archivo se escribió a mano.",
        "",
        "## Volumen",
        "",
        "| Métrica | Valor |",
        "|---|---|",
        f"| Período | {datos['fecha'].min():%Y-%m-%d} a {datos['fecha'].max():%Y-%m-%d} |",
        f"| Registros producto-día | {len(datos):,} |",
        f"| Total de unidades vendidas | {total:,} |",
        f"| Ingreso total | L {ingreso:,.2f} |",
        f"| Demanda promedio diaria (todos los productos) | {diaria.mean():.2f} unidades |",
        f"| Demanda promedio en días de atención | {diaria[diaria > 0].mean():.2f} unidades |",
        f"| Días con ventas | {dias_abiertos} de {len(diaria)} |",
        f"| Registros producto-día sin venta | {ceros:.1f}% |",
        "",
        "## Hallazgos",
        "",
        "### 1. Producto más vendido",
        "",
        f"**{mas_vendido}**, con {por_producto.iloc[-1]:,} unidades "
        f"({100 * por_producto.iloc[-1] / total:.1f}% del total).",
        "",
        "Un solo producto concentra una parte grande del volumen. Es el que más "
        "impacto tiene sobre el error del modelo y el que menos margen deja para "
        "equivocarse en la reposición.",
        "",
        "### 2. Producto menos vendido",
        "",
        f"**{menos_vendido}**, con {por_producto.iloc[0]:,} unidades.",
        "",
        f"Vende {por_producto.iloc[-1] / por_producto.iloc[0]:.0f} veces menos que el "
        "más vendido. Productos así pasan muchos días sin venta, y un modelo que "
        "prediga demanda media constante les recomendaría comprar de más.",
        "",
        "### 3. Categoría con mayor demanda",
        "",
        f"**{por_categoria.index[-1]}**, con {por_categoria.iloc[-1]:,} unidades "
        f"({100 * por_categoria.iloc[-1] / total:.1f}% del total).",
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
        f"El **{ceros:.1f}%** de los registros producto-día tienen cero ventas.",
        "",
        "Una parte viene de los días cerrados (domingos y feriados) y el resto de "
        "productos de baja rotación. Es la razón de haber completado la matriz con "
        "ceros en el ETL, y la razón para no usar MAPE como métrica: con demanda "
        "real en cero, el error porcentual se vuelve infinito.",
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
