import { vi } from "vitest"

/*
  Doble de Supabase para las pruebas.

  Guarda las tablas en memoria y responde a las mismas cadenas de llamadas
  que usa la aplicación. Evita depender de la red y permite provocar casos
  que contra la base real serían difíciles de montar, como una cuenta
  válida que nadie invitó.
*/

function aplicarFiltros(filas, filtros) {
  return filas.filter((fila) =>
    filtros.every(([columna, valor]) => fila[columna] === valor)
  )
}

function proyectar(fila, columnas, tablas) {
  if (!columnas || columnas === "*") {
    return { ...fila }
  }

  const salida = {}

  for (const parte of columnas.split(",").map((c) => c.trim())) {
    const anidada = parte.match(/^(\w+)\((.*)\)$/)

    if (anidada) {
      const [, tablaHija, columnasHijas] = anidada
      const hijas = (tablas[tablaHija] || []).filter(
        (h) => h.usuario_id === fila.id
      )

      salida[tablaHija] = hijas.map((h) => proyectar(h, columnasHijas, tablas))
      continue
    }

    salida[parte] = fila[parte]
  }

  return salida
}

export function crearSupabaseFalso({
  tablas = {},
  cuentas = [],
  sesionInicial = null,
} = {}) {
  const datos = JSON.parse(JSON.stringify(tablas))
  let sesion = sesionInicial
  const suscriptores = []

  const consulta = (nombreTabla) => {
    const estado = {
      accion: "select",
      columnas: "*",
      filtros: [],
      registro: null,
    }

    const ejecutar = () => {
      const filas = datos[nombreTabla] || []

      if (estado.accion === "select") {
        return aplicarFiltros(filas, estado.filtros).map((f) =>
          proyectar(f, estado.columnas, datos)
        )
      }

      if (estado.accion === "insert") {
        const nuevos = (
          Array.isArray(estado.registro) ? estado.registro : [estado.registro]
        ).map((r, i) => ({ id: r.id || `nuevo-${Date.now()}-${i}`, ...r }))

        datos[nombreTabla] = [...filas, ...nuevos]

        return nuevos
      }

      if (estado.accion === "update") {
        const objetivo = aplicarFiltros(filas, estado.filtros)

        datos[nombreTabla] = filas.map((f) =>
          objetivo.includes(f) ? { ...f, ...estado.registro } : f
        )

        return objetivo.map((f) => ({ ...f, ...estado.registro }))
      }

      if (estado.accion === "delete") {
        const objetivo = aplicarFiltros(filas, estado.filtros)

        datos[nombreTabla] = filas.filter((f) => !objetivo.includes(f))

        return objetivo
      }

      return []
    }

    const constructor = {
      select(columnas) {
        estado.columnas = columnas || "*"
        if (estado.accion === "select") estado.accion = "select"
        return constructor
      },
      insert(registro) {
        estado.accion = "insert"
        estado.registro = registro
        return constructor
      },
      update(registro) {
        estado.accion = "update"
        estado.registro = registro
        return constructor
      },
      delete() {
        estado.accion = "delete"
        return constructor
      },
      eq(columna, valor) {
        estado.filtros.push([columna, valor])
        return constructor
      },
      order() {
        return constructor
      },
      maybeSingle() {
        const filas = ejecutar()
        return Promise.resolve({ data: filas[0] || null, error: null })
      },
      single() {
        const filas = ejecutar()
        return Promise.resolve(
          filas.length
            ? { data: filas[0], error: null }
            : { data: null, error: { message: "sin filas" } }
        )
      },
      then(resolver) {
        return Promise.resolve({ data: ejecutar(), error: null }).then(resolver)
      },
    }

    return constructor
  }

  const avisar = () => {
    suscriptores.forEach((cb) => cb("CAMBIO", sesion))
  }

  return {
    datos,

    from: vi.fn(consulta),

    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({ data: { session: sesion }, error: null })
      ),

      onAuthStateChange: vi.fn((cb) => {
        suscriptores.push(cb)

        return {
          data: {
            subscription: {
              unsubscribe: () => {
                const i = suscriptores.indexOf(cb)
                if (i >= 0) suscriptores.splice(i, 1)
              },
            },
          },
        }
      }),

      signInWithPassword: vi.fn(({ email, password }) => {
        const cuenta = cuentas.find(
          (c) => c.email === email && c.password === password
        )

        if (!cuenta) {
          return Promise.resolve({
            data: { user: null },
            error: { message: "Invalid login credentials" },
          })
        }

        sesion = { user: { id: cuenta.id, email: cuenta.email } }
        avisar()

        return Promise.resolve({ data: { user: sesion.user }, error: null })
      }),

      signOut: vi.fn(() => {
        sesion = null
        avisar()

        return Promise.resolve({ error: null })
      }),
    },
  }
}
