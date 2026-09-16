"""
ETL: de tickets de venta a demanda diaria por producto.

EXTRACCIÓN
    Lee el CSV de tickets y la instantánea del catálogo.

TRANSFORMACIÓN
    Limpia lo que una exportación real suele traer mal, agrega por día y
    completa la matriz producto × día.

CARGA
    Escribe data/processed/demanda_diaria.csv, una fila por producto por día.

El paso que más importa es el último de la transformación: completar los
días sin venta con cero. Un día sin ventas no es un dato faltante, es
información. Sin esas filas, un modelo solo vería días con venta, aprendería
que la demanda mínima es 1 y recomendaría comprar de más justo los productos
que menos rotan.

Uso:
    python src/etl.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parents[1]
CRUDO = RAIZ / "data" / "raw" / "ventas_simuladas_2026.csv"
CATALOGO = RAIZ / "data" / "raw" / "productos_sistema.csv"
SALIDA = RAIZ / "data" / "processed" / "demanda_diaria.csv"
REPORTE = RAIZ / "outputs" / "reporte_calidad.json"

INICIO = "2026-01-01"
FIN = "2026-08-31"

COLUMNAS_FINALES = [
    "fecha", "producto_id", "codigo", "producto", "categoria",
    "precio", "costo", "cantidad_vendida", "ingreso",
]


def configurar_consola() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")


# ─────────────────────────────────────────────────────────────────────────
# EXTRACCIÓN
# ─────────────────────────────────────────────────────────────────────────

def extraer() -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Todo se lee como texto primero. Dejar que pandas adivine los tipos
    ocultaría justo los defectos que hay que detectar: una cantidad "3 " se
    convertiría sola o dejaría la columna entera como object sin avisar.
    """
    tickets = pd.read_csv(CRUDO, encoding="utf-8", dtype=str)
    catalogo = pd.read_csv(CATALOGO, encoding="utf-8")

    return tickets, catalogo


# ─────────────────────────────────────────────────────────────────────────
# TRANSFORMACIÓN
# ─────────────────────────────────────────────────────────────────────────

def normalizar_tipos(tickets: pd.DataFrame) -> pd.DataFrame:
    limpio = tickets.copy()

    limpio["fecha_hora"] = pd.to_datetime(limpio["fecha_hora"], errors="coerce")
    limpio["cantidad"] = pd.to_numeric(limpio["cantidad"].str.strip(), errors="coerce")
    limpio["precio_unitario"] = pd.to_numeric(limpio["precio_unitario"], errors="coerce")
    limpio["ingreso"] = pd.to_numeric(limpio["ingreso"], errors="coerce")

    return limpio


def quitar_duplicados(tickets: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    """
    Un evento_id identifica un ticket. Dos filas con el mismo id son la misma
    venta exportada dos veces, no dos ventas: sumarlas duplicaría demanda que
    no existió.
    """
    antes = len(tickets)
    sin_duplicados = tickets.drop_duplicates(subset="evento_id", keep="first")

    return sin_duplicados, antes - len(sin_duplicados)


def quitar_cantidades_invalidas(tickets: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    """
    Cero o negativo no es una venta. Es una devolución mal cargada o un error
    de captura, y la demanda se mide en lo que se vendió.
    """
    validas = tickets["cantidad"].notna() & (tickets["cantidad"] > 0)

    return tickets[validas].copy(), int((~validas).sum())


def recuperar_precios(
    tickets: pd.DataFrame, catalogo: pd.DataFrame
) -> tuple[pd.DataFrame, int]:
    """
    Un precio faltante no justifica tirar la venta: las unidades sí se
    vendieron. El precio del producto está en el catálogo.
    """
    precios = catalogo.set_index("codigo")["precio"]
    faltantes = tickets["precio_unitario"].isna()

    tickets.loc[faltantes, "precio_unitario"] = tickets.loc[faltantes, "codigo"].map(precios)

    return tickets, int(faltantes.sum())


def recalcular_ingresos(tickets: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    """
    El ingreso no se confía: se recalcula como cantidad × precio. Se cuenta
    cuántos venían distintos para dejar constancia de que el dato de origen
    tenía errores.
    """
    correcto = (tickets["cantidad"] * tickets["precio_unitario"]).round(2)
    distintos = int((tickets["ingreso"].round(2) != correcto).sum())

    tickets["ingreso"] = correcto

    return tickets, distintos


def agregar_por_dia(tickets: pd.DataFrame) -> pd.DataFrame:
    tickets["fecha"] = tickets["fecha_hora"].dt.normalize()

    return (
        tickets.groupby(["fecha", "producto_id"], as_index=False)
        .agg(cantidad_vendida=("cantidad", "sum"), ingreso=("ingreso", "sum"))
    )


def completar_matriz(diario: pd.DataFrame, catalogo: pd.DataFrame) -> pd.DataFrame:
    """
    Una fila por producto por día, haya habido venta o no.

    Se arma el producto cartesiano completo y se le pegan las ventas. Lo que
    no calza queda en cero: es un día en que ese producto no se vendió.
    """
    fechas = pd.DataFrame({"fecha": pd.date_range(INICIO, FIN, freq="D")})
    productos = catalogo[["producto_id", "codigo", "producto", "categoria", "precio", "costo"]]

    matriz = fechas.merge(productos, how="cross").merge(
        diario, on=["fecha", "producto_id"], how="left"
    )

    matriz["cantidad_vendida"] = matriz["cantidad_vendida"].fillna(0).astype(int)
    matriz["ingreso"] = matriz["ingreso"].fillna(0).round(2)

    return matriz[COLUMNAS_FINALES].sort_values(["fecha", "codigo"]).reset_index(drop=True)


# ─────────────────────────────────────────────────────────────────────────
# CALIDAD
# ─────────────────────────────────────────────────────────────────────────

def reporte_de_calidad(crudo: pd.DataFrame, final: pd.DataFrame, limpieza: dict) -> dict:
    return {
        "filas_raw": len(crudo),
        "filas_procesadas": len(final),
        "fecha_minima": final["fecha"].min().date().isoformat(),
        "fecha_maxima": final["fecha"].max().date().isoformat(),
        "dias": final["fecha"].nunique(),
        "productos": final["producto_id"].nunique(),
        "nulos_en_procesado": int(final.isna().sum().sum()),
        "duplicados_fecha_producto": int(final.duplicated(["fecha", "producto_id"]).sum()),
        "cantidades_negativas": int((final["cantidad_vendida"] < 0).sum()),
        "ingresos_negativos": int((final["ingreso"] < 0).sum()),
        "registros_con_cero_ventas": int((final["cantidad_vendida"] == 0).sum()),
        "demanda_total_unidades": int(final["cantidad_vendida"].sum()),
        "ingreso_total": round(float(final["ingreso"].sum()), 2),
        **limpieza,
    }


def imprimir_reporte(reporte: dict) -> None:
    print("\nREPORTE DE CALIDAD")
    print("─" * 58)

    for clave, valor in reporte.items():
        texto = f"{valor:,}" if isinstance(valor, (int, float)) else valor
        print(f"  {clave.replace('_', ' '):.<44} {texto}")


def guardar_reporte(reporte: dict) -> None:
    """
    Se guarda además de imprimirse: es evidencia para el informe, y al ser un
    archivo se puede comparar entre dos ejecuciones para comprobar que el
    proceso es reproducible.
    """
    REPORTE.parent.mkdir(parents=True, exist_ok=True)
    # newline fijo: write_text traduce "\n" a "\r\n" en Windows, y el mismo
    # script produciría bytes distintos según el sistema donde corra.
    REPORTE.write_text(
        json.dumps(reporte, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )


# ─────────────────────────────────────────────────────────────────────────
# CARGA
# ─────────────────────────────────────────────────────────────────────────

def cargar(final: pd.DataFrame) -> None:
    SALIDA.parent.mkdir(parents=True, exist_ok=True)

    salida = final.copy()
    salida["fecha"] = salida["fecha"].dt.strftime("%Y-%m-%d")

    salida.to_csv(
        SALIDA, index=False, encoding="utf-8", lineterminator="\n", float_format="%.2f"
    )


def main() -> None:
    configurar_consola()

    crudo, catalogo = extraer()

    tickets = normalizar_tipos(crudo)
    tickets, duplicados = quitar_duplicados(tickets)
    tickets, invalidas = quitar_cantidades_invalidas(tickets)
    tickets, precios = recuperar_precios(tickets, catalogo)
    tickets, ingresos = recalcular_ingresos(tickets)

    final = completar_matriz(agregar_por_dia(tickets), catalogo)

    cargar(final)

    reporte = reporte_de_calidad(
        crudo,
        final,
        {
            "limpieza_duplicados_quitados": duplicados,
            "limpieza_cantidades_invalidas_quitadas": invalidas,
            "limpieza_precios_recuperados": precios,
            "limpieza_ingresos_recalculados": ingresos,
        },
    )

    imprimir_reporte(reporte)
    guardar_reporte(reporte)

    print(f"\nArchivo: {SALIDA.relative_to(RAIZ)}")
    print(f"Reporte: {REPORTE.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
