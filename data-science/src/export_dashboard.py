"""
Publica la proyección de demanda para el Dashboard del Sistema Ferretería.

Lee los resultados finales del pipeline y escribe un JSON que la aplicación
sirve como archivo estático:

    data-science/outputs/predictions/recomendaciones_inventario.csv ─┐
    data-science/data/processed/demanda_diaria.csv ──────────────────┼─→ public/data/predicciones-inventario.json
    data-science/outputs/model/metricas.json ────────────────────────┘

El JSON es un ARTEFACTO DERIVADO, no una fuente. No se edita a mano: si cambia
algo en el pipeline, se vuelve a generar con este script.

POR QUÉ UN ARCHIVO ESTÁTICO

No hace falta un servidor Python para la demostración, no se toca Supabase, y
la analítica queda separada de los datos de la operación: las ventas simuladas
y los 41 productos sintéticos nunca entran a la base del sistema.

El archivo no lleva fecha de generación a propósito: con ella, dos ejecuciones
sobre los mismos resultados producirían archivos distintos.

Uso:
    python src/export_dashboard.py
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parents[1]
RECOMENDACIONES = RAIZ / "outputs" / "predictions" / "recomendaciones_inventario.csv"
DEMANDA = RAIZ / "data" / "processed" / "demanda_diaria.csv"
METRICAS = RAIZ / "outputs" / "model" / "metricas.json"
SALIDA = RAIZ.parent / "public" / "data" / "predicciones-inventario.json"

VERSION = 1

MESES_CORTOS = {1: "ene", 2: "feb", 3: "mar", 4: "abr", 5: "may", 6: "jun",
                7: "jul", 8: "ago", 9: "sep", 10: "oct", 11: "nov", 12: "dic"}

RIESGOS = ("alto", "medio", "bajo")


def configurar_consola() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")


def leer_productos() -> list[dict]:
    recomendaciones = pd.read_csv(RECOMENDACIONES, encoding="utf-8")

    return [
        {
            "producto_id": f.producto_id,
            "codigo": f.codigo,
            "producto": f.producto,
            "categoria": f.categoria,
            "origen": f.origen,
            "stock_actual": int(f.stock_actual),
            "tipo_stock": f.tipo_stock,
            "demanda_predicha_7d": round(float(f.demanda_predicha_7d), 2),
            "demanda_predicha_30d": round(float(f.demanda_predicha_30d), 2),
            "stock_seguridad": int(f.stock_seguridad),
            "riesgo": f.riesgo,
            "recomendacion_compra": int(f.recomendacion_compra),
            "costo": round(float(f.costo), 2),
            "inversion_estimada": round(float(f.inversion_estimada), 2),
        }
        for f in recomendaciones.sort_values("codigo").itertuples(index=False)
    ]


def resumir(productos: list[dict]) -> dict:
    """
    Se calcula desde el detalle que se publica, no desde otro archivo: así el
    resumen y la tabla del Dashboard no pueden contradecirse.
    """
    return {
        "demanda_total_7d": round(sum(p["demanda_predicha_7d"] for p in productos), 2),
        "demanda_total_30d": round(sum(p["demanda_predicha_30d"] for p in productos), 2),
        "productos_riesgo_alto": sum(p["riesgo"] == "alto" for p in productos),
        "productos_riesgo_medio": sum(p["riesgo"] == "medio" for p in productos),
        "productos_riesgo_bajo": sum(p["riesgo"] == "bajo" for p in productos),
        "productos_con_compra": sum(p["recomendacion_compra"] > 0 for p in productos),
        "unidades_recomendadas": sum(p["recomendacion_compra"] for p in productos),
        "inversion_estimada": round(sum(p["inversion_estimada"] for p in productos), 2),
    }


def serie_mensual(resumen: dict, fecha_corte: pd.Timestamp) -> list[dict]:
    """
    Unidades de enero a agosto, y septiembre como proyección.

    Septiembre es exactamente la predicción a 30 días: desde el corte del 31 de
    agosto, los 30 días siguientes son del 1 al 30 de septiembre. No se inventa
    una curva diaria que el modelo no produjo.
    """
    demanda = pd.read_csv(DEMANDA, encoding="utf-8", parse_dates=["fecha"])
    por_mes = demanda.groupby(demanda["fecha"].dt.to_period("M"))["cantidad_vendida"].sum()

    serie = [
        {
            "mes": str(periodo),
            "etiqueta": MESES_CORTOS[periodo.month],
            "unidades": int(unidades),
            "tipo": "historico",
        }
        for periodo, unidades in por_mes.items()
    ]

    proyectado = (fecha_corte + pd.Timedelta(days=1)).to_period("M")
    serie.append(
        {
            "mes": str(proyectado),
            "etiqueta": MESES_CORTOS[proyectado.month],
            "unidades": resumen["demanda_total_30d"],
            "tipo": "proyeccion",
        }
    )

    return serie


def metadatos(metricas: dict, productos: list[dict]) -> dict:
    final_30 = metricas["modelos_finales"]["30d"]
    fecha_corte = pd.Timestamp(final_30["ultimo_dia_de_objetivo"])
    demanda = pd.read_csv(DEMANDA, encoding="utf-8", usecols=["fecha"], parse_dates=["fecha"])

    sistema = sum(p["origen"] == "sistema" for p in productos)
    sinteticos = sum(p["origen"] == "sintetico" for p in productos)

    return {
        "modelo": "Random Forest",
        "referencia": "Evaluado contra una media móvil de 28 días como referencia.",
        "fecha_corte": fecha_corte.date().isoformat(),
        "periodo_historico": {
            "desde": demanda["fecha"].min().date().isoformat(),
            "hasta": demanda["fecha"].max().date().isoformat(),
        },
        "proyeccion": {
            "desde": (fecha_corte + pd.Timedelta(days=1)).date().isoformat(),
            "hasta": (fecha_corte + pd.Timedelta(days=30)).date().isoformat(),
        },
        "horizontes_dias": [7, 30],
        "productos": len(productos),
        "productos_sistema": sistema,
        "productos_simulados": sinteticos,
        "escenario": "academico",
        "aclaracion": (
            f"Proyección basada en un escenario académico de {len(productos)} productos: "
            f"{sistema} del sistema y {sinteticos} simulados para análisis. "
            "Las ventas históricas son simuladas."
        ),
        "origen_del_archivo": "Generado por data-science/src/export_dashboard.py. No editar a mano.",
    }


def validar(publicacion: dict) -> None:
    """
    El JSON se detiene antes de escribirse si no es coherente. El Dashboard
    confía en este archivo, así que los errores se atrapan aquí y no en pantalla.
    """
    productos = publicacion["productos"]
    resumen = publicacion["resumen"]
    serie = publicacion["serie_mensual"]
    meta = publicacion["metadata"]

    ids = [p["producto_id"] for p in productos]

    comprobaciones = {
        "50 productos": len(productos) == 50,
        "9 del sistema": meta["productos_sistema"] == 9,
        "41 simulados": meta["productos_simulados"] == 41,
        "identificadores únicos": len(set(ids)) == len(ids),
        "ninguna predicción negativa": all(
            p["demanda_predicha_7d"] >= 0 and p["demanda_predicha_30d"] >= 0 for p in productos
        ),
        "ningún stock negativo": all(p["stock_actual"] >= 0 for p in productos),
        "ninguna recomendación negativa": all(p["recomendacion_compra"] >= 0 for p in productos),
        "ninguna inversión negativa": all(p["inversion_estimada"] >= 0 for p in productos),
        "sin valores no finitos": all(
            math.isfinite(v) for p in productos for v in p.values() if isinstance(v, (int, float))
        ),
        "riesgos válidos": all(p["riesgo"] in RIESGOS for p in productos),
        "stock real solo en productos del sistema": all(
            (p["origen"] == "sistema") == (p["tipo_stock"] == "real") for p in productos
        ),
        "resumen coincide con el detalle": resumen == resumir(productos),
        "riesgos suman el total": sum(resumen[f"productos_riesgo_{r}"] for r in RIESGOS) == len(productos),
        "histórico de enero a agosto": [m["mes"] for m in serie if m["tipo"] == "historico"]
        == [f"2026-{mes:02d}" for mes in range(1, 9)],
        "septiembre es la única proyección": [m["mes"] for m in serie if m["tipo"] == "proyeccion"]
        == ["2026-09"],
        "la proyección es la demanda a 30 días": serie[-1]["unidades"] == resumen["demanda_total_30d"],
    }

    fallidas = [nombre for nombre, ok in comprobaciones.items() if not ok]
    if fallidas:
        raise RuntimeError(f"El JSON del Dashboard no es coherente: {fallidas}")

    print(f"Validaciones ........ {len(comprobaciones)}/{len(comprobaciones)}")


def main() -> None:
    configurar_consola()

    metricas = json.loads(METRICAS.read_text(encoding="utf-8"))
    productos = leer_productos()
    resumen = resumir(productos)
    meta = metadatos(metricas, productos)

    publicacion = {
        "version": VERSION,
        "metadata": meta,
        "resumen": resumen,
        "serie_mensual": serie_mensual(resumen, pd.Timestamp(meta["fecha_corte"])),
        "productos": productos,
    }

    validar(publicacion)

    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    SALIDA.write_text(
        json.dumps(publicacion, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )

    print(f"Productos ........... {meta['productos']} ({meta['productos_sistema']} del sistema, {meta['productos_simulados']} simulados)")
    print(f"Demanda 7 / 30 días . {resumen['demanda_total_7d']:,.2f} / {resumen['demanda_total_30d']:,.2f}")
    print(f"Riesgo .............. alto {resumen['productos_riesgo_alto']} · medio {resumen['productos_riesgo_medio']} · bajo {resumen['productos_riesgo_bajo']}")
    print(f"Con compra .......... {resumen['productos_con_compra']} · {resumen['unidades_recomendadas']:,} unidades · L {resumen['inversion_estimada']:,.2f}")
    print(f"Archivo ............. {SALIDA.relative_to(RAIZ.parent).as_posix()} ({SALIDA.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
