"""
Entrena y evalúa el modelo de demanda, y guarda el modelo final.

QUÉ HACE, EN ORDEN

1. Verifica con datos que ninguna variable usa información futura.
2. Evalúa en agosto: entrena con enero a julio y predice agosto.
3. Evalúa con backtesting de origen móvil: repite el paso anterior desde varios
   cortes semanales entre mayo y agosto.
4. Compara el Random Forest contra el baseline en ambas evaluaciones.
5. Recién entonces entrena el modelo final con todo el historial y lo guarda.

El orden importa. El modelo final no participa de ninguna métrica: se entrena
con datos que incluyen agosto, y evaluarlo en agosto sería medirlo contra lo
que ya vio.

LA CONFIGURACIÓN SE FIJÓ ANTES DE VER RESULTADOS

Los hiperparámetros y la frecuencia de los cortes están escritos abajo y no se
ajustaron mirando las métricas. Tampoco hubo búsqueda de hiperparámetros: con
un solo período de evaluación, elegir la configuración que mejor sale en agosto
y reportar su error en agosto sería medir el modelo contra los datos con los
que se eligió.

Uso:
    python src/train.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from eda import SERIE, CONTEXTO, TEXTO, TEXTO_SECUNDARIO, configurar_estilo, plt
from features import (
    CATEGORICAS, EXCLUIDAS, HORIZONTES, baseline, construir, leer_demanda,
    numericas, objetivo, probar_la_verificacion, variables, verificar_sin_fuga,
)
from generate_dataset import PRODUCTOS

RAIZ = Path(__file__).resolve().parents[1]
MODELOS = RAIZ / "models"
SALIDA = RAIZ / "outputs" / "model"

SEMILLA = 42

# Un bosque razonable y estable, sin búsqueda. min_samples_leaf evita hojas de
# una sola observación, que con 47% de ceros memorizarían días sueltos.
# max_features=0.5 hace que cada árbol mire una parte distinta de las
# variables, que es lo que vuelve útil promediarlos.
CONFIGURACION_BOSQUE = {
    "n_estimators": 200,
    "min_samples_leaf": 5,
    "max_features": 0.5,
    "random_state": SEMILLA,
    "n_jobs": -1,
}

FIN_HISTORIAL = pd.Timestamp("2026-08-31")

# Evaluación principal: se entrena con lo conocido al cierre de julio.
CORTE_PRINCIPAL = pd.Timestamp("2026-07-31")

# Backtesting: un corte por semana desde mayo, mientras quede el futuro
# completo del horizonte dentro del historial. Mayo da al primer corte tres
# meses de entrenamiento; empezar antes dejaría modelos entrenados con muy poco.
PRIMER_CORTE = pd.Timestamp("2026-05-01")
DIAS_ENTRE_CORTES = 7

# Por debajo de esta diferencia no se declara ganador. Con 700 predicciones
# que ni siquiera son independientes, un 0.2% no distingue un modelo de otro, y
# decir "el baseline es mejor" por eso sería tan exagerado como decir lo
# contrario.
EMPATE_PRACTICO_PCT = 1.0

ROTACION = {codigo: parametros[0] for codigo, parametros in PRODUCTOS.items()}
ORDEN_ROTACION = ["alta", "media", "baja"]


def configurar_consola() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")


# ─────────────────────────────────────────────────────────────────────────
# MODELO
# ─────────────────────────────────────────────────────────────────────────

def crear_pipeline(horizonte: int) -> Pipeline:
    """
    Producto y categoría entran con one-hot. Convertirlos a números
    (producto 1, producto 2…) inventaría un orden: el árbol podría separar
    "productos menores que 23", que no significa nada.

    Las variables de calendario sí entran como números: el mes y el día de la
    semana tienen un orden real, y un árbol maneja bien ese tipo de variable.
    """
    preproceso = ColumnTransformer(
        [
            ("categoricas", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAS),
            ("numericas", "passthrough", numericas(horizonte)),
        ]
    )

    return Pipeline(
        [
            ("preproceso", preproceso),
            ("bosque", RandomForestRegressor(**CONFIGURACION_BOSQUE)),
        ]
    )


def conocidas_al_corte(filas: pd.DataFrame, horizonte: int, corte: pd.Timestamp) -> pd.DataFrame:
    """
    Filas cuyo objetivo ya se conocía completo al cierre del corte.

    No basta con que la fecha de la fila sea anterior al corte. Una fila del 20
    de julio tiene como objetivo a 30 días las ventas hasta el 19 de agosto: al
    31 de julio esa respuesta todavía no existe. Entrenar con ella sería
    enseñarle al modelo el futuro que después se le pide predecir.
    """
    completo = filas["fecha"] + pd.Timedelta(days=horizonte) <= corte

    return filas[completo & filas[objetivo(horizonte)].notna()]


def entrenar_y_predecir(
    filas: pd.DataFrame, horizonte: int, corte: pd.Timestamp, a_predecir: pd.DataFrame
) -> tuple[pd.DataFrame, dict]:
    entrenamiento = conocidas_al_corte(filas, horizonte, corte)

    modelo = crear_pipeline(horizonte)
    modelo.fit(entrenamiento[variables(horizonte)], entrenamiento[objetivo(horizonte)])

    resultado = a_predecir[["fecha", "producto_id", "codigo", "producto", "categoria"]].copy()
    resultado["corte"] = corte
    resultado["real"] = a_predecir[objetivo(horizonte)].to_numpy()
    resultado["baseline"] = a_predecir[baseline(horizonte)].to_numpy()
    resultado["random_forest"] = modelo.predict(a_predecir[variables(horizonte)])

    control = {
        "corte": corte.date().isoformat(),
        "filas_entrenamiento": int(len(entrenamiento)),
        "ultima_fila_entrenamiento": entrenamiento["fecha"].max().date().isoformat(),
        "ultimo_dia_de_objetivo_en_entrenamiento": (
            entrenamiento["fecha"].max() + pd.Timedelta(days=horizonte)
        ).date().isoformat(),
        "filas_evaluadas": int(len(a_predecir)),
        # Lo que se evalúa empieza después del corte y termina dentro del historial.
        "sin_solapamiento": bool(
            entrenamiento["fecha"].max() + pd.Timedelta(days=horizonte) <= corte
            and a_predecir["fecha"].min() >= corte
            and a_predecir["fecha"].max() + pd.Timedelta(days=horizonte) <= FIN_HISTORIAL
        ),
    }

    return resultado, control


def evaluar_en_agosto(filas: pd.DataFrame, horizonte: int) -> tuple[pd.DataFrame, dict]:
    """
    Entrena con lo conocido al 31 de julio y predice desde cada día de agosto
    que tenga su futuro completo. A 7 días son del 1 al 24 de agosto; a 30 días,
    solo el 1 de agosto.
    """
    evaluables = filas[
        (filas["fecha"] > CORTE_PRINCIPAL) & filas[objetivo(horizonte)].notna()
    ]

    return entrenar_y_predecir(filas, horizonte, CORTE_PRINCIPAL, evaluables)


def cortes_de_backtest(horizonte: int) -> list[pd.Timestamp]:
    cortes = []
    corte = PRIMER_CORTE

    while corte + pd.Timedelta(days=horizonte) <= FIN_HISTORIAL:
        cortes.append(corte)
        corte += pd.Timedelta(days=DIAS_ENTRE_CORTES)

    return cortes


def backtest(filas: pd.DataFrame, horizonte: int) -> tuple[pd.DataFrame, list[dict]]:
    """
    Origen móvil: en cada corte se entrena solo con lo conocido hasta ese día,
    se predice desde ese día, y se avanza una semana. Cada corte entrena un
    modelo nuevo, así que ningún modelo ve el período que se le evalúa.
    """
    predicciones, controles = [], []

    for corte in cortes_de_backtest(horizonte):
        desde_el_corte = filas[(filas["fecha"] == corte) & filas[objetivo(horizonte)].notna()]
        resultado, control = entrenar_y_predecir(filas, horizonte, corte, desde_el_corte)

        predicciones.append(resultado)
        controles.append(control)

    return pd.concat(predicciones, ignore_index=True), controles


# ─────────────────────────────────────────────────────────────────────────
# MÉTRICAS
# ─────────────────────────────────────────────────────────────────────────

def metricas(real: pd.Series, prediccion: pd.Series) -> dict:
    """
    MAE:  en promedio, por cuántas unidades se equivoca.
    RMSE: igual, pero castiga más los errores grandes, que son los que dejan
          un producto agotado.
    WAPE: error absoluto total sobre la demanda total. Se usa en vez de MAPE
          porque casi la mitad de los días tienen venta cero, y el MAPE divide
          por la venta real de cada fila: con ceros, se vuelve infinito.
    """
    error = prediccion - real
    total = real.sum()

    return {
        "mae": round(float(np.abs(error).mean()), 4),
        "rmse": round(float(np.sqrt((error**2).mean())), 4),
        "wape": round(float(np.abs(error).sum() / total), 4) if total > 0 else None,
        # Positivo: predice de más. No es una métrica de precisión, sino de
        # dirección: dos modelos con el mismo MAE pueden fallar hacia lados opuestos.
        "sesgo": round(float(error.mean()), 4),
    }


def mejora(base: dict, modelo: dict) -> dict:
    """Positivo: el modelo se equivoca menos que el baseline. Negativo: más."""
    return {
        clave: round(100 * (base[clave] - modelo[clave]) / base[clave], 2)
        if base[clave] not in (None, 0) and modelo[clave] is not None
        else None
        for clave in ("mae", "rmse", "wape")
    }


def comparar(resultado: pd.DataFrame) -> dict:
    base = metricas(resultado["real"], resultado["baseline"])
    bosque = metricas(resultado["real"], resultado["random_forest"])

    return {
        "observaciones": int(len(resultado)),
        "demanda_real_total": int(resultado["real"].sum()),
        "baseline": base,
        "random_forest": bosque,
        "mejora_porcentual": mejora(base, bosque),
    }


def comparar_por_rotacion(resultado: pd.DataFrame) -> dict:
    """
    Solo para analizar. La rotación es un parámetro del generador y no una
    variable del modelo: se usa aquí para agrupar resultados, nunca para
    predecir.
    """
    rotacion = resultado["codigo"].map(ROTACION)

    return {nivel: comparar(resultado[rotacion == nivel]) for nivel in ORDEN_ROTACION}


def tabla_por_producto(resultado: pd.DataFrame) -> pd.DataFrame:
    tabla = (
        resultado.assign(
            error_rf=(resultado["random_forest"] - resultado["real"]).abs(),
            error_baseline=(resultado["baseline"] - resultado["real"]).abs(),
        )
        .groupby(["producto_id", "codigo", "producto", "categoria"], as_index=False)
        .agg(
            predicciones=("real", "size"),
            demanda_real=("real", "sum"),
            prediccion_rf=("random_forest", "sum"),
            prediccion_baseline=("baseline", "sum"),
            mae_rf=("error_rf", "mean"),
            mae_baseline=("error_baseline", "mean"),
            error_absoluto_rf=("error_rf", "sum"),
        )
    )
    tabla["rotacion"] = tabla["codigo"].map(ROTACION)
    tabla["wape_rf"] = np.where(
        tabla["demanda_real"] > 0, tabla["error_absoluto_rf"] / tabla["demanda_real"], np.nan
    )
    tabla["gana"] = np.where(tabla["mae_rf"] < tabla["mae_baseline"], "random_forest", "baseline")

    return tabla.sort_values("mae_rf", ascending=False).reset_index(drop=True)


def importancia_de_variables(modelo: Pipeline) -> pd.Series:
    """
    Importancia por variable original. El one-hot parte producto_id en 50
    columnas; aquí se vuelven a sumar para poder comparar "el producto" contra
    "la media de 28 días".

    Es importancia por reducción de impureza: favorece a las variables con
    muchos valores posibles. Sirve para ver qué usa el modelo, no para
    afirmar causalidad.
    """
    nombres = modelo.named_steps["preproceso"].get_feature_names_out()
    importancias = modelo.named_steps["bosque"].feature_importances_

    originales = []
    for nombre in nombres:
        _, _, resto = nombre.partition("__")
        originales.append(next((c for c in CATEGORICAS if resto.startswith(c + "_")), resto))

    return pd.Series(importancias, index=originales).groupby(level=0).sum().sort_values(ascending=False)


# ─────────────────────────────────────────────────────────────────────────
# GRÁFICAS
# ─────────────────────────────────────────────────────────────────────────

def guardar(figura, nombre: str) -> Path:
    ruta = SALIDA / nombre
    figura.savefig(ruta)
    plt.close(figura)

    return ruta


def real_vs_predicho(resultado: pd.DataFrame, horizonte: int, nombre: str) -> Path:
    """
    Un panel por rotación. En un solo gráfico, los productos de alta rotación
    (cientos de unidades) aplastarían contra el origen a los de baja (dos o
    tres), justo los que más interesa ver. Cada panel tiene su propia escala y
    un solo color: la rotación se lee en el título, no en el color.
    """
    rotacion = resultado["codigo"].map(ROTACION)
    figura, ejes = plt.subplots(1, 3, figsize=(13, 4.6))

    for ax, nivel in zip(ejes, ORDEN_ROTACION):
        grupo = resultado[rotacion == nivel]
        tope = max(grupo["real"].max(), grupo["random_forest"].max()) * 1.05 or 1

        ax.plot([0, tope], [0, tope], color=CONTEXTO, linewidth=1.2, label="Predicción perfecta")
        ax.scatter(grupo["real"], grupo["random_forest"], s=14, color=SERIE, alpha=0.45,
                   linewidths=0, label="Predicción del modelo")

        m = metricas(grupo["real"], grupo["random_forest"])
        ax.set_title(f"Rotación {nivel}", loc="left", fontsize=11)
        ax.text(0.03, 0.97, f"MAE {m['mae']:.1f} u · WAPE {100 * m['wape']:.0f}%",
                transform=ax.transAxes, va="top", fontsize=9, color=TEXTO)
        ax.set_xlim(0, tope)
        ax.set_ylim(0, tope)
        ax.set_aspect("equal")
        ax.set_xlabel("Demanda real (unidades)")

    ejes[0].set_ylabel("Demanda predicha (unidades)")
    manijas, etiquetas = ejes[0].get_legend_handles_labels()
    figura.legend(manijas, etiquetas, loc="upper right", ncol=2, bbox_to_anchor=(0.99, 0.965))

    figura.suptitle(
        f"Demanda real y predicha a {horizonte} días", x=0.01, ha="left",
        fontsize=13, fontweight="bold", color=TEXTO,
    )
    figura.text(
        0.01, 0.905,
        f"Backtesting de origen móvil · {len(resultado):,} predicciones · "
        "cuanto más cerca de la diagonal, mejor",
        fontsize=9, color=TEXTO_SECUNDARIO,
    )
    figura.tight_layout(rect=(0, 0, 1, 0.9))

    return guardar(figura, nombre)


def modelo_vs_baseline(comparaciones: dict) -> Path:
    """
    Cuatro paneles y no un gráfico de doble eje: MAE se mide en unidades y
    WAPE en porcentaje, y a 30 días el MAE es varias veces el de 7. Con un
    solo eje, las barras se compararían en escalas que no tienen nada que ver.
    """
    figura, ejes = plt.subplots(2, 2, figsize=(10, 7.2))
    paneles = [
        (ejes[0][0], 7, "mae", "MAE a 7 días", "unidades"),
        (ejes[0][1], 30, "mae", "MAE a 30 días", "unidades"),
        (ejes[1][0], 7, "wape", "WAPE a 7 días", "%"),
        (ejes[1][1], 30, "wape", "WAPE a 30 días", "%"),
    ]

    for ax, horizonte, clave, titulo, unidad in paneles:
        c = comparaciones[horizonte]
        valores = [c["baseline"][clave], c["random_forest"][clave]]
        if unidad == "%":
            valores = [100 * v for v in valores]

        barras = ax.bar(["Baseline\n(media 28 días)", "Random Forest"], valores,
                        color=[CONTEXTO, SERIE], width=0.55)
        ax.bar_label(barras, labels=[f"{v:.1f}{'%' if unidad == '%' else ''}" for v in valores],
                     padding=3, fontsize=9, color=TEXTO)

        cambio = c["mejora_porcentual"][clave]
        lectura = (
            f"empate práctico ({cambio:+.1f}%)" if abs(cambio) < EMPATE_PRACTICO_PCT
            else f"el modelo mejora {cambio:.1f}%" if cambio > 0
            else f"el modelo empeora {abs(cambio):.1f}%"
        )
        ax.set_title(titulo, loc="left", fontsize=11)
        ax.set_title(lectura, loc="right", fontsize=9, color=TEXTO_SECUNDARIO)
        ax.set_ylabel(unidad)
        ax.grid(axis="x", visible=False)
        ax.margins(y=0.18)

    figura.suptitle("Random Forest frente al baseline", x=0.01, ha="left",
                    fontsize=13, fontweight="bold", color=TEXTO)
    figura.text(0.01, 0.935, "Backtesting de origen móvil · menos es mejor",
                fontsize=9, color=TEXTO_SECUNDARIO)
    figura.tight_layout(rect=(0, 0, 1, 0.93))

    return guardar(figura, "03_modelo_vs_baseline.png")


def acortar(texto: str, largo: int) -> str:
    """Corta en el último espacio antes del límite: nunca a mitad de palabra."""
    if len(texto) <= largo:
        return texto

    return texto[:largo].rsplit(" ", 1)[0] + "…"


def error_por_producto(tabla: pd.DataFrame, horizonte: int) -> Path:
    """
    Dos rankings, porque "el producto más difícil" depende de cómo se mida.
    En unidades, el error más grande lo tienen los que más venden: equivocarse
    en 10% del cemento son muchas bolsas. En proporción, lo tienen los de baja
    rotación: errar por una sierra circular cuando se venden dos es un 50%.
    """
    top = 12
    figura, ejes = plt.subplots(1, 2, figsize=(13, 5.4))

    por_unidades = tabla.nlargest(top, "mae_rf").iloc[::-1]
    por_proporcion = tabla.dropna(subset=["wape_rf"]).nlargest(top, "wape_rf").iloc[::-1]

    for ax, datos, columna, titulo, formato, eje in [
        (ejes[0], por_unidades, "mae_rf", "Mayor error en unidades (MAE)", "{:.1f}", "Unidades por predicción"),
        (ejes[1], por_proporcion, "wape_rf", "Mayor error en proporción (WAPE)", "{:.0%}", "Error sobre la demanda real"),
    ]:
        etiquetas = [f"{f.codigo} · {acortar(f.producto, 30)}" for f in datos.itertuples()]
        barras = ax.barh(etiquetas, datos[columna], color=SERIE, height=0.62)
        ax.bar_label(barras, labels=[formato.format(v) for v in datos[columna]],
                     padding=3, fontsize=8.5, color=TEXTO)
        ax.set_title(titulo, loc="left", fontsize=11)
        ax.set_xlabel(eje)
        ax.grid(axis="y", visible=False)
        ax.margins(x=0.18)
        ax.tick_params(axis="y", labelsize=8.5)
        if columna == "wape_rf":
            ax.xaxis.set_major_formatter(plt.matplotlib.ticker.PercentFormatter(xmax=1, decimals=0))

    figura.suptitle(f"Productos con mayor error a {horizonte} días", x=0.01, ha="left",
                    fontsize=13, fontweight="bold", color=TEXTO)
    figura.text(0.01, 0.915, f"Random Forest · backtesting · los {top} peores de {len(tabla)} "
                "según cada forma de medir", fontsize=9, color=TEXTO_SECUNDARIO)
    figura.tight_layout(rect=(0, 0, 1, 0.91))

    return guardar(figura, "04_error_por_producto.png")


# ─────────────────────────────────────────────────────────────────────────
# REPORTE
# ─────────────────────────────────────────────────────────────────────────

def fila_metricas(nombre: str, m: dict) -> str:
    wape = f"{100 * m['wape']:.1f}%" if m["wape"] is not None else "—"
    return f"| {nombre} | {m['mae']:.2f} | {m['rmse']:.2f} | {wape} |"


def fila_mejora(m: dict) -> str:
    return "| **Mejora del modelo** | " + " | ".join(
        f"**{v:+.1f}%**" if v is not None else "—" for v in (m["mae"], m["rmse"], m["wape"])
    ) + " |"


def bloque_comparacion(titulo: str, c: dict) -> list[str]:
    return [
        f"#### {titulo}",
        "",
        f"{c['observaciones']:,} predicciones · demanda real total {c['demanda_real_total']:,} unidades",
        "",
        "| | MAE (unidades) | RMSE | WAPE |",
        "|---|---|---|---|",
        fila_metricas("Baseline (media 28 días × h)", c["baseline"]),
        fila_metricas("Random Forest", c["random_forest"]),
        fila_mejora(c["mejora_porcentual"]),
        "",
    ]


def veredicto(c: dict, horizonte: int) -> str:
    """Lo que dicen los números, sin adornos. Si gana el baseline, se dice."""
    m = c["mejora_porcentual"]
    mae_rf, mae_base = c["random_forest"]["mae"], c["baseline"]["mae"]

    if abs(m["mae"]) < EMPATE_PRACTICO_PCT and abs(m["wape"]) < EMPATE_PRACTICO_PCT:
        return (
            f"A {horizonte} días **empatan en la práctica**: {mae_base:.2f} unidades de error del baseline "
            f"frente a {mae_rf:.2f} del Random Forest, una diferencia de {abs(m['mae']):.1f}%. "
            "El modelo no mejora al baseline."
        )
    if m["mae"] > 0 and m["wape"] > 0:
        return (
            f"A {horizonte} días el Random Forest se equivoca en promedio **{mae_rf:.1f} unidades** "
            f"por predicción, frente a {mae_base:.1f} del baseline: **{m['mae']:.1f}% menos error**."
        )
    if m["mae"] < 0 and m["wape"] < 0:
        return (
            f"A {horizonte} días **el baseline es mejor**: se equivoca en {mae_base:.1f} unidades por "
            f"predicción, frente a {mae_rf:.1f} del Random Forest ({abs(m['mae']):.1f}% más error del modelo)."
        )
    return (
        f"A {horizonte} días el resultado es mixto: MAE {m['mae']:+.1f}% y WAPE {m['wape']:+.1f}%. "
        "No hay evidencia suficiente para afirmar que el modelo supera al baseline."
    )


def escribir_reporte(resultados: dict, verificacion: dict, importancias: dict) -> Path:
    r = resultados
    lineas = [
        "# Evaluación del modelo de demanda",
        "",
        "> Generado por `src/train.py`. Todas las cifras se calculan al ejecutar el script.",
        ">",
        "> **Los datos históricos son sintéticos** y el modelo aprende parcialmente la estructura del",
        "> generador. Por ello, las métricas pueden ser más optimistas que las obtenidas con ventas reales.",
        "",
        "## Problema",
        "",
        "Predecir cuántas unidades de cada producto se venderán en los próximos días, para decidir",
        "cuánto reponer. No se predice ingreso: la decisión de compra se toma en unidades.",
        "",
        "## Objetivos",
        "",
        "Cada predicción se hace **al cierre del día t**, con las ventas de t y anteriores ya registradas.",
        "",
        "| Objetivo | Definición |",
        "|---|---|",
        "| `demanda_7d` | Unidades vendidas del día **t+1 al t+7** |",
        "| `demanda_30d` | Unidades vendidas del día **t+1 al t+30** |",
        "",
        "Se predice la suma directamente, no día por día. Encadenar 30 predicciones diarias haría que",
        "el error de cada día se arrastrara al siguiente.",
        "",
        "Las filas cuyo futuro necesario no existe en el historial no tienen objetivo y no se usan.",
        "",
        "## Variables",
        "",
        "| Grupo | Variables | Definición |",
        "|---|---|---|",
        "| Identidad | `producto_id`, `categoria` | One-hot |",
        "| Calendario | `dia_semana`, `mes`, `dia_mes` | De la fecha t |",
        "| Calendario futuro | `dias_abiertos_7`, `dias_abiertos_30` | Días que abre la ferretería entre t+1 y t+h |",
        "| Historia | `lag_1`, `lag_7`, `lag_14`, `lag_28` | Venta k días antes de t+1; `lag_1` es la venta de t |",
        "| Historia | `media_7`, `media_14`, `media_28` | Promedio de los k días que terminan en t |",
        "",
        "`dias_abiertos` mira el futuro, pero solo el calendario, que se conoce de antemano. El 15 de",
        "septiembre se trata como feriado: cae fuera del historial simulado, pero la ferretería no abre.",
        "",
        "### Excluidas",
        "",
        "| Columna | Por qué no entra |",
        "|---|---|",
        *[f"| `{columna}` | {razon} |" for columna, razon in EXCLUIDAS.items()],
        "| `rotacion` | No está en el dataset: es un parámetro del generador. Se usa solo para agrupar resultados. |",
        "",
        "## Prevención de fuga de información",
        "",
        "Tres reglas, y una verificación que las comprueba con datos:",
        "",
        "1. **Las variables solo usan días ≤ t.** Las medias móviles incluyen t porque el objetivo empieza en t+1.",
        "2. **Una fila entra al entrenamiento solo si su objetivo ya se conocía al corte:** `t + h ≤ corte`.",
        "   No basta con que t sea anterior al corte. Una fila del 20 de julio tiene como objetivo a 30 días",
        "   las ventas hasta el 19 de agosto, que al 31 de julio todavía no existen.",
        "3. **El one-hot y el bosque se ajustan dentro del pipeline**, con las filas de entrenamiento de cada",
        "   corte y nada más.",
        "",
        f"**Verificación** (`features.verificar_sin_fuga`, {verificacion['filas_revisadas']} filas al azar):",
        "",
        "| Comprobación | Resultado |",
        "|---|---|",
        "| Reemplazar toda la venta posterior a t no cambia ninguna variable de la fila t | "
        + ("✅" if verificacion["variables_no_cambian_al_alterar_el_futuro"] else "❌") + " |",
        "| Reemplazar la venta de t y anteriores no cambia el objetivo de la fila t | "
        + ("✅" if verificacion["objetivo_no_cambia_al_alterar_el_presente_y_el_pasado"] else "❌") + " |",
        "| El objetivo es exactamente la suma de t+1 a t+h | "
        + ("✅" if verificacion["objetivo_es_exactamente_la_suma_de_t_mas_1_a_t_mas_h"] else "❌") + " |",
        "",
        "**La verificación se prueba a sí misma en cada ejecución.** Una verificación que siempre dice",
        "\"sin fuga\" no demostraría nada, así que se le inyectan tres fugas y se exige que las detecte:",
        "",
        "| Fuga inyectada | ¿Detectada? |",
        "|---|---|",
        "| Media móvil centrada, que mira tres días al futuro | "
        + ("✅" if verificacion["detecta_fugas_inyectadas"]["detecta_media_movil_centrada"] else "❌") + " |",
        "| `lag_1` que toma la venta de mañana | "
        + ("✅" if verificacion["detecta_fugas_inyectadas"]["detecta_lag_que_mira_manana"] else "❌") + " |",
        "| Objetivo que incluye el día t | "
        + ("✅" if verificacion["detecta_fugas_inyectadas"]["detecta_objetivo_que_incluye_el_dia_t"] else "❌") + " |",
        "",
        "## Modelo",
        "",
        "`RandomForestRegressor` dentro de un `Pipeline` de scikit-learn "
        f"{sklearn.__version__}, uno por horizonte:",
        "",
        "| Parámetro | Valor | Por qué |",
        "|---|---|---|",
        "| `n_estimators` | 200 | Suficientes árboles para que el promedio sea estable |",
        "| `min_samples_leaf` | 5 | Con 47% de ceros, hojas de una fila memorizarían días sueltos |",
        "| `max_features` | 0.5 | Cada árbol mira una parte distinta de las variables |",
        "| `random_state` | 42 | Reproducible |",
        "",
        "**No hubo búsqueda de hiperparámetros.** La configuración se fijó antes de ver resultados. Con un",
        "solo período de evaluación, elegir la que mejor sale en agosto y reportar su error en agosto",
        "sería medir el modelo contra los mismos datos con los que se eligió.",
        "",
        "## Baseline",
        "",
        "`baseline_h(t) = promedio diario de los 28 días que terminan en t × h`",
        "",
        "Es lo que haría una persona con una hoja de cálculo. Si el modelo no la supera, no aporta.",
        "",
        "## Evaluación",
        "",
        "### Entrenamiento con enero a julio, prueba en agosto",
        "",
        "El modelo se entrena con lo conocido al cierre del 31 de julio y predice desde cada día de agosto",
        "que tenga su futuro completo.",
        "",
        *bloque_comparacion("A 7 días (orígenes del 1 al 24 de agosto)", r["agosto"][7]),
        *bloque_comparacion("A 30 días (solo el 1 de agosto)", r["agosto"][30]),
        f"A 30 días agosto deja una sola fecha evaluable: {r['agosto'][30]['observaciones']} predicciones, una por",
        "producto. Es válido pero es poco, y por eso la evaluación principal es el backtesting.",
        "",
        "### Backtesting de origen móvil",
        "",
        f"Un corte cada {DIAS_ENTRE_CORTES} días desde el {PRIMER_CORTE:%d/%m/%Y}, mientras quede el futuro completo",
        "del horizonte dentro del historial. En cada corte se entrena un modelo nuevo solo con lo conocido",
        "hasta ese día, se predice, y se avanza una semana.",
        "",
        "| Horizonte | Cortes | Primer corte | Último corte | Predicciones |",
        "|---|---|---|---|---|",
        *[
            f"| {h} días | {len(r['cortes'][h])} | {r['cortes'][h][0]['corte']} | "
            f"{r['cortes'][h][-1]['corte']} | {r['backtest'][h]['observaciones']:,} |"
            for h in HORIZONTES
        ],
        "",
        "Todos los cortes cumplen que el último día de objetivo usado para entrenar es anterior o igual al",
        "corte: " + ("✅ verificado en cada uno." if r["cortes_limpios"] else "❌ **hay cortes que no lo cumplen**."),
        "",
        *bloque_comparacion("A 7 días", r["backtest"][7]),
        *bloque_comparacion("A 30 días", r["backtest"][30]),
        "**Advertencia sobre independencia:** a 30 días, cortes separados por 7 días producen ventanas que",
        "se solapan en 23 días. Los errores de cortes vecinos están correlacionados, así que el backtesting",
        "da una estimación más estable que un solo corte, pero no 700 observaciones independientes.",
        "",
        "## Interpretación",
        "",
        "- " + veredicto(r["backtest"][7], 7),
        "- " + veredicto(r["backtest"][30], 30),
        "",
        *lineas_diagnostico(r, importancias),
        "",
        "### Por rotación",
        "",
        "La rotación no es una variable del modelo; se usa solo para agrupar los resultados del backtesting.",
        "",
        "| Horizonte | Rotación | Predicciones | MAE baseline | MAE RF | Mejora MAE | WAPE baseline | WAPE RF |",
        "|---|---|---|---|---|---|---|---|",
        *[
            f"| {h} días | {nivel} | {c['observaciones']} | {c['baseline']['mae']:.2f} | "
            f"{c['random_forest']['mae']:.2f} | {c['mejora_porcentual']['mae']:+.1f}% | "
            f"{100 * c['baseline']['wape']:.1f}% | {100 * c['random_forest']['wape']:.1f}% |"
            for h in HORIZONTES
            for nivel, c in r["por_rotacion"][h].items()
        ],
        "",
        *lectura_por_rotacion(r["por_rotacion"]),
        "",
        "### Productos difíciles (30 días, backtesting)",
        "",
        *productos_dificiles(r["por_producto"][30]),
        "",
        "### Qué variables usa el modelo",
        "",
        "Importancia por reducción de impureza del modelo final, agrupada por variable original. Favorece a",
        "las variables con muchos valores posibles: indica qué usa el modelo, no qué causa la demanda.",
        "",
        "| Variable | 7 días | 30 días |",
        "|---|---|---|",
        *[
            f"| `{v}` | {100 * importancias[7].get(v, 0):.1f}% | {100 * importancias[30].get(v, 0):.1f}% |"
            for v in importancias[30].index
        ],
        "",
        "## Limitaciones",
        "",
        "- **Datos sintéticos.** El historial lo produjo un generador con reglas conocidas, y el modelo aprende",
        "  en parte esas reglas. Con ventas reales el error sería mayor.",
        "- **Ocho meses de historia.** El modelo ve una temporada seca y una de lluvias, pero no un año",
        "  completo: no puede aprender estacionalidad anual.",
        "- **Ventanas solapadas en el backtesting a 30 días.** Las predicciones no son independientes.",
        "- **Baja rotación.** Con ventas de a una unidad y semanas sin venta, un error de dos unidades es",
        "  un error proporcional enorme, y ningún modelo lo resuelve con este volumen de datos.",
        "",
    ]

    ruta = SALIDA / "evaluacion_modelo.md"
    ruta.write_text("\n".join(lineas), encoding="utf-8", newline="\n")

    return ruta


def lineas_diagnostico(r: dict, importancias: dict) -> list[str]:
    """
    Por qué el resultado es el que es, con evidencia calculada y no supuesta.
    """
    medias = [v for v in importancias[30].index if v.startswith("media_")]
    peso_medias = {h: 100 * importancias[h][medias].sum() for h in HORIZONTES}

    donde_aporta = [
        f"rotación {nivel} a {h} días ({c['mejora_porcentual']['mae']:+.1f}% de MAE)"
        for h in HORIZONTES
        for nivel, c in r["por_rotacion"][h].items()
        if c["mejora_porcentual"]["mae"] >= EMPATE_PRACTICO_PCT
    ]

    agosto_30 = r["agosto"][30]["mejora_porcentual"]["mae"]
    backtest_30 = r["backtest"][30]["mejora_porcentual"]["mae"]

    return [
        "### Por qué el modelo no supera al baseline",
        "",
        f"- **El modelo redescubre el baseline.** El {peso_medias[30]:.0f}% de su importancia a 30 días "
        f"(y el {peso_medias[7]:.0f}% a 7) está en las tres medias móviles. El producto, la categoría y el "
        "calendario aportan poco más. *Explicación probable, no comprobada por separado:* un bosque "
        "aproxima con escalones una relación casi proporcional —la demanda futura se parece a la media "
        "reciente por el horizonte—, y eso puede costarle precisión frente a la multiplicación exacta del "
        "baseline.",
        f"- **Predice de más.** El sesgo medio a 30 días es {r['backtest'][30]['random_forest']['sesgo']:+.2f} "
        f"unidades para el modelo y {r['backtest'][30]['baseline']['sesgo']:+.2f} para el baseline. "
        "*Explicación consistente con los datos, no comprobada por separado:* el backtesting evalúa de mayo "
        "a agosto, temporada de lluvias, con modelos entrenados en parte con la temporada seca, que vende "
        "más; la media de 28 días solo mira lo reciente.",
        f"- **Una sola fecha de evaluación habría engañado.** Evaluando solo el 1 de agosto, el modelo "
        f"parece mejorar el MAE en {agosto_30:+.1f}%. Con {len(r['cortes'][30])} cortes, la mejora es "
        f"{backtest_30:+.1f}%. Es exactamente la razón para hacer backtesting.",
        (
            "- **Donde sí aporta:** " + enumerar(donde_aporta) + ". *Explicación probable, no comprobada por "
            "separado:* con ventas escasas la media de 28 días de un solo producto es ruidosa, y el modelo "
            "puede suavizarla con lo que aprende del conjunto."
            if donde_aporta
            else "- **No hay ningún grupo de rotación donde el modelo mejore al baseline** en al menos "
            f"{EMPATE_PRACTICO_PCT:.0f}%."
        ),
    ]


def enumerar(elementos: list[str]) -> str:
    if len(elementos) <= 1:
        return "".join(elementos)

    return ", ".join(elementos[:-1]) + " y " + elementos[-1]


def lectura_por_rotacion(por_rotacion: dict) -> list[str]:
    lineas = []

    for h in HORIZONTES:
        wape = {nivel: por_rotacion[h][nivel]["random_forest"]["wape"] for nivel in ORDEN_ROTACION}
        ordenado = sorted(wape, key=wape.get)
        lineas.append(
            f"- A {h} días, el error proporcional del modelo es menor en rotación **{ordenado[0]}** "
            f"({100 * wape[ordenado[0]]:.1f}%) y mayor en rotación **{ordenado[-1]}** "
            f"({100 * wape[ordenado[-1]]:.1f}%)."
        )

    return lineas


def productos_dificiles(tabla: pd.DataFrame) -> list[str]:
    def filas(datos: pd.DataFrame) -> list[str]:
        return [
            f"| {f.codigo} | {f.producto} | {f.rotacion} | {f.demanda_real:,.0f} | {f.prediccion_rf:,.1f} | "
            f"{f.mae_rf:.2f} | {f.mae_baseline:.2f} | "
            f"{'—' if pd.isna(f.wape_rf) else f'{100 * f.wape_rf:.0f}%'} |"
            for f in datos.itertuples()
        ]

    encabezado = [
        "| Código | Producto | Rotación | Real total | Predicho total | MAE RF | MAE baseline | WAPE RF |",
        "|---|---|---|---|---|---|---|---|",
    ]
    con_volumen = tabla.dropna(subset=["wape_rf"])
    gana_baseline = tabla[tabla["gana"] == "baseline"]

    return [
        "Por producto, a lo largo de todos los cortes. **\"Real total\" y \"Predicho total\" suman ventanas",
        "de 30 días que se solapan**: sirven para comparar lo real contra lo predicho, pero no son la venta",
        "del período. Para comparar productos entre sí, usar MAE y WAPE.",
        "",
        "**Mayor error en unidades** — los que más venden:",
        "",
        *encabezado, *filas(tabla.nlargest(5, "mae_rf")),
        "",
        "**Mayor error proporcional** — los de venta escasa:",
        "",
        *encabezado, *filas(con_volumen.nlargest(5, "wape_rf")),
        "",
        "**Menor error proporcional:**",
        "",
        *encabezado, *filas(con_volumen.nsmallest(5, "wape_rf")),
        "",
        "**Herramientas eléctricas y demás productos de baja rotación:**",
        "",
        *encabezado, *filas(tabla[tabla["rotacion"] == "baja"].sort_values("codigo")),
        "",
        f"En **{len(gana_baseline)} de {len(tabla)} productos** el baseline tiene menor MAE que el modelo"
        + (f": {', '.join(gana_baseline['codigo'])}." if len(gana_baseline) else "."),
    ]


# ─────────────────────────────────────────────────────────────────────────
# MODELO FINAL
# ─────────────────────────────────────────────────────────────────────────

def entrenar_modelo_final(filas: pd.DataFrame, horizonte: int) -> tuple[Pipeline, dict]:
    """
    Con todo lo conocido al 31 de agosto. Este modelo no se evalúa: ya vio
    agosto. Las métricas de arriba son las de los modelos que no lo vieron.
    """
    entrenamiento = conocidas_al_corte(filas, horizonte, FIN_HISTORIAL)

    modelo = crear_pipeline(horizonte)
    modelo.fit(entrenamiento[variables(horizonte)], entrenamiento[objetivo(horizonte)])

    ruta = MODELOS / f"random_forest_{horizonte}d.joblib"
    joblib.dump(modelo, ruta, compress=3)

    return modelo, {
        "archivo": ruta.relative_to(RAIZ).as_posix(),
        "horizonte_dias": horizonte,
        "filas_entrenamiento": int(len(entrenamiento)),
        "primera_fila": entrenamiento["fecha"].min().date().isoformat(),
        "ultima_fila": entrenamiento["fecha"].max().date().isoformat(),
        "ultimo_dia_de_objetivo": (entrenamiento["fecha"].max() + pd.Timedelta(days=horizonte)).date().isoformat(),
        "variables": variables(horizonte),
        "objetivo": objetivo(horizonte),
    }


def a_json(valor):
    if isinstance(valor, dict):
        return {str(k): a_json(v) for k, v in valor.items()}
    if isinstance(valor, list):
        return [a_json(v) for v in valor]
    if isinstance(valor, (np.integer,)):
        return int(valor)
    if isinstance(valor, (np.floating, float)):
        return None if pd.isna(valor) else round(float(valor), 4)

    return valor


def main() -> None:
    configurar_consola()
    configurar_estilo()
    SALIDA.mkdir(parents=True, exist_ok=True)
    MODELOS.mkdir(parents=True, exist_ok=True)

    demanda = leer_demanda()
    filas = construir(demanda)

    print("Verificando que ninguna variable use información futura…")
    verificacion = verificar_sin_fuga(demanda)
    if not all(v for k, v in verificacion.items() if k != "filas_revisadas"):
        raise RuntimeError(f"Fuga de información detectada: {verificacion}")

    print("Comprobando que la verificación detecta fugas inyectadas a propósito…")
    autoprueba = probar_la_verificacion(demanda)
    if not all(autoprueba.values()):
        raise RuntimeError(f"La verificación de fuga no detecta fugas conocidas: {autoprueba}")
    verificacion["detecta_fugas_inyectadas"] = autoprueba

    resultados = {"agosto": {}, "backtest": {}, "cortes": {}, "por_rotacion": {}, "por_producto": {}}
    controles_agosto, predicciones_backtest = {}, []

    for h in HORIZONTES:
        print(f"Evaluando a {h} días…")

        agosto, control = evaluar_en_agosto(filas, h)
        resultados["agosto"][h] = comparar(agosto)
        controles_agosto[h] = control

        historico, cortes = backtest(filas, h)
        resultados["backtest"][h] = comparar(historico)
        resultados["cortes"][h] = cortes
        resultados["por_rotacion"][h] = comparar_por_rotacion(historico)
        resultados["por_producto"][h] = tabla_por_producto(historico)

        predicciones_backtest.append(historico.assign(horizonte_dias=h))

    resultados["cortes_limpios"] = all(
        c["sin_solapamiento"] for h in HORIZONTES for c in resultados["cortes"][h]
    ) and all(c["sin_solapamiento"] for c in controles_agosto.values())

    if not resultados["cortes_limpios"]:
        raise RuntimeError("Hay cortes donde el entrenamiento se solapa con lo evaluado.")

    print("Entrenando los modelos finales con todo el historial…")
    importancias, modelos_finales = {}, {}
    for h in HORIZONTES:
        modelo, descripcion = entrenar_modelo_final(filas, h)
        importancias[h] = importancia_de_variables(modelo)
        modelos_finales[h] = descripcion

    print("Generando gráficas y reportes…")
    generadas = [
        real_vs_predicho(predicciones_backtest[0], 7, "01_real_vs_predicho_7d.png"),
        real_vs_predicho(predicciones_backtest[1], 30, "02_real_vs_predicho_30d.png"),
        modelo_vs_baseline(resultados["backtest"]),
        error_por_producto(resultados["por_producto"][30], 30),
        escribir_reporte(resultados, verificacion, importancias),
    ]

    columnas_csv = dict(index=False, encoding="utf-8", lineterminator="\n", float_format="%.4f")

    evaluacion = pd.concat(
        [resultados["por_producto"][h].assign(horizonte_dias=h) for h in HORIZONTES], ignore_index=True
    )
    evaluacion.to_csv(SALIDA / "evaluacion_por_producto.csv", **columnas_csv)

    todas = pd.concat(predicciones_backtest, ignore_index=True)
    todas["fecha"] = todas["fecha"].dt.strftime("%Y-%m-%d")
    todas["corte"] = todas["corte"].dt.strftime("%Y-%m-%d")
    todas.to_csv(SALIDA / "predicciones_backtest.csv", **columnas_csv)

    metricas_json = {
        "advertencia": "Datos históricos sintéticos: las métricas pueden ser más optimistas que con ventas reales.",
        "versiones": {"scikit-learn": sklearn.__version__, "numpy": np.__version__, "pandas": pd.__version__},
        "configuracion_random_forest": {k: v for k, v in CONFIGURACION_BOSQUE.items() if k != "n_jobs"},
        "convencion": {
            "momento_de_prediccion": "cierre del día t",
            "demanda_7d": "suma de ventas de t+1 a t+7",
            "demanda_30d": "suma de ventas de t+1 a t+30",
            "baseline": "promedio diario de los 28 días que terminan en t × horizonte",
        },
        "variables": {f"{h}d": variables(h) for h in HORIZONTES},
        "excluidas": list(EXCLUIDAS),
        "verificacion_fuga": verificacion,
        "evaluacion_agosto": {
            f"{h}d": {**resultados["agosto"][h], "control": controles_agosto[h]} for h in HORIZONTES
        },
        "backtest": {
            f"{h}d": {
                **resultados["backtest"][h],
                "cortes": [c["corte"] for c in resultados["cortes"][h]],
                "dias_entre_cortes": DIAS_ENTRE_CORTES,
                "por_rotacion": resultados["por_rotacion"][h],
            }
            for h in HORIZONTES
        },
        "cortes_sin_solapamiento": resultados["cortes_limpios"],
        "importancia_de_variables": {f"{h}d": importancias[h].to_dict() for h in HORIZONTES},
        "modelos_finales": {f"{h}d": modelos_finales[h] for h in HORIZONTES},
    }

    (SALIDA / "metricas.json").write_text(
        json.dumps(a_json(metricas_json), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8", newline="\n",
    )

    print("\nRESULTADOS (backtesting)")
    for h in HORIZONTES:
        c = resultados["backtest"][h]
        print(
            f"  {h:>2} días · {c['observaciones']:>4} predicciones · "
            f"MAE baseline {c['baseline']['mae']:.2f} → RF {c['random_forest']['mae']:.2f} "
            f"({c['mejora_porcentual']['mae']:+.1f}%) · "
            f"WAPE {100 * c['baseline']['wape']:.1f}% → {100 * c['random_forest']['wape']:.1f}%"
        )

    print("\nArchivos:")
    for ruta in generadas + [SALIDA / "metricas.json", SALIDA / "evaluacion_por_producto.csv",
                             SALIDA / "predicciones_backtest.csv"]:
        print(f"  {ruta.relative_to(RAIZ)}")
    for h in HORIZONTES:
        print(f"  {modelos_finales[h]['archivo']}")


if __name__ == "__main__":
    main()
