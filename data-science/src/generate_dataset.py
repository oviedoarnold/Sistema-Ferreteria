"""
Genera el historial de ventas simulado del Sistema Ferretería.

POR QUÉ SIMULADO

La base real tiene 7 ventas repartidas en 3 fechas. Con eso no se puede ni
calcular un promedio móvil de una semana, mucho menos entrenar un modelo. Este
script construye ocho meses de historial sobre los 9 productos reales del
sistema, para que el problema de predicción tenga datos con los que trabajar.

Los datos son sintéticos y así se declaran en todas partes. Los productos, sus
precios, costos y categorías sí son los reales: vienen de una instantánea del
catálogo en data/raw/productos_sistema.csv.

CÓMO SE CONSTRUYE LA DEMANDA

No se sortean números independientes. La demanda esperada de cada producto en
cada día se arma por capas, y cada capa responde a algo del negocio:

    λ = base × día_de_semana × temporada × tendencia

Sobre esa λ se sortea la cantidad con una binomial negativa, no con una
Poisson. La demanda real de un comercio está sobredispersa —su varianza es
mayor que su media— y una Poisson produciría series demasiado regulares, que
harían parecer fácil un problema que no lo es.

Después, las unidades de cada día se reparten en tickets individuales con su
hora, que es como llegarían desde el punto de venta. Eso es lo que el ETL tiene
que volver a agregar.

Uso:
    python src/generate_dataset.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

SEMILLA = 42

INICIO = "2026-01-01"
FIN = "2026-08-31"

RAIZ = Path(__file__).resolve().parents[1]
CATALOGO = RAIZ / "data" / "raw" / "productos_sistema.csv"
SALIDA = RAIZ / "data" / "raw" / "ventas_simuladas_2026.csv"


# ─────────────────────────────────────────────────────────────────────────
# PARÁMETROS DEL NEGOCIO
#
# Explícitos y no derivados de una fórmula, para que cada uno se pueda
# defender por separado. Se leen como "cuántas unidades vende en un miércoles
# cualquiera de enero".
# ─────────────────────────────────────────────────────────────────────────

DEMANDA_BASE = {
    "CEM-001": 7.0,   # cemento: el producto de mayor rotación de una ferretería
    "TOR-001": 5.5,   # tornillos por caja: consumo constante y barato
    "PLO-001": 4.0,   # tubo PVC: obra y reparación doméstica
    "HER-002": 2.2,   # cinta métrica: barata, se pierde, se repone
    "PIN-001": 1.8,   # pintura por galón: ticket alto, rotación media
    "HER-001": 1.3,   # martillo: dura años, se compra poco
    "CER-023": 1.1,   # candado económico: el más elegido de los dos
    "CER-001": 0.8,   # candado estándar: más caro, se vende menos
    "ELE-001": 0.35,  # cable por rollo de 100 m: L1150, solo para obra
}

# Cuántas unidades suele llevar un cliente en una sola compra. Sirve para
# repartir las unidades del día en tickets verosímiles: nadie compra 12
# rollos de cable en un ticket, pero sí 5 bolsas de cemento.
UNIDADES_POR_TICKET = {
    "CEM-001": (1, 6),
    "TOR-001": (1, 4),
    "PLO-001": (1, 5),
    "HER-002": (1, 2),
    "PIN-001": (1, 3),
    "HER-001": (1, 2),
    "CER-023": (1, 2),
    "CER-001": (1, 2),
    "ELE-001": (1, 1),
}

# Lunes=0 … domingo=6. El sábado es el día fuerte: el cliente que trabaja
# entre semana hace sus compras de obra el fin de semana. El domingo la
# ferretería cierra.
FACTOR_DIA_SEMANA = [0.90, 0.95, 1.00, 1.00, 1.15, 1.45, 0.0]

# Temporada seca en Honduras (febrero a abril) es temporada de construcción;
# con las lluvias de junio a agosto la obra se frena. Solo afecta a las
# categorías ligadas a obra. Las demás se mantienen casi planas.
FACTOR_MES_OBRA = {1: 1.00, 2: 1.12, 3: 1.25, 4: 1.20, 5: 1.02, 6: 0.88, 7: 0.82, 8: 0.86}
FACTOR_MES_PINTURA = {1: 0.92, 2: 1.00, 3: 1.18, 4: 1.24, 5: 1.02, 6: 0.88, 7: 0.84, 8: 0.90}
FACTOR_MES_ESTABLE = {1: 1.03, 2: 0.98, 3: 1.02, 4: 1.00, 5: 0.99, 6: 1.01, 7: 0.97, 8: 1.00}

CATEGORIAS_DE_OBRA = {"Construcción", "Plomería"}

# Días que la ferretería no abre, además de los domingos.
FERIADOS_2026 = {
    "2026-01-01",  # Año Nuevo
    "2026-04-02",  # Jueves Santo
    "2026-04-03",  # Viernes Santo
    "2026-05-01",  # Día del Trabajador
}

# Crecimiento del negocio en el período. Distinto por producto, para que no
# todos suban igual.
CRECIMIENTO_MIN, CRECIMIENTO_MAX = 0.02, 0.10

# Dispersión de la binomial negativa. Más bajo = más irregular. 4 da una
# varianza de aproximadamente 1.25 veces la media en productos de rotación
# media: visible, pero sin volver la serie puro ruido.
DISPERSION = 4.0

# Paso del paseo aleatorio que perturba la tendencia. Sin él la tendencia
# sería una recta perfecta, que ningún negocio tiene.
PASO_TENDENCIA = 0.012


# ─────────────────────────────────────────────────────────────────────────
# DEFECTOS INYECTADOS
#
# Un CSV perfecto no deja nada que limpiar, y el ETL es parte del entregable.
# Se inyecta una cantidad pequeña y conocida de defectos típicos de una
# exportación real. Ninguno altera la demanda verdadera: los duplicados y las
# filas inválidas son filas de más, y los precios faltantes se recuperan del
# catálogo. Así el ETL se puede verificar: tiene que llegar exactamente al
# mismo total de unidades que tenía el historial limpio.
# ─────────────────────────────────────────────────────────────────────────

DEFECTOS = {
    "filas_duplicadas": 25,
    "precios_nulos": 12,
    "ingresos_mal_calculados": 8,
    "cantidades_invalidas": 6,
}


def configurar_consola() -> None:
    """Windows imprime en cp1252 por omisión y rompe los acentos."""
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")


def leer_catalogo() -> pd.DataFrame:
    catalogo = pd.read_csv(CATALOGO, encoding="utf-8")

    faltantes = set(catalogo["codigo"]) ^ set(DEMANDA_BASE)
    if faltantes:
        raise ValueError(
            f"El catálogo y los parámetros no coinciden en: {sorted(faltantes)}"
        )

    return catalogo


def dias_de_atencion(fechas: pd.DatetimeIndex) -> np.ndarray:
    abre = fechas.dayofweek != 6
    feriado = fechas.strftime("%Y-%m-%d").isin(FERIADOS_2026)

    return np.asarray(abre & ~feriado)


def factor_de_temporada(categoria: str, meses: np.ndarray) -> np.ndarray:
    if categoria in CATEGORIAS_DE_OBRA:
        tabla = FACTOR_MES_OBRA
    elif categoria == "Pinturas":
        tabla = FACTOR_MES_PINTURA
    else:
        tabla = FACTOR_MES_ESTABLE

    return np.array([tabla[m] for m in meses])


def tendencia(rng: np.random.Generator, dias: int) -> np.ndarray:
    """
    Crecimiento moderado con irregularidad.

    Una recta más un paseo aleatorio suavizado: sube en promedio, pero con
    semanas mejores y peores. Se suaviza para que el ruido de la tendencia no
    se confunda con el ruido diario, que ya aporta la binomial negativa.
    """
    crecimiento = rng.uniform(CRECIMIENTO_MIN, CRECIMIENTO_MAX)
    recta = crecimiento * np.linspace(0, 1, dias)

    paseo = np.cumsum(rng.normal(0, PASO_TENDENCIA, dias))
    ventana = 14
    suavizado = np.convolve(paseo, np.ones(ventana) / ventana, mode="same")

    return np.clip(1 + recta + suavizado, 0.5, None)


def sortear_unidades(rng: np.random.Generator, lam: np.ndarray) -> np.ndarray:
    """
    Binomial negativa como mezcla gamma-Poisson.

    Se sortea primero una tasa del día alrededor de λ y después las unidades
    con esa tasa. Es la forma estándar de obtener conteos sobredispersos, y
    permite que un día normal tenga de vez en cuando una compra grande.
    """
    tasa = rng.gamma(shape=DISPERSION, scale=np.where(lam > 0, lam / DISPERSION, 0))

    return rng.poisson(tasa)


def repartir_en_tickets(
    rng: np.random.Generator, unidades: int, rango: tuple[int, int]
) -> list[int]:
    minimo, maximo = rango
    tickets = []

    while unidades > 0:
        cantidad = min(unidades, int(rng.integers(minimo, maximo + 1)))
        tickets.append(cantidad)
        unidades -= cantidad

    return tickets


def hora_de_venta(rng: np.random.Generator) -> str:
    """Horario de atención de 7:00 a 17:00, con más clientes a media mañana."""
    minutos = int(np.clip(rng.normal(11.5 * 60, 2.3 * 60), 7 * 60, 16 * 60 + 59))

    return f"{minutos // 60:02d}:{minutos % 60:02d}:00"


def generar_historial(rng: np.random.Generator, catalogo: pd.DataFrame) -> pd.DataFrame:
    fechas = pd.date_range(INICIO, FIN, freq="D")
    abierto = dias_de_atencion(fechas)
    dia_semana = np.array([FACTOR_DIA_SEMANA[d] for d in fechas.dayofweek])

    eventos = []

    for producto in catalogo.itertuples(index=False):
        lam = (
            DEMANDA_BASE[producto.codigo]
            * dia_semana
            * factor_de_temporada(producto.categoria, fechas.month.to_numpy())
            * tendencia(rng, len(fechas))
            * abierto
        )

        unidades_por_dia = sortear_unidades(rng, lam)

        for fecha, unidades in zip(fechas, unidades_por_dia):
            for cantidad in repartir_en_tickets(
                rng, int(unidades), UNIDADES_POR_TICKET[producto.codigo]
            ):
                eventos.append(
                    {
                        "fecha_hora": f"{fecha:%Y-%m-%d} {hora_de_venta(rng)}",
                        "producto_id": producto.producto_id,
                        "codigo": producto.codigo,
                        "producto": producto.producto,
                        "categoria": producto.categoria,
                        "cantidad": cantidad,
                        "precio_unitario": producto.precio,
                    }
                )

    historial = pd.DataFrame(eventos).sort_values(
        ["fecha_hora", "codigo"], kind="stable"
    )
    historial["ingreso"] = (historial["cantidad"] * historial["precio_unitario"]).round(2)
    historial.insert(0, "evento_id", [f"EV-{i:06d}" for i in range(1, len(historial) + 1)])

    return historial.reset_index(drop=True)


def inyectar_defectos(rng: np.random.Generator, historial: pd.DataFrame) -> pd.DataFrame:
    """
    Ensucia una copia del historial con defectos conocidos.

    Las posiciones se sortean con la misma semilla, así que los defectos
    también son reproducibles.
    """
    sucio = historial.copy()
    sucio["cantidad"] = sucio["cantidad"].astype(object)

    filas = rng.choice(len(sucio), size=DEFECTOS["precios_nulos"], replace=False)
    sucio.loc[filas, "precio_unitario"] = np.nan

    candidatas = sucio.index.difference(filas)
    filas = rng.choice(candidatas, size=DEFECTOS["ingresos_mal_calculados"], replace=False)
    sucio.loc[filas, "ingreso"] = (sucio.loc[filas, "ingreso"] * 10).round(2)

    duplicadas = sucio.sample(n=DEFECTOS["filas_duplicadas"], random_state=SEMILLA)

    invalidas = sucio.sample(n=DEFECTOS["cantidades_invalidas"], random_state=SEMILLA + 1).copy()
    invalidas["evento_id"] = [f"EV-X{i:05d}" for i in range(1, len(invalidas) + 1)]
    invalidas["cantidad"] = rng.choice([0, -1, -2], size=len(invalidas))
    invalidas["ingreso"] = 0.0

    return (
        pd.concat([sucio, duplicadas, invalidas])
        .sort_values(["fecha_hora", "evento_id"], kind="stable")
        .reset_index(drop=True)
    )


def main() -> None:
    configurar_consola()

    rng = np.random.default_rng(SEMILLA)
    catalogo = leer_catalogo()

    historial = generar_historial(rng, catalogo)
    unidades_reales = int(historial["cantidad"].sum())

    crudo = inyectar_defectos(rng, historial)
    crudo.to_csv(SALIDA, index=False, encoding="utf-8", lineterminator="\n")

    print(f"Semilla ............. {SEMILLA}")
    print(f"Período ............. {INICIO} → {FIN}")
    print(f"Productos ........... {catalogo['codigo'].nunique()}")
    print(f"Tickets limpios ..... {len(historial):,}")
    print(f"Unidades reales ..... {unidades_reales:,}")
    print(f"Defectos inyectados . {DEFECTOS}")
    print(f"Filas en el CSV ..... {len(crudo):,}")
    print(f"Archivo ............. {SALIDA.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
