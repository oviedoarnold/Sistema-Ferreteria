"""
Genera el historial de ventas simulado del Sistema Ferretería.

POR QUÉ SIMULADO

La base real tiene 7 ventas repartidas en 3 fechas. Con eso no se puede ni
calcular un promedio móvil de una semana, mucho menos entrenar un modelo. Este
script construye ocho meses de historial para que el problema de predicción
tenga datos con los que trabajar.

POR QUÉ 50 PRODUCTOS

El sistema está en desarrollo y hoy tiene 9 productos. Nueve no representan el
surtido de una ferretería, y además dejaban cinco categorías con un solo
producto: la categoría repetía lo mismo que el producto y no aportaba nada al
modelo. Se completó el catálogo hasta 50 con productos sintéticos académicos
(ver src/catalogo.py). Los 9 reales se conservan sin cambios y los 41 nuevos
no existen en Supabase.

CÓMO SE CONSTRUYE LA DEMANDA

No se sortean números independientes, ni se aplica una misma curva
multiplicada por una constante. Cada producto combina tres perfiles:

    λ = base × día_de_semana × temporada^sensibilidad × tendencia × pedido_grande

    · Su ROTACIÓN (alta, media, baja) fija la demanda base y cuán irregular es.
    · Su CATEGORÍA fija la forma de la semana y de la temporada.
    · Sus PARÁMETROS PROPIOS, sorteados con su propia semilla, hacen que dos
      productos de la misma categoría no se muevan igual: cuánto reaccionan a
      la temporada, si crecen o decaen, y pequeñas variaciones por día.

Sobre esa λ se sortea la cantidad con una binomial negativa. La demanda de un
comercio está sobredispersa, y cuanto más baja la rotación, más a ráfagas: un
taladro se vende de a uno, con semanas enteras sin moverse.

Después, las unidades de cada día se reparten en tickets con su hora, como
llegarían del punto de venta. Eso es lo que el ETL tiene que volver a agregar.

Uso:
    python src/generate_dataset.py
"""

from __future__ import annotations

import sys
import zlib
from pathlib import Path

import numpy as np
import pandas as pd

from catalogo import leer_catalogo

SEMILLA = 42

INICIO = "2026-01-01"
FIN = "2026-08-31"

RAIZ = Path(__file__).resolve().parents[1]
SALIDA = RAIZ / "data" / "raw" / "ventas_simuladas_2026.csv"


# ─────────────────────────────────────────────────────────────────────────
# ROTACIÓN
#
# Cuán irregular es la demanda. La dispersión es el parámetro de forma de la
# binomial negativa: más baja, más ráfagas y más días en cero para la misma
# demanda media.
# ─────────────────────────────────────────────────────────────────────────

DISPERSION = {
    "alta": 5.0,   # consumibles: se venden casi todos los días, sin grandes saltos
    "media": 3.0,
    "baja": 1.2,   # equipos y artículos caros: se venden a ráfagas
}


# ─────────────────────────────────────────────────────────────────────────
# PRODUCTOS
#
# (rotación, unidades base por día, máximo de unidades por ticket)
#
# La base se lee como "cuántas unidades vende un miércoles de enero". Se
# escribe explícita y no se deriva del precio, para que cada valor se pueda
# defender por separado. El máximo por ticket reparte las unidades del día en
# compras verosímiles: nadie lleva 10 taladros, pero sí 10 codos de PVC.
#
# La rotación NO se guarda en el dataset: es un parámetro de la simulación.
# Guardarla le daría al modelo una columna que resume la respuesta.
# ─────────────────────────────────────────────────────────────────────────

PRODUCTOS = {
    # Sistema Ferretería — mismos valores base que la versión de 9 productos
    "CEM-001": ("alta", 7.00, 8),
    "TOR-001": ("alta", 5.50, 4),
    "PLO-001": ("alta", 4.00, 5),
    "HER-002": ("media", 2.20, 2),
    "PIN-001": ("media", 1.80, 3),
    "HER-001": ("media", 1.30, 2),
    "CER-023": ("media", 1.10, 2),
    "CER-001": ("media", 0.80, 2),
    "ELE-001": ("baja", 0.35, 1),   # rollo de 100 m a L1150: solo para obra

    # Construcción
    "FER-010": ("alta", 3.00, 6),
    "FER-011": ("media", 1.60, 4),
    "FER-012": ("baja", 0.50, 2),
    "FER-013": ("media", 0.90, 4),
    "FER-014": ("alta", 4.50, 6),
    # Eléctrico
    "FER-015": ("media", 2.20, 4),
    "FER-016": ("media", 2.00, 4),
    "FER-017": ("media", 0.90, 3),
    "FER-018": ("alta", 3.80, 3),
    "FER-019": ("alta", 3.20, 4),
    # Plomería
    "FER-020": ("alta", 6.50, 10),
    "FER-021": ("alta", 4.20, 8),
    "FER-022": ("alta", 2.80, 2),
    "FER-023": ("media", 1.10, 3),
    "FER-024": ("baja", 0.35, 1),
    # Herramientas
    "FER-025": ("media", 0.90, 1),
    "FER-026": ("media", 1.40, 2),
    "FER-027": ("baja", 0.55, 1),
    # Herramientas Eléctricas
    "FER-028": ("baja", 0.18, 1),
    "FER-029": ("baja", 0.15, 1),
    "FER-030": ("baja", 0.08, 1),
    "FER-031": ("baja", 0.06, 1),
    # Pinturas
    "FER-032": ("media", 1.00, 3),
    "FER-033": ("media", 1.30, 2),
    "FER-034": ("media", 2.10, 3),
    "FER-035": ("media", 1.20, 2),
    # Tornillería
    "FER-036": ("alta", 5.00, 6),
    "FER-037": ("media", 2.40, 12),
    "FER-038": ("media", 1.50, 3),
    # Cerrajería
    "FER-039": ("media", 1.60, 4),
    "FER-040": ("baja", 0.40, 1),
    # Jardinería
    "FER-041": ("media", 0.70, 2),
    "FER-042": ("media", 1.00, 2),
    "FER-043": ("baja", 0.35, 1),
    "FER-044": ("baja", 0.45, 1),
    # Seguridad
    "FER-045": ("media", 1.50, 6),
    "FER-046": ("media", 0.90, 4),
    "FER-047": ("baja", 0.40, 3),
    # Adhesivos y Selladores
    "FER-048": ("media", 1.40, 3),
    "FER-049": ("media", 0.70, 2),
    "FER-050": ("baja", 0.45, 2),
}


# ─────────────────────────────────────────────────────────────────────────
# SEMANA
#
# Lunes a domingo. El domingo la ferretería no abre.
# ─────────────────────────────────────────────────────────────────────────

SEMANA_OBRA = [0.90, 0.95, 1.00, 1.00, 1.15, 1.45, 0.0]        # la obra se compra el sábado
SEMANA_REPARACION = [1.05, 1.00, 1.00, 1.00, 1.05, 1.20, 0.0]  # algo se rompe cualquier día
SEMANA_JARDIN = [0.80, 0.85, 0.90, 0.95, 1.10, 1.70, 0.0]      # el jardín se atiende el fin de semana
SEMANA_CONTRATISTA = [1.30, 1.10, 1.00, 0.95, 0.95, 1.00, 0.0]  # la cuadrilla se equipa el lunes


# ─────────────────────────────────────────────────────────────────────────
# TEMPORADA
#
# Enero a agosto. En Honduras la temporada seca (febrero a abril) es
# temporada de construcción, y con las lluvias de mayo en adelante la obra se
# frena. Jardinería va al revés: se siembra cuando empiezan las lluvias.
# ─────────────────────────────────────────────────────────────────────────

TEMPORADA_OBRA = {1: 1.00, 2: 1.12, 3: 1.25, 4: 1.20, 5: 1.02, 6: 0.88, 7: 0.82, 8: 0.86}
TEMPORADA_PINTURA = {1: 0.92, 2: 1.00, 3: 1.18, 4: 1.24, 5: 1.02, 6: 0.88, 7: 0.84, 8: 0.90}
TEMPORADA_LLUVIAS = {1: 0.80, 2: 0.78, 3: 0.85, 4: 0.98, 5: 1.30, 6: 1.35, 7: 1.18, 8: 1.05}
# Obra en seco, y reparaciones cuando las lluvias revientan tuberías.
TEMPORADA_PLOMERIA = {1: 1.00, 2: 1.06, 3: 1.10, 4: 1.06, 5: 1.00, 6: 0.98, 7: 1.03, 8: 1.05}
TEMPORADA_ESTABLE = {1: 1.03, 2: 0.98, 3: 1.02, 4: 1.00, 5: 0.99, 6: 1.01, 7: 0.97, 8: 1.00}


# ─────────────────────────────────────────────────────────────────────────
# CATEGORÍAS
#
# sensibilidad: rango del exponente que se aplica a la curva de temporada.
#     Cada producto sortea el suyo. 1 sigue la curva, 0.3 apenas la nota,
#     1.4 la exagera. Es lo que evita que todos los productos de una categoría
#     suban y bajen igual.
#
# pedidos_grandes: probabilidad diaria de que un contratista compre por
#     volumen. Solo en categorías de obra.
# ─────────────────────────────────────────────────────────────────────────

CATEGORIAS = {
    "Construcción":            dict(semana=SEMANA_OBRA,        temporada=TEMPORADA_OBRA,     sensibilidad=(0.9, 1.4), pedidos_grandes=0.020),
    "Plomería":                dict(semana=SEMANA_REPARACION,  temporada=TEMPORADA_PLOMERIA, sensibilidad=(0.7, 1.3), pedidos_grandes=0.012),
    "Eléctrico":               dict(semana=SEMANA_REPARACION,  temporada=TEMPORADA_ESTABLE,  sensibilidad=(0.5, 1.0), pedidos_grandes=0.008),
    "Herramientas":            dict(semana=SEMANA_OBRA,        temporada=TEMPORADA_ESTABLE,  sensibilidad=(0.5, 1.2), pedidos_grandes=0.0),
    "Herramientas Eléctricas": dict(semana=SEMANA_OBRA,        temporada=TEMPORADA_OBRA,     sensibilidad=(0.2, 0.5), pedidos_grandes=0.0),
    "Pinturas":                dict(semana=SEMANA_OBRA,        temporada=TEMPORADA_PINTURA,  sensibilidad=(0.8, 1.3), pedidos_grandes=0.006),
    "Tornillería":             dict(semana=SEMANA_OBRA,        temporada=TEMPORADA_OBRA,     sensibilidad=(0.4, 0.8), pedidos_grandes=0.015),
    "Cerrajería":              dict(semana=SEMANA_REPARACION,  temporada=TEMPORADA_ESTABLE,  sensibilidad=(0.5, 1.0), pedidos_grandes=0.0),
    "Jardinería":              dict(semana=SEMANA_JARDIN,      temporada=TEMPORADA_LLUVIAS,  sensibilidad=(0.9, 1.4), pedidos_grandes=0.0),
    "Seguridad":               dict(semana=SEMANA_CONTRATISTA, temporada=TEMPORADA_OBRA,     sensibilidad=(0.4, 0.9), pedidos_grandes=0.010),
    "Adhesivos y Selladores":  dict(semana=SEMANA_REPARACION,  temporada=TEMPORADA_OBRA,     sensibilidad=(0.3, 0.7), pedidos_grandes=0.0),
}

# Días que la ferretería no abre, además de los domingos.
FERIADOS_2026 = {
    "2026-01-01",  # Año Nuevo
    "2026-04-02",  # Jueves Santo
    "2026-04-03",  # Viernes Santo
    "2026-05-01",  # Día del Trabajador
}

# Crecimiento de cada producto en el período. Puede ser negativo: no todo
# crece, y un catálogo donde todo sube sería sospechoso.
CRECIMIENTO_MIN, CRECIMIENTO_MAX = -0.05, 0.12

# Paso del paseo aleatorio que vuelve irregular la tendencia.
PASO_TENDENCIA = 0.012

# Variación de cada producto sobre la semana de su categoría.
VARIACION_SEMANAL = 0.04

# Cuánto multiplica la demanda un pedido de contratista.
PEDIDO_GRANDE_MIN, PEDIDO_GRANDE_MAX = 2.5, 5.0


# ─────────────────────────────────────────────────────────────────────────
# DEFECTOS INYECTADOS
#
# Un CSV perfecto no deja nada que limpiar, y el ETL es parte del entregable.
# Se inyectan defectos típicos de una exportación real, como proporción de
# los tickets. Ninguno altera la demanda verdadera: los duplicados y las
# filas inválidas son filas de más, y los precios e ingresos se reconstruyen.
# El ETL tiene que llegar exactamente al total de unidades del historial
# limpio.
# ─────────────────────────────────────────────────────────────────────────

DEFECTOS = {
    "filas_duplicadas": 0.009,
    "precios_nulos": 0.004,
    "ingresos_mal_calculados": 0.003,
    "cantidades_invalidas": 0.002,
}


def configurar_consola() -> None:
    """Windows imprime en cp1252 por omisión y rompe los acentos."""
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")


def generador_para(etiqueta: str) -> np.random.Generator:
    """
    Una secuencia aleatoria propia por producto, derivada de la semilla y del
    código.

    Si todos los productos compartieran una sola secuencia, agregar un
    producto al catálogo o cambiar el orden alteraría la demanda de todos los
    que vienen después. Así, la serie de un producto solo depende de la
    semilla y de sí mismo.

    crc32 y no hash(): hash() de Python cambia en cada ejecución.
    """
    return np.random.default_rng([SEMILLA, zlib.crc32(etiqueta.encode("utf-8"))])


def validar_parametros(catalogo: pd.DataFrame) -> None:
    sin_parametros = set(catalogo["codigo"]) ^ set(PRODUCTOS)
    if sin_parametros:
        raise ValueError(f"Catálogo y parámetros no coinciden en: {sorted(sin_parametros)}")

    sin_categoria = set(catalogo["categoria"]) - set(CATEGORIAS)
    if sin_categoria:
        raise ValueError(f"Categorías sin perfil de demanda: {sorted(sin_categoria)}")


def dias_de_atencion(fechas: pd.DatetimeIndex) -> np.ndarray:
    abre = fechas.dayofweek != 6
    feriado = fechas.strftime("%Y-%m-%d").isin(FERIADOS_2026)

    return np.asarray(abre & ~feriado)


def semana_del_producto(rng: np.random.Generator, perfil: list[float]) -> np.ndarray:
    variacion = rng.normal(1.0, VARIACION_SEMANAL, 7)

    return np.array(perfil) * variacion


def temporada_del_producto(
    rng: np.random.Generator, categoria: dict, meses: np.ndarray
) -> np.ndarray:
    sensibilidad = rng.uniform(*categoria["sensibilidad"])
    curva = np.array([categoria["temporada"][m] for m in meses])

    return curva**sensibilidad


def tendencia(rng: np.random.Generator, dias: int) -> np.ndarray:
    """
    Una recta más un paseo aleatorio suavizado: se mueve en promedio hacia un
    lado, pero con semanas mejores y peores. Se suaviza para que el ruido de la
    tendencia no se confunda con el ruido diario.
    """
    crecimiento = rng.uniform(CRECIMIENTO_MIN, CRECIMIENTO_MAX)
    recta = crecimiento * np.linspace(0, 1, dias)

    paseo = np.cumsum(rng.normal(0, PASO_TENDENCIA, dias))
    ventana = 14
    suavizado = np.convolve(paseo, np.ones(ventana) / ventana, mode="same")

    return np.clip(1 + recta + suavizado, 0.5, None)


def pedidos_grandes(rng: np.random.Generator, probabilidad: float, dias: int) -> np.ndarray:
    ocurre = rng.random(dias) < probabilidad
    multiplicador = rng.uniform(PEDIDO_GRANDE_MIN, PEDIDO_GRANDE_MAX, dias)

    return np.where(ocurre, multiplicador, 1.0)


def sortear_unidades(rng: np.random.Generator, lam: np.ndarray, dispersion: float) -> np.ndarray:
    """
    Binomial negativa como mezcla gamma-Poisson: se sortea una tasa del día
    alrededor de λ y después las unidades con esa tasa.
    """
    escala = np.where(lam > 0, lam / dispersion, 0)
    tasa = rng.gamma(shape=dispersion, scale=escala)

    return rng.poisson(tasa)


def repartir_en_tickets(rng: np.random.Generator, unidades: int, maximo: int) -> list[int]:
    tickets = []

    while unidades > 0:
        cantidad = min(unidades, int(rng.integers(1, maximo + 1)))
        tickets.append(cantidad)
        unidades -= cantidad

    return tickets


def hora_de_venta(rng: np.random.Generator) -> str:
    """Horario de 7:00 a 17:00, con más clientes a media mañana."""
    minutos = int(np.clip(rng.normal(11.5 * 60, 2.3 * 60), 7 * 60, 16 * 60 + 59))

    return f"{minutos // 60:02d}:{minutos % 60:02d}:00"


def demanda_del_producto(producto, fechas: pd.DatetimeIndex, abierto: np.ndarray) -> np.ndarray:
    rng = generador_para(producto.codigo)
    rotacion, base, _ = PRODUCTOS[producto.codigo]
    categoria = CATEGORIAS[producto.categoria]

    lam = (
        base
        * semana_del_producto(rng, categoria["semana"])[fechas.dayofweek]
        * temporada_del_producto(rng, categoria, fechas.month.to_numpy())
        * tendencia(rng, len(fechas))
        * pedidos_grandes(rng, categoria["pedidos_grandes"], len(fechas))
        * abierto
    )

    return sortear_unidades(rng, lam, DISPERSION[rotacion])


def generar_historial(catalogo: pd.DataFrame) -> pd.DataFrame:
    fechas = pd.date_range(INICIO, FIN, freq="D")
    abierto = dias_de_atencion(fechas)

    eventos = []

    for producto in catalogo.itertuples(index=False):
        unidades_por_dia = demanda_del_producto(producto, fechas, abierto)

        # Los tickets usan su propia secuencia, separada de la demanda: así
        # cambiar cómo se reparte un día en tickets no altera cuánto se vendió.
        rng = generador_para(f"tickets:{producto.codigo}")
        maximo = PRODUCTOS[producto.codigo][2]

        for fecha, unidades in zip(fechas, unidades_por_dia):
            for cantidad in repartir_en_tickets(rng, int(unidades), maximo):
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

    historial = pd.DataFrame(eventos).sort_values(["fecha_hora", "codigo"], kind="stable")
    historial["ingreso"] = (historial["cantidad"] * historial["precio_unitario"]).round(2)
    historial.insert(0, "evento_id", [f"EV-{i:06d}" for i in range(1, len(historial) + 1)])

    return historial.reset_index(drop=True)


def cantidad_de_defectos(tickets: int) -> dict[str, int]:
    return {nombre: max(1, round(tickets * proporcion)) for nombre, proporcion in DEFECTOS.items()}


def inyectar_defectos(historial: pd.DataFrame, cantidades: dict[str, int]) -> pd.DataFrame:
    """
    Ensucia una copia del historial con defectos conocidos. Las posiciones se
    sortean con una secuencia propia, así que también son reproducibles.
    """
    rng = generador_para("defectos")
    sucio = historial.copy()
    sucio["cantidad"] = sucio["cantidad"].astype(object)

    precios = rng.choice(len(sucio), size=cantidades["precios_nulos"], replace=False)
    sucio.loc[precios, "precio_unitario"] = np.nan

    candidatas = np.setdiff1d(np.arange(len(sucio)), precios)
    ingresos = rng.choice(candidatas, size=cantidades["ingresos_mal_calculados"], replace=False)
    sucio.loc[ingresos, "ingreso"] = (sucio.loc[ingresos, "ingreso"] * 10).round(2)

    duplicadas = sucio.iloc[
        rng.choice(len(sucio), size=cantidades["filas_duplicadas"], replace=False)
    ]

    invalidas = sucio.iloc[
        rng.choice(len(sucio), size=cantidades["cantidades_invalidas"], replace=False)
    ].copy()
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

    catalogo = leer_catalogo()
    validar_parametros(catalogo)

    historial = generar_historial(catalogo)
    defectos = cantidad_de_defectos(len(historial))

    crudo = inyectar_defectos(historial, defectos)
    crudo.to_csv(SALIDA, index=False, encoding="utf-8", lineterminator="\n")

    rotaciones = pd.Series({c: p[0] for c, p in PRODUCTOS.items()}).value_counts()
    origen = catalogo["origen"].value_counts()

    print(f"Semilla ............. {SEMILLA}")
    print(f"Período ............. {INICIO} → {FIN}")
    print(f"Productos ........... {len(catalogo)} ({origen['sistema']} del sistema, {origen['sintetico']} sintéticos)")
    print(f"Categorías .......... {catalogo['categoria'].nunique()}")
    print(f"Rotación ............ alta {rotaciones['alta']} · media {rotaciones['media']} · baja {rotaciones['baja']}")
    print(f"Tickets limpios ..... {len(historial):,}")
    print(f"Unidades reales ..... {int(historial['cantidad'].sum()):,}")
    print(f"Defectos inyectados . {defectos}")
    print(f"Filas en el CSV ..... {len(crudo):,}")
    print(f"Archivo ............. {SALIDA.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
