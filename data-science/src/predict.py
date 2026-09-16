"""
Predice la demanda de septiembre y recomienda cuánto reponer de cada producto.

Usa los modelos finales que guarda `train.py`, con la información disponible
al cierre del 31 de agosto de 2026. No reentrena nada.

LO QUE HAY QUE SABER ANTES DE USAR ESTAS RECOMENDACIONES

- Las ventas históricas son SIMULADAS. Las predicciones heredan esa condición.
- En la evaluación, el Random Forest no superó al baseline: empató a 30 días y
  fue algo peor a 7. Las predicciones del baseline se guardan al lado para que
  la comparación esté siempre a la vista.
- El stock de los 9 productos del sistema es REAL, tomado de Supabase. El de los
  41 sintéticos es SIMULADO con una regla fija. Se cruzan con una demanda
  simulada: la recomendación es un ejercicio académico, no una orden de compra.

Uso:
    python src/predict.py
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from catalogo import leer_catalogo
from features import HORIZONTES, baseline, construir, leer_demanda, variables
from generate_dataset import generador_para

RAIZ = Path(__file__).resolve().parents[1]
MODELOS = RAIZ / "models"
STOCK_SISTEMA = RAIZ / "data" / "raw" / "stock_sistema.csv"
METRICAS = RAIZ / "outputs" / "model" / "metricas.json"
SALIDA = RAIZ / "outputs" / "predictions"

FECHA_CORTE = pd.Timestamp("2026-08-31")

# Stock de seguridad: una semana de venta media reciente. Cubre el tiempo que
# tarda en llegar un pedido y parte del error del pronóstico, sin necesitar un
# modelo probabilístico.
DIAS_SEGURIDAD = 7

# Stock simulado de los 41 productos sintéticos: entre 5 y 50 días de su venta
# media histórica. El rango produce productos casi agotados y productos
# sobrados, que es la situación normal de una bodega.
COBERTURA_SIMULADA_MIN, COBERTURA_SIMULADA_MAX = 5, 50


def configurar_consola() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")


# ─────────────────────────────────────────────────────────────────────────
# PREDICCIÓN
# ─────────────────────────────────────────────────────────────────────────

def filas_al_corte() -> pd.DataFrame:
    """Una fila por producto, con las variables tal como se conocían el 31 de agosto."""
    filas = construir(leer_demanda())
    al_corte = filas[filas["fecha"] == FECHA_CORTE].copy()

    if al_corte["producto_id"].nunique() != len(al_corte):
        raise RuntimeError("Hay productos repetidos en la fecha de corte.")

    return al_corte.sort_values("codigo").reset_index(drop=True)


def predecir(al_corte: pd.DataFrame) -> pd.DataFrame:
    predicciones = al_corte[["producto_id", "codigo", "producto", "categoria", "origen", "costo"]].copy()
    predicciones.insert(5, "fecha_corte", FECHA_CORTE.date().isoformat())

    for h in HORIZONTES:
        modelo = joblib.load(MODELOS / f"random_forest_{h}d.joblib")
        predicciones[f"demanda_predicha_{h}d"] = modelo.predict(al_corte[variables(h)]).round(2)

    for h in HORIZONTES:
        predicciones[f"baseline_{h}d"] = al_corte[baseline(h)].round(2).to_numpy()

    predicciones["promedio_diario_28d"] = al_corte["media_28"].round(4).to_numpy()

    return predicciones


# ─────────────────────────────────────────────────────────────────────────
# STOCK
# ─────────────────────────────────────────────────────────────────────────

def stock_real() -> pd.Series:
    """
    Instantánea de la vista stock_actual de Supabase, de solo lectura. Se guarda
    como archivo por lo mismo que el catálogo: reproducible y sin credenciales.
    """
    return pd.read_csv(STOCK_SISTEMA, encoding="utf-8").set_index("producto_id")["stock_actual"]


def stock_simulado(producto: pd.Series, promedio_historico: float) -> int:
    """
    stock = redondeo(venta diaria media de enero a agosto × días de cobertura)

    Los días de cobertura se sortean entre 5 y 50 con la semilla del producto.
    Se usa la media de todo el historial y no la de 28 días para que un
    producto de baja rotación con un mes flojo no quede con stock cero por
    casualidad.
    """
    rng = generador_para(f"stock:{producto['codigo']}")
    dias = rng.uniform(COBERTURA_SIMULADA_MIN, COBERTURA_SIMULADA_MAX)

    return int(round(promedio_historico * dias))


def asignar_stock(predicciones: pd.DataFrame) -> pd.DataFrame:
    real = stock_real()
    demanda = leer_demanda()
    promedio_historico = demanda.groupby("producto_id")["cantidad_vendida"].mean()

    stocks, tipos = [], []
    for _, producto in predicciones.iterrows():
        if producto["origen"] == "sistema":
            stocks.append(int(real[producto["producto_id"]]))
            tipos.append("real")
        else:
            stocks.append(stock_simulado(producto, promedio_historico[producto["producto_id"]]))
            tipos.append("simulado")

    return predicciones.assign(stock_actual=stocks, tipo_stock=tipos)


# ─────────────────────────────────────────────────────────────────────────
# RECOMENDACIÓN
# ─────────────────────────────────────────────────────────────────────────

def stock_de_seguridad(promedio_diario_28d: float) -> int:
    """stock_seguridad = techo(promedio diario de los últimos 28 días × 7)"""
    return int(math.ceil(round(promedio_diario_28d * DIAS_SEGURIDAD, 6)))


def recomendacion_de_compra(demanda_30d: float, seguridad: int, stock: int) -> int:
    """
    necesidad     = demanda prevista a 30 días + stock de seguridad − stock actual
    recomendación = máximo(0, techo(necesidad))

    Se redondea a 6 decimales antes del techo: sin eso, un 10.0000000001 que
    dejó la aritmética de punto flotante recomendaría comprar una unidad de más.
    """
    necesidad = round(demanda_30d + seguridad - stock, 6)

    return max(0, int(math.ceil(necesidad)))


def nivel_de_riesgo(demanda_30d: float, seguridad: int, stock: int) -> str:
    """
    Alto   stock < demanda prevista a 30 días
           No alcanza ni para el mes.
    Medio  demanda a 30 días ≤ stock < demanda a 30 días + stock de seguridad
           Cubre el mes, pero consumiría el colchón de seguridad.
    Bajo   stock ≥ demanda a 30 días + stock de seguridad
           Cubre el mes y el colchón.

    Las tres condiciones son excluyentes y cubren todos los casos. Riesgo bajo
    equivale exactamente a no necesitar compra: se comprueba al terminar.
    """
    if stock < demanda_30d:
        return "alto"
    if stock < demanda_30d + seguridad:
        return "medio"

    return "bajo"


def recomendar(predicciones: pd.DataFrame) -> pd.DataFrame:
    tabla = predicciones.copy()

    tabla["stock_seguridad"] = tabla["promedio_diario_28d"].map(stock_de_seguridad)
    tabla["riesgo"] = [
        nivel_de_riesgo(f.demanda_predicha_30d, f.stock_seguridad, f.stock_actual)
        for f in tabla.itertuples()
    ]
    tabla["recomendacion_compra"] = [
        recomendacion_de_compra(f.demanda_predicha_30d, f.stock_seguridad, f.stock_actual)
        for f in tabla.itertuples()
    ]
    tabla["inversion_estimada"] = (tabla["recomendacion_compra"] * tabla["costo"]).round(2)

    return tabla[
        [
            "producto_id", "codigo", "producto", "categoria", "origen",
            "stock_actual", "tipo_stock",
            "demanda_predicha_7d", "demanda_predicha_30d",
            "stock_seguridad", "riesgo", "recomendacion_compra",
            "costo", "inversion_estimada",
        ]
    ]


# ─────────────────────────────────────────────────────────────────────────
# VALIDACIÓN
# ─────────────────────────────────────────────────────────────────────────

def validar(predicciones: pd.DataFrame, recomendaciones: pd.DataFrame) -> dict:
    catalogo = leer_catalogo()
    metricas = json.loads(METRICAS.read_text(encoding="utf-8"))
    fuga = metricas["verificacion_fuga"]

    numericas = recomendaciones.select_dtypes("number")

    comprobaciones = {
        "50 predicciones": len(predicciones) == 50,
        "50 recomendaciones": len(recomendaciones) == 50,
        "los 50 productos del catálogo, sin faltantes": set(recomendaciones["producto_id"]) == set(catalogo["producto_id"]),
        "identificadores únicos": recomendaciones["producto_id"].is_unique,
        "sin valores vacíos": not predicciones.isna().any().any() and not recomendaciones.isna().any().any(),
        "ninguna predicción negativa": bool((predicciones.filter(like="demanda_predicha") >= 0).all().all()),
        "ninguna recomendación negativa": bool((recomendaciones["recomendacion_compra"] >= 0).all()),
        "stock no negativo": bool((recomendaciones["stock_actual"] >= 0).all()),
        "inversión no negativa": bool((recomendaciones["inversion_estimada"] >= 0).all()),
        "sin valores infinitos": bool(np.isfinite(numericas.to_numpy(dtype=float)).all()),
        "fecha de corte 2026-08-31 en todas": bool((predicciones["fecha_corte"] == "2026-08-31").all()),
        "stock real solo en los 9 del sistema": bool(
            ((recomendaciones["origen"] == "sistema") == (recomendaciones["tipo_stock"] == "real")).all()
        ),
        "riesgo bajo ⇔ recomendación cero": bool(
            ((recomendaciones["riesgo"] == "bajo") == (recomendaciones["recomendacion_compra"] == 0)).all()
        ),
        "variables sin información futura (verificado en train.py)": all(
            v for k, v in fuga.items() if k not in ("filas_revisadas", "detecta_fugas_inyectadas")
        ) and all(fuga["detecta_fugas_inyectadas"].values()),
    }

    fallidas = [nombre for nombre, ok in comprobaciones.items() if not ok]
    if fallidas:
        raise RuntimeError(f"Validaciones fallidas: {fallidas}")

    return comprobaciones


# ─────────────────────────────────────────────────────────────────────────
# RESUMEN
# ─────────────────────────────────────────────────────────────────────────

ORIGEN = {"sistema": "sistema", "sintetico": "sintético"}


def tabla_top(datos: pd.DataFrame) -> list[str]:
    return [
        "| # | Código | Producto | Origen | Stock | Tipo de stock | Demanda 7d | Demanda 30d | Riesgo | Comprar | Inversión |",
        "|---|---|---|---|---|---|---|---|---|---|---|",
        *[
            f"| {i} | {f.codigo} | {f.producto} | {ORIGEN[f.origen]} | {f.stock_actual:,} | {f.tipo_stock} | "
            f"{f.demanda_predicha_7d:,.1f} | {f.demanda_predicha_30d:,.1f} | {f.riesgo} | "
            f"{f.recomendacion_compra:,} | L {f.inversion_estimada:,.2f} |"
            for i, f in enumerate(datos.itertuples(index=False), start=1)
        ],
    ]


def escribir_resumen(predicciones: pd.DataFrame, recomendaciones: pd.DataFrame, validaciones: dict) -> Path:
    r = recomendaciones
    metricas = json.loads(METRICAS.read_text(encoding="utf-8"))
    backtest = metricas["backtest"]

    comprar = r[r["recomendacion_compra"] > 0]
    riesgo = r["riesgo"].value_counts().reindex(["alto", "medio", "bajo"], fill_value=0)

    por_origen = (
        r.groupby("origen")
        .agg(
            productos=("producto_id", "size"),
            demanda_7d=("demanda_predicha_7d", "sum"),
            demanda_30d=("demanda_predicha_30d", "sum"),
            requieren_compra=("recomendacion_compra", lambda s: int((s > 0).sum())),
            unidades=("recomendacion_compra", "sum"),
            inversion=("inversion_estimada", "sum"),
        )
        .reindex(["sistema", "sintetico"])
    )

    riesgo_por_origen = pd.crosstab(r["origen"], r["riesgo"]).reindex(
        index=["sistema", "sintetico"], columns=["alto", "medio", "bajo"], fill_value=0
    )

    total_rf_30 = predicciones["demanda_predicha_30d"].sum()
    total_base_30 = predicciones["baseline_30d"].sum()

    # De dónde sale la proporción de riesgo alto: se mide, no se supone.
    sinteticos = r[r["origen"] == "sintetico"]
    altos_sinteticos = int((sinteticos["riesgo"] == "alto").sum())

    sistema = r[r["origen"] == "sistema"]
    altos_sistema = int((sistema["riesgo"] == "alto").sum())
    mas_corto = sistema.assign(
        faltante=sistema["demanda_predicha_30d"] - sistema["stock_actual"]
    ).nlargest(1, "faltante").iloc[0]

    lineas = [
        "# Predicción de septiembre y recomendaciones de inventario",
        "",
        "> Generado por `src/predict.py` con la información disponible al **31 de agosto de 2026**.",
        ">",
        "> **Ejercicio académico.** Las ventas históricas son simuladas. El stock de los 9 productos del",
        "> sistema es real; el de los 41 sintéticos, simulado. La inversión es una estimación, no una",
        "> orden de compra.",
        "",
        "## Antes de leer las cifras",
        "",
        f"En el backtesting, el Random Forest **empató con el baseline a 30 días** (MAE "
        f"{backtest['30d']['random_forest']['mae']:.2f} contra {backtest['30d']['baseline']['mae']:.2f}) y fue "
        f"**{abs(backtest['7d']['mejora_porcentual']['mae']):.1f}% peor a 7 días**. Las recomendaciones usan el "
        "modelo, como se definió en el diseño, pero la predicción del baseline está al lado en "
        "`predicciones_septiembre.csv`.",
        "",
        f"A 30 días, el modelo prevé **{total_rf_30:,.0f} unidades** y el baseline **{total_base_30:,.0f}**: "
        f"{100 * (total_rf_30 - total_base_30) / total_base_30:+.1f}%.",
        "",
        "## Totales",
        "",
        "| Métrica | Valor |",
        "|---|---|",
        f"| Demanda prevista próximos 7 días | {r['demanda_predicha_7d'].sum():,.1f} unidades |",
        f"| Demanda prevista próximos 30 días | {r['demanda_predicha_30d'].sum():,.1f} unidades |",
        f"| Productos en riesgo alto | {riesgo['alto']} |",
        f"| Productos en riesgo medio | {riesgo['medio']} |",
        f"| Productos en riesgo bajo | {riesgo['bajo']} |",
        f"| Productos que requieren compra | {len(comprar)} de {len(r)} |",
        f"| Unidades recomendadas | {int(r['recomendacion_compra'].sum()):,} |",
        f"| Inversión estimada | L {r['inversion_estimada'].sum():,.2f} |",
        "",
        "## Por origen",
        "",
        "| Origen | Productos | Tipo de stock | Demanda 7d | Demanda 30d | Riesgo alto | Riesgo medio | Riesgo bajo | Requieren compra | Unidades | Inversión |",
        "|---|---|---|---|---|---|---|---|---|---|---|",
        *[
            f"| {ORIGEN[o]} | {f.productos} | {'real' if o == 'sistema' else 'simulado'} | "
            f"{f.demanda_7d:,.1f} | {f.demanda_30d:,.1f} | {riesgo_por_origen.loc[o, 'alto']} | "
            f"{riesgo_por_origen.loc[o, 'medio']} | {riesgo_por_origen.loc[o, 'bajo']} | "
            f"{f.requieren_compra} | {int(f.unidades):,} | L {f.inversion:,.2f} |"
            for o, f in por_origen.iterrows()
        ],
        "",
        "## Top 10 por recomendación de compra",
        "",
        *tabla_top(r.sort_values(["recomendacion_compra", "codigo"], ascending=[False, True]).head(10)),
        "",
        "## Top 10 por demanda prevista a 30 días",
        "",
        *tabla_top(r.sort_values(["demanda_predicha_30d", "codigo"], ascending=[False, True]).head(10)),
        "",
        "## Productos del sistema",
        "",
        "Los únicos con stock real. Su demanda sigue siendo simulada.",
        "",
        *tabla_top(r[r["origen"] == "sistema"].sort_values("codigo")),
        "",
        "## Reglas",
        "",
        "| Concepto | Fórmula |",
        "|---|---|",
        f"| Stock de seguridad | `techo(promedio diario de los últimos 28 días × {DIAS_SEGURIDAD})` |",
        "| Necesidad | `demanda prevista 30d + stock de seguridad − stock actual` |",
        "| Recomendación | `máximo(0, techo(necesidad))` |",
        "| Inversión estimada | `recomendación × costo` |",
        "| Riesgo **alto** | `stock actual < demanda prevista 30d` — no alcanza para el mes |",
        "| Riesgo **medio** | `demanda 30d ≤ stock < demanda 30d + seguridad` — cubre el mes, pero no el colchón |",
        "| Riesgo **bajo** | `stock ≥ demanda 30d + seguridad` — cubre el mes y el colchón |",
        f"| Stock simulado | `redondeo(venta diaria media de enero a agosto × días de cobertura)`, con días de cobertura sorteados entre {COBERTURA_SIMULADA_MIN} y {COBERTURA_SIMULADA_MAX} con semilla fija por producto |",
        "",
        "Riesgo bajo equivale exactamente a recomendación cero: los productos que requieren compra son los de",
        "riesgo alto y medio.",
        "",
        "## Validaciones",
        "",
        "| Comprobación | Resultado |",
        "|---|---|",
        *[f"| {nombre} | {'✅' if ok else '❌'} |" for nombre, ok in validaciones.items()],
        "",
        "## Limitaciones",
        "",
        "- **La proporción de riesgo alto la fijan las reglas de stock, no el modelo.** Riesgo alto "
        "(`stock < demanda 30d`) equivale, por definición, a tener menos de 30 días de cobertura. En los "
        f"sintéticos, el stock se simuló con entre {COBERTURA_SIMULADA_MIN} y {COBERTURA_SIMULADA_MAX} días, así que "
        f"el rango elegido decide cuántos caen ahí: {altos_sinteticos} de {len(sinteticos)}. "
        f"De los {len(sistema)} del sistema, {altos_sistema} están en riesgo alto porque su stock real es de "
        f"demostración: {mas_corto['codigo']} tiene {mas_corto['stock_actual']:,} unidades frente a "
        f"{mas_corto['demanda_predicha_30d']:,.0f} previstas.",
        "- **Demanda simulada y stock real mezclados.** En los 9 productos del sistema, el stock sale de",
        "  Supabase y la demanda de la simulación. Que el cemento aparezca en riesgo no dice nada sobre la",
        "  bodega real: dice que 60 bolsas no alcanzan para la demanda simulada.",
        "- **El stock real es del 16 de septiembre** (fecha de la extracción) y la predicción se hace al 31 de",
        "  agosto.",
        "- **El modelo no supera al baseline.** Las recomendaciones serían muy parecidas con la media de 28 días.",
        "- **No considera** tiempos de entrega por proveedor, lotes mínimos de compra ni presupuesto.",
        "",
    ]

    ruta = SALIDA / "resumen_predicciones.md"
    ruta.write_text("\n".join(lineas), encoding="utf-8", newline="\n")

    return ruta


def main() -> None:
    configurar_consola()
    SALIDA.mkdir(parents=True, exist_ok=True)

    al_corte = filas_al_corte()
    predicciones = predecir(al_corte)
    recomendaciones = recomendar(asignar_stock(predicciones))

    validaciones = validar(predicciones, recomendaciones)

    formato = dict(index=False, encoding="utf-8", lineterminator="\n", float_format="%.2f")
    predicciones.drop(columns=["costo", "promedio_diario_28d"]).to_csv(
        SALIDA / "predicciones_septiembre.csv", **formato
    )
    recomendaciones.to_csv(SALIDA / "recomendaciones_inventario.csv", **formato)
    resumen = escribir_resumen(predicciones, recomendaciones, validaciones)

    riesgo = recomendaciones["riesgo"].value_counts()
    print(f"Fecha de corte ............. {FECHA_CORTE.date()}")
    print(f"Productos .................. {len(recomendaciones)}")
    print(f"Demanda prevista 7 días .... {recomendaciones['demanda_predicha_7d'].sum():,.1f} unidades")
    print(f"Demanda prevista 30 días ... {recomendaciones['demanda_predicha_30d'].sum():,.1f} unidades")
    print(f"Riesgo ..................... alto {riesgo.get('alto', 0)} · medio {riesgo.get('medio', 0)} · bajo {riesgo.get('bajo', 0)}")
    print(f"Requieren compra ........... {int((recomendaciones['recomendacion_compra'] > 0).sum())}")
    print(f"Unidades recomendadas ...... {int(recomendaciones['recomendacion_compra'].sum()):,}")
    print(f"Inversión estimada ......... L {recomendaciones['inversion_estimada'].sum():,.2f}")
    print(f"Validaciones ............... {sum(validaciones.values())}/{len(validaciones)}")
    print("\nArchivos:")
    for nombre in ("predicciones_septiembre.csv", "recomendaciones_inventario.csv"):
        print(f"  {(SALIDA / nombre).relative_to(RAIZ)}")
    print(f"  {resumen.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
