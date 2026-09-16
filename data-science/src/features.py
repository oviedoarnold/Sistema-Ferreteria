"""
Variables y objetivos para predecir la demanda acumulada de cada producto.

CONVENCIÓN TEMPORAL

Toda fila representa una decisión tomada AL CIERRE DEL DÍA t, cuando ya se
conocen las ventas de ese día y de todos los anteriores, y todavía no se sabe
nada del día siguiente.

    Objetivo            demanda_7d(t)  = ventas de t+1 a t+7
                        demanda_30d(t) = ventas de t+1 a t+30

    Historia            solo ventas de días ≤ t
    Calendario          fecha t, y días de atención entre t+1 y t+h

Por eso las medias móviles incluyen el día t: el objetivo empieza en t+1, y al
cierre de t la venta de ese día ya está registrada. Excluirla desperdiciaría la
información más reciente sin evitar ninguna fuga. Lo que no puede aparecer en
una fila es nada posterior a t, y `verificar_sin_fuga` lo comprueba alterando
el futuro y exigiendo que las variables no cambien.

La única información "del futuro" que entra es el calendario: qué días de la
próxima semana abre la ferretería. No es una fuga: el calendario se conoce de
antemano.

Uso desde otros scripts:
    from features import construir, leer_demanda
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from generate_dataset import FERIADOS_2026

RAIZ = Path(__file__).resolve().parents[1]
DATASET = RAIZ / "data" / "processed" / "demanda_diaria.csv"

HORIZONTES = (7, 30)

# Lo que necesita la ventana más larga: sin 28 días de historia no hay
# media_28 ni lag_28, y la fila no se usa.
HISTORIA_MINIMA = 28

LAGS = (1, 7, 14, 28)
VENTANAS = (7, 14, 28)

# El historial termina el 31 de agosto, pero la predicción mira septiembre. El
# 15 de septiembre, Día de la Independencia, la ferretería no abre. No está en
# el generador porque cae fuera del período simulado.
FERIADOS = set(FERIADOS_2026) | {"2026-09-15"}


# ─────────────────────────────────────────────────────────────────────────
# QUÉ ENTRA AL MODELO
# ─────────────────────────────────────────────────────────────────────────

CATEGORICAS = ["producto_id", "categoria"]

CALENDARIO = ["dia_semana", "mes", "dia_mes"]

HISTORIA = [f"lag_{k}" for k in LAGS] + [f"media_{k}" for k in VENTANAS]


def numericas(horizonte: int) -> list[str]:
    return CALENDARIO + HISTORIA + [f"dias_abiertos_{horizonte}"]


def variables(horizonte: int) -> list[str]:
    return CATEGORICAS + numericas(horizonte)


def objetivo(horizonte: int) -> str:
    return f"demanda_{horizonte}d"


def baseline(horizonte: int) -> str:
    return f"baseline_{horizonte}d"


# Columnas que existen en el dataset y NO entran al modelo, con su razón. Se
# declaran aquí para que la exclusión sea una decisión escrita y no un olvido.
EXCLUIDAS = {
    "origen": "Solo dice si el producto es del sistema o sintético. No tiene "
              "relación con la demanda: el modelo memorizaría una etiqueta administrativa.",
    "precio": "Constante por producto en todo el período. No aporta nada que "
              "producto_id no diga ya.",
    "costo": "Constante por producto. Se usa después para calcular la inversión, "
             "no para predecir cuánto se vende.",
    "ingreso": "Es cantidad × precio: contiene la misma venta que se quiere "
               "predecir.",
    "codigo": "Mismo producto que producto_id, en otro formato.",
    "producto": "Mismo producto que producto_id, en otro formato.",
    "fin_de_semana": "Redundante con dia_semana. Además, una ventana de 7 días "
                     "siempre contiene exactamente un sábado.",
}


# ─────────────────────────────────────────────────────────────────────────
# CONSTRUCCIÓN
# ─────────────────────────────────────────────────────────────────────────

def leer_demanda() -> pd.DataFrame:
    demanda = pd.read_csv(DATASET, encoding="utf-8", parse_dates=["fecha"])

    return demanda.sort_values(["producto_id", "fecha"]).reset_index(drop=True)


def dias_abiertos_siguientes(fechas: pd.Series, horizonte: int) -> pd.Series:
    """
    Cuántos días abre la ferretería entre t+1 y t+h.

    Una semana normal tiene 6; la de Semana Santa, 4. Sin esta variable el
    modelo no tendría forma de anticipar que una ventana con feriados vende
    menos, aunque el calendario se conoce de antemano.
    """
    inicio = fechas.min()
    fin = fechas.max() + pd.Timedelta(days=horizonte)
    calendario = pd.date_range(inicio, fin, freq="D")

    abierto = pd.Series(
        (calendario.dayofweek != 6) & ~calendario.strftime("%Y-%m-%d").isin(FERIADOS),
        index=calendario,
    ).astype(int)

    # Suma de t+1 … t+h: acumulado en t+h menos acumulado en t.
    acumulado = abierto.cumsum()
    siguientes = acumulado.shift(-horizonte) - acumulado

    return fechas.map(siguientes).astype(int)


def historia_de_un_producto(ventas: pd.Series) -> pd.DataFrame:
    """
    Variables de historia de UN producto, en orden de fecha.

    lag_k    venta k días antes del primer día a predecir (t+1).
             lag_1 es la venta de t; lag_7, la del mismo día de la semana
             que t+1, una semana antes.
    media_k  promedio de los k días que terminan en t, incluido t.
    """
    columnas = {}

    for k in LAGS:
        columnas[f"lag_{k}"] = ventas.shift(k - 1)

    for k in VENTANAS:
        columnas[f"media_{k}"] = ventas.rolling(k, min_periods=k).mean()

    return pd.DataFrame(columnas, index=ventas.index)


def objetivos_de_un_producto(ventas: pd.Series) -> pd.DataFrame:
    """
    Suma de t+1 a t+h como diferencia de acumulados.

    Queda vacía cuando el futuro necesario no existe en el historial, y esas
    filas no se usan para entrenar ni para evaluar: rellenarlas inventaría una
    demanda que se desploma al final del período.
    """
    acumulado = ventas.cumsum()

    return pd.DataFrame(
        {objetivo(h): acumulado.shift(-h) - acumulado for h in HORIZONTES},
        index=ventas.index,
    )


def construir(demanda: pd.DataFrame) -> pd.DataFrame:
    """
    Una fila por producto por día con historia suficiente: variables, baseline
    y objetivos. Las filas del final del período conservan sus variables y
    tienen el objetivo vacío: son las que sirven para predecir.
    """
    demanda = demanda.sort_values(["producto_id", "fecha"]).reset_index(drop=True)
    ventas = demanda.groupby("producto_id", sort=False)["cantidad_vendida"]

    historia = ventas.apply(historia_de_un_producto).reset_index(level=0, drop=True)
    objetivos = ventas.apply(objetivos_de_un_producto).reset_index(level=0, drop=True)

    filas = pd.concat([demanda, historia, objetivos], axis=1)

    filas["dia_semana"] = filas["fecha"].dt.dayofweek
    filas["mes"] = filas["fecha"].dt.month
    filas["dia_mes"] = filas["fecha"].dt.day

    for h in HORIZONTES:
        filas[f"dias_abiertos_{h}"] = dias_abiertos_siguientes(filas["fecha"], h)
        # Baseline aprobado: promedio diario de los últimos 28 días × horizonte.
        filas[baseline(h)] = filas["media_28"] * h

    con_historia = filas["media_28"].notna() & filas["lag_28"].notna()

    return filas[con_historia].reset_index(drop=True)


# ─────────────────────────────────────────────────────────────────────────
# VERIFICACIÓN DE FUGA
# ─────────────────────────────────────────────────────────────────────────

def verificar_sin_fuga(demanda: pd.DataFrame, muestras: int = 200, semilla: int = 42) -> dict:
    """
    Comprueba con datos, y no por inspección del código, que ninguna fila usa
    información posterior a su fecha.

    Para una muestra de filas (producto, t):

    1. Se reemplaza TODA la venta posterior a t por valores absurdos y se
       reconstruye. Si alguna variable de la fila t cambia, esa variable está
       mirando el futuro.
    2. Se reemplaza la venta de t y la anterior. El objetivo de la fila t no
       debe cambiar: si cambiara, el objetivo estaría incluyendo el presente o
       el pasado.
    3. El objetivo tiene que ser exactamente la suma de t+1 a t+h.
    """
    rng = np.random.default_rng(semilla)
    base = construir(demanda)
    elegidas = base.iloc[rng.choice(len(base), size=min(muestras, len(base)), replace=False)]

    columnas_historia = HISTORIA + CALENDARIO + [f"dias_abiertos_{h}" for h in HORIZONTES]
    objetivos = [objetivo(h) for h in HORIZONTES]

    futuro_limpio, pasado_limpio, suma_exacta = True, True, True

    for fila in elegidas.itertuples(index=False):
        del_producto = demanda[demanda["producto_id"] == fila.producto_id].copy()
        es_futuro = del_producto["fecha"] > fila.fecha

        # 1. Alterar el futuro no puede cambiar las variables de t.
        alterada = del_producto.copy()
        alterada.loc[es_futuro, "cantidad_vendida"] = 10_000
        reconstruida = construir(alterada)
        en_t = reconstruida[reconstruida["fecha"] == fila.fecha].iloc[0]
        original = base[(base["producto_id"] == fila.producto_id) & (base["fecha"] == fila.fecha)].iloc[0]

        if not np.allclose(en_t[columnas_historia].astype(float), original[columnas_historia].astype(float)):
            futuro_limpio = False

        # 2. Alterar el presente y el pasado no puede cambiar el objetivo de t.
        alterada = del_producto.copy()
        alterada.loc[~es_futuro, "cantidad_vendida"] = 10_000
        reconstruida = construir(alterada)
        en_t = reconstruida[reconstruida["fecha"] == fila.fecha]

        if len(en_t):
            antes = original[objetivos].astype(float).to_numpy()
            despues = en_t.iloc[0][objetivos].astype(float).to_numpy()
            if not np.allclose(antes, despues, equal_nan=True):
                pasado_limpio = False

        # 3. El objetivo es la suma de t+1 a t+h, ni un día más ni uno menos.
        for h in HORIZONTES:
            ventana = del_producto[
                (del_producto["fecha"] > fila.fecha)
                & (del_producto["fecha"] <= fila.fecha + pd.Timedelta(days=h))
            ]
            valor = original[objetivo(h)]

            if len(ventana) == h:
                if not np.isclose(valor, ventana["cantidad_vendida"].sum()):
                    suma_exacta = False
            elif not pd.isna(valor):
                suma_exacta = False

    return {
        "filas_revisadas": int(len(elegidas)),
        "variables_no_cambian_al_alterar_el_futuro": futuro_limpio,
        "objetivo_no_cambia_al_alterar_el_presente_y_el_pasado": pasado_limpio,
        "objetivo_es_exactamente_la_suma_de_t_mas_1_a_t_mas_h": suma_exacta,
    }


def probar_la_verificacion(demanda: pd.DataFrame, muestras: int = 40) -> dict:
    """
    Una verificación que siempre dice "sin fuga" no demuestra nada. Aquí se le
    inyectan tres fugas a propósito y se exige que las detecte, cada una en la
    comprobación que le corresponde. Si alguna pasa inadvertida, la verificación
    no sirve y el entrenamiento se detiene.
    """
    global historia_de_un_producto, objetivos_de_un_producto

    historia_original = historia_de_un_producto
    objetivos_original = objetivos_de_un_producto

    def media_centrada(ventas: pd.Series) -> pd.DataFrame:
        historia = historia_original(ventas)
        historia["media_7"] = ventas.rolling(7, center=True, min_periods=7).mean()
        return historia

    def lag_de_manana(ventas: pd.Series) -> pd.DataFrame:
        historia = historia_original(ventas)
        historia["lag_1"] = ventas.shift(-1)
        return historia

    def objetivo_con_el_dia_t(ventas: pd.Series) -> pd.DataFrame:
        acumulado = ventas.cumsum()
        return pd.DataFrame(
            {objetivo(h): acumulado.shift(-h) - acumulado.shift(1) for h in HORIZONTES},
            index=ventas.index,
        )

    try:
        historia_de_un_producto = media_centrada
        media = verificar_sin_fuga(demanda, muestras)

        historia_de_un_producto = lag_de_manana
        lag = verificar_sin_fuga(demanda, muestras)

        historia_de_un_producto = historia_original
        objetivos_de_un_producto = objetivo_con_el_dia_t
        objetivo_t = verificar_sin_fuga(demanda, muestras)
    finally:
        historia_de_un_producto = historia_original
        objetivos_de_un_producto = objetivos_original

    return {
        "detecta_media_movil_centrada": not media["variables_no_cambian_al_alterar_el_futuro"],
        "detecta_lag_que_mira_manana": not lag["variables_no_cambian_al_alterar_el_futuro"],
        "detecta_objetivo_que_incluye_el_dia_t": not objetivo_t["objetivo_no_cambia_al_alterar_el_presente_y_el_pasado"],
    }
