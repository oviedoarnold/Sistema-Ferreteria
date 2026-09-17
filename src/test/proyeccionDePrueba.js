/*
  Proyección de prueba con un orden de prioridad conocido de antemano.

  Doce productos: más de los diez que se muestran por omisión, para poder
  probar "Ver todos", y los tres niveles de riesgo, con empates a propósito
  para comprobar cómo se desempata.

  Orden esperado:
    alto   CEM-001 (196)  FER-020 (150)  TOR-001 (126)
           FER-022 (10, demanda 70)  FER-021 (10, demanda 50)  FER-042 (1)
    medio  FER-031 (5)  FER-030 (3)
    bajo   FER-041 (demanda 30)  CER-023 (26.38)  FER-040 (12)  FER-043 (5)

  Inversión de los que llevan compra, por categoría:
    Construcción 39,008 (3)  Herramientas Eléctricas 21,000 (2)
    Tornillería 6,300 (1)  Plomería 3,000 (1)  Jardinería 150 (1)
*/

const producto = (codigo, nombre, cambios) => ({
  producto_id: `id-${codigo}`,
  codigo,
  producto: nombre,
  categoria: "Construcción",
  origen: "sintetico",
  stock_actual: 10,
  tipo_stock: "simulado",
  demanda_predicha_7d: 2,
  demanda_predicha_30d: 8,
  stock_seguridad: 2,
  riesgo: "bajo",
  recomendacion_compra: 0,
  costo: 100,
  inversion_estimada: 0,
  ...cambios,
})

export const PRODUCTOS_DE_PRUEBA = [
  producto("CEM-001", "Cemento gris 42.5 kg", {
    origen: "sistema", tipo_stock: "real", stock_actual: 60,
    demanda_predicha_7d: 44.96, demanda_predicha_30d: 205.74, stock_seguridad: 50,
    riesgo: "alto", recomendacion_compra: 196, costo: 198, inversion_estimada: 38808,
  }),
  producto("TOR-001", "Tornillo para madera", {
    origen: "sistema", tipo_stock: "real", categoria: "Tornillería",
    demanda_predicha_30d: 105.16, riesgo: "alto", recomendacion_compra: 126, costo: 50, inversion_estimada: 6300,
  }),
  producto("FER-020", "Codo PVC", {
    categoria: "Plomería", demanda_predicha_30d: 180, riesgo: "alto", recomendacion_compra: 150,
    costo: 20, inversion_estimada: 3000,
  }),
  producto("FER-021", "Tee PVC", {
    demanda_predicha_30d: 50, riesgo: "alto", recomendacion_compra: 10, costo: 10, inversion_estimada: 100,
  }),
  producto("FER-022", "Pegamento PVC", {
    demanda_predicha_30d: 70, riesgo: "alto", recomendacion_compra: 10, costo: 10, inversion_estimada: 100,
  }),
  producto("CER-023", "Candado de bronce", {
    origen: "sistema", tipo_stock: "real", categoria: "Cerrajería", demanda_predicha_30d: 26.38,
  }),
  producto("FER-030", "Sierra circular", {
    categoria: "Herramientas Eléctricas", demanda_predicha_30d: 1.5, riesgo: "medio",
    recomendacion_compra: 3, costo: 2000, inversion_estimada: 6000,
  }),
  producto("FER-031", "Rotomartillo", {
    categoria: "Herramientas Eléctricas", demanda_predicha_30d: 1.2, riesgo: "medio",
    recomendacion_compra: 5, costo: 3000, inversion_estimada: 15000,
  }),
  producto("FER-040", "Cerradura de pomo", { demanda_predicha_30d: 12 }),
  producto("FER-041", "Pala cuadrada", { demanda_predicha_30d: 30 }),
  producto("FER-042", "Machete", {
    categoria: "Jardinería", demanda_predicha_30d: 3, riesgo: "alto", recomendacion_compra: 1,
    costo: 150, inversion_estimada: 150,
  }),
  producto("FER-043", "Rastrillo", { demanda_predicha_30d: 5 }),
]

export const ORDEN_ESPERADO = [
  "CEM-001", "FER-020", "TOR-001", "FER-022", "FER-021", "FER-042",
  "FER-031", "FER-030",
  "FER-041", "CER-023", "FER-040", "FER-043",
]

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago"]
const UNIDADES = [2558, 2643, 2856, 2522, 2466, 2477, 2550, 2470]

export const proyeccionDePrueba = (cambios = {}) => ({
  version: 1,
  metadata: {
    modelo: "Random Forest",
    referencia: "Evaluado contra una media móvil de 28 días como referencia.",
    fecha_corte: "2026-08-31",
    periodo_historico: { desde: "2026-01-01", hasta: "2026-08-31" },
    proyeccion: { desde: "2026-09-01", hasta: "2026-09-30" },
    horizontes_dias: [7, 30],
    productos: 50,
    productos_sistema: 9,
    productos_simulados: 41,
    escenario: "academico",
    aclaracion:
      "Proyección basada en un escenario académico de 50 productos: 9 del sistema y 41 simulados para análisis. Las ventas históricas son simuladas.",
  },
  resumen: {
    demanda_total_7d: 570.09,
    demanda_total_30d: 2470.87,
    productos_riesgo_alto: 28,
    productos_riesgo_medio: 6,
    productos_riesgo_bajo: 16,
    productos_con_compra: 34,
    unidades_recomendadas: 1286,
    inversion_estimada: 119380.6,
  },
  serie_mensual: [
    ...MESES.map((etiqueta, i) => ({
      mes: `2026-0${i + 1}`,
      etiqueta,
      unidades: UNIDADES[i],
      tipo: "historico",
    })),
    { mes: "2026-09", etiqueta: "sep", unidades: 2470.87, tipo: "proyeccion" },
  ],
  productos: PRODUCTOS_DE_PRUEBA,
  ...cambios,
})

/*
  Reemplaza fetch para que devuelva la proyección, o para que falle de la
  forma pedida. Devuelve el espía para que la prueba pueda revisar la ruta.
*/
export function servirProyeccion(vi, { datos = proyeccionDePrueba(), estado = 200, falla = null } = {}) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(() => {
    if (falla) return Promise.reject(falla)

    return Promise.resolve({
      ok: estado >= 200 && estado < 300,
      status: estado,
      json: () => Promise.resolve(datos),
    })
  })
}
