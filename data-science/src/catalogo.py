"""
El catálogo de 50 productos que usan la simulación y el ETL.

Se arma con dos archivos que nunca se mezclan en disco:

    data/raw/productos_sistema.csv     9 productos REALES del Sistema Ferretería
    data/raw/productos_sinteticos.csv  41 productos SINTÉTICOS académicos

Se mantienen separados a propósito. Así queda a la vista, en el propio
repositorio, qué vino del sistema y qué se inventó para el análisis, y el
archivo real se puede comparar contra Supabase sin ruido.

Vive en un módulo aparte porque el generador y el ETL necesitan exactamente
el mismo catálogo. Leerlo en dos lugares es la forma más simple de que un día
se desincronicen.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parents[1]
SISTEMA = RAIZ / "data" / "raw" / "productos_sistema.csv"
SINTETICOS = RAIZ / "data" / "raw" / "productos_sinteticos.csv"

COLUMNAS = ["producto_id", "codigo", "producto", "categoria", "precio", "costo", "stock_minimo"]


def leer_catalogo() -> pd.DataFrame:
    """Los 50 productos, con una columna `origen` que dice de dónde salió cada uno."""
    sistema = pd.read_csv(SISTEMA, encoding="utf-8")[COLUMNAS].assign(origen="sistema")
    sinteticos = pd.read_csv(SINTETICOS, encoding="utf-8")[COLUMNAS].assign(origen="sintetico")

    catalogo = pd.concat([sistema, sinteticos], ignore_index=True)
    validar(catalogo)

    return catalogo


def validar(catalogo: pd.DataFrame) -> None:
    """
    Se detiene ante un catálogo que produciría un dataset incoherente.

    El nombre NO se exige único: dos productos reales del sistema se llaman
    igual ("Candado de bronce 40 mm") y no se pueden renombrar. Por eso todo el
    pipeline agrupa por `producto_id` y nunca por nombre.
    """
    problemas = []

    for columna in ("producto_id", "codigo"):
        repetidos = catalogo.loc[catalogo[columna].duplicated(), columna].tolist()
        if repetidos:
            problemas.append(f"{columna} repetido: {repetidos}")

    if catalogo[COLUMNAS].isna().any().any():
        problemas.append("hay valores vacíos en el catálogo")

    invalidos = catalogo.loc[~((catalogo["precio"] > catalogo["costo"]) & (catalogo["costo"] > 0)), "codigo"]
    if len(invalidos):
        problemas.append(f"precio no mayor que costo o costo no positivo: {invalidos.tolist()}")

    if problemas:
        raise ValueError("Catálogo inválido:\n  " + "\n  ".join(problemas))
