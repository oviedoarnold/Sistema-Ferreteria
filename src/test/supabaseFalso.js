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

/*
  Con qué columna apunta una tabla hija a su padre. Va explícito y no
  deducido del plural: "cotizaciones" quitándole la s da "cotizacione",
  y el detalle quedaba sin enlazar sin que nada avisara.
*/
const LLAVE_HACIA = {
  empresas: "empresa_id",
  usuarios: "usuario_id",
  productos: "producto_id",
  clientes: "cliente_id",
  proveedores: "proveedor_id",
  ventas: "venta_id",
  cotizaciones: "cotizacion_id",
}

function llaveHacia(tablaPadre) {
  const llave = LLAVE_HACIA[tablaPadre]

  if (!llave) {
    throw new Error(
      `El doble de Supabase no sabe con qué columna se enlaza ${tablaPadre}.`
    )
  }

  return llave
}

function proyectar(fila, columnas, tablas, tablaPadre) {
  const listaDeColumnas = (columnas || "*")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)

  const salida = listaDeColumnas.includes("*") ? { ...fila } : {}

  for (const parte of listaDeColumnas) {
    if (parte === "*") continue

    const anidada = parte.match(/^(\w+)\s*\(([\s\S]*)\)$/)

    if (anidada) {
      const [, tablaHija, columnasHijas] = anidada
      const llave = llaveHacia(tablaPadre)

      const hijas = (tablas[tablaHija] || []).filter(
        (h) => h[llave] === fila.id
      )

      salida[tablaHija] = hijas.map((h) =>
        proyectar(h, columnasHijas, tablas, tablaHija)
      )

      continue
    }

    salida[parte] = fila[parte]
  }

  return salida
}

/*
  Las vistas de la base se recalculan en cada consulta, igual que en
  PostgreSQL. Así una prueba que registra un movimiento ve el stock nuevo
  sin tener que actualizar dos lugares a mano.
*/
const VISTAS = {
  productos_con_stock: (datos) =>
    (datos.productos || []).map((producto) => ({
      ...producto,
      stock: (datos.movimientos_inventario || [])
        .filter((m) => m.producto_id === producto.id)
        .reduce((suma, m) => suma + Number(m.cantidad), 0),
    })),

  stock_actual: (datos) =>
    VISTAS.productos_con_stock(datos).map((p) => ({
      producto_id: p.id,
      empresa_id: p.empresa_id,
      codigo: p.codigo,
      nombre: p.nombre,
      stock_minimo: p.stock_minimo,
      stock: p.stock,
    })),
}

/*
  Los identificadores se numeran con un contador y no con la hora.

  Antes eran `nuevo-${Date.now()}-${i}`, y dos inserciones dentro del mismo
  milisegundo recibían el mismo id. Lo que se rompía no era la inserción
  sino la lectura posterior: quien buscaba el registro recién creado por su
  id encontraba el anterior, y una prueba de dos facturas seguidas comparaba
  la primera consigo misma. Pasaba solo en máquinas rápidas.
*/
let ultimoId = 0

const siguienteId = () => `fila-${++ultimoId}`

/*
  Columnas que la base rellena sola. El código de la aplicación no las
  envía porque el esquema las declara con default now(); sin esto llegan
  sin fecha y cualquier orden por fecha queda al azar.
*/
const COLUMNA_DE_FECHA = {
  ventas: "fecha",
  cotizaciones: "fecha",
  abonos: "fecha",
  movimientos_inventario: "fecha",
  productos: "creado_en",
  clientes: "creado_en",
  proveedores: "creado_en",
}

function valoresPorOmision(tabla) {
  const columna = COLUMNA_DE_FECHA[tabla]

  return columna ? { [columna]: new Date().toISOString() } : {}
}

export function crearSupabaseFalso({
  tablas = {},
  cuentas = [],
  sesionInicial = null,
  fallarEn = {},
} = {}) {
  const datos = JSON.parse(JSON.stringify(tablas))
  let sesion = sesionInicial
  const suscriptores = []

  /*
    Devuelve el error configurado para esa tabla, si lo hay. Acepta tanto
    { productos: error } como { productos: { insert: error } }, para poder
    romper solo una operacion.
  */
  const fallaDe = (nombreTabla, accion) => {
    const configurada = fallarEn[nombreTabla]

    if (!configurada) return null

    if (configurada.message || configurada.code) return configurada

    return configurada[accion] || null
  }

  /*
    0013 quitó el permiso de borrado sobre los documentos emitidos y puso
    las llaves foráneas del Kardex en RESTRICT. El doble lo reproduce para
    que una llamada a .delete() sobre estas tablas falle igual que en la
    base: si alguien vuelve a escribir un borrado desde la aplicación, la
    prueba lo detiene aquí en vez de descubrirlo en producción.
  */
  const SIN_BORRADO = ["ventas", "detalle_venta", "movimientos_inventario"]

  const borradoProhibido = (nombreTabla, objetivo) => {
    if (SIN_BORRADO.includes(nombreTabla)) {
      return {
        code: "42501",
        message: `permission denied for table ${nombreTabla}`,
      }
    }

    if (nombreTabla !== "productos") return null

    const conKardex = objetivo.some((producto) =>
      (datos.movimientos_inventario || []).some(
        (m) => m.producto_id === producto.id
      )
    )

    return conKardex
      ? {
          code: "23503",
          message:
            'update or delete on table "productos" violates foreign key ' +
            'constraint "movimientos_inventario_producto_id_fkey"',
        }
      : null
  }

  const consulta = (nombreTabla) => {
    const estado = {
      accion: "select",
      columnas: "*",
      filtros: [],
      registro: null,
      ordenarPor: null,
      tope: null,
    }

    const ejecutar = () => {
      const vista = VISTAS[nombreTabla]
      const filas = vista ? vista(datos) : datos[nombreTabla] || []

      if (estado.accion === "select") {
        const encontradas = aplicarFiltros(filas, estado.filtros).map((f) =>
          proyectar(f, estado.columnas, datos, nombreTabla)
        )

        if (estado.ordenarPor) {
          encontradas.sort((a, b) =>
            String(a[estado.ordenarPor]).localeCompare(String(b[estado.ordenarPor]))
          )
        }

        return estado.tope === null
          ? encontradas
          : encontradas.slice(0, estado.tope)
      }

      if (estado.accion === "insert") {
        const nuevos = (
          Array.isArray(estado.registro) ? estado.registro : [estado.registro]
        ).map((r) => ({
          id: r.id || siguienteId(),
          ...valoresPorOmision(nombreTabla),
          ...r,
        }))

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

    /*
      Las dos razones por las que una operación puede fallar antes de tocar
      los datos: el error que la prueba inyectó, y las protecciones que la
      base aplica por su cuenta.
    */
    const errorAntesDeEjecutar = () => {
      const inyectada = fallaDe(nombreTabla, estado.accion)

      if (inyectada) return inyectada

      if (estado.accion !== "delete") return null

      const vista = VISTAS[nombreTabla]
      const filas = vista ? vista(datos) : datos[nombreTabla] || []

      return borradoProhibido(
        nombreTabla,
        aplicarFiltros(filas, estado.filtros)
      )
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
      order(columna) {
        estado.ordenarPor = columna
        return constructor
      },
      limit(cantidad) {
        estado.tope = cantidad
        return constructor
      },
      /*
        fallarEn permite provocar el error que devolveria la base. Sin esto
        no habia forma de comprobar que la aplicacion avisa cuando algo
        falla, que es justo lo que el usuario ve cuando algo se rompe.
      */
      maybeSingle() {
        const falla = errorAntesDeEjecutar()
        if (falla) return Promise.resolve({ data: null, error: falla })

        const filas = ejecutar()
        return Promise.resolve({ data: filas[0] || null, error: null })
      },
      single() {
        const falla = errorAntesDeEjecutar()
        if (falla) return Promise.resolve({ data: null, error: falla })

        const filas = ejecutar()
        return Promise.resolve(
          filas.length
            ? { data: filas[0], error: null }
            : { data: null, error: { message: "sin filas" } }
        )
      },
      then(resolver) {
        const falla = errorAntesDeEjecutar()

        return Promise.resolve(
          falla ? { data: null, error: falla } : { data: ejecutar(), error: null }
        ).then(resolver)
      },
    }

    return constructor
  }

  const avisar = () => {
    suscriptores.forEach((cb) => cb("CAMBIO", sesion))
  }

  /*
    La numeración vive en la base, así que el doble la imita: entrega el
    número guardado y aparta el siguiente.
  */
  const siguienteCorrelativo = (tipo) => {
    const columna =
      tipo === "factura"
        ? "proximo_correlativo_factura"
        : "proximo_correlativo_cotizacion"

    const empresa = (datos.empresas || [])[0]

    if (!empresa) {
      return { data: null, error: { message: "sin empresa" } }
    }

    const numero = empresa[columna]

    empresa[columna] = numero + 1

    return { data: numero, error: null }
  }

  /*
    Reproduce crear_venta_atomica.

    El doble tiene que imitar el contrato completo —validaciones, códigos de
    error y efectos— porque desde que la venta es una sola llamada, esta
    función ES el comportamiento que las pruebas verifican. Un doble que
    solo devolviera un id haría pasar pruebas sin comprobar nada.

    Lo único que no puede reproducir es la concurrencia: el doble corre en
    un solo hilo. Esa parte se prueba contra PostgreSQL.
  */
  const errorDeVenta = (codigo, mensaje) => ({
    data: null,
    error: { code: codigo, message: mensaje },
  })

  const crearVentaAtomica = (a) => {
    const usuario = (datos.usuarios || []).find(
      (u) => u.auth_id === sesion?.user?.id && u.activo
    )

    if (!usuario) {
      return errorDeVenta("28000", "La sesión no corresponde a ningún usuario activo.")
    }

    const empresaId = usuario.empresa_id

    // La idempotencia manda sobre todo lo demás.
    if (a.p_clave_idempotencia) {
      const ya = (datos.ventas || []).find(
        (v) =>
          v.empresa_id === empresaId &&
          v.clave_idempotencia === a.p_clave_idempotencia
      )

      if (ya) return { data: ya.id, error: null }
    }

    const items = Array.isArray(a.p_items) ? a.p_items : []

    if (items.length === 0) {
      return errorDeVenta("P0001", "La venta debe contener al menos un producto.")
    }

    if (!["contado", "credito"].includes(a.p_forma_pago)) {
      return errorDeVenta("P0001", "Forma de pago no válida: " + a.p_forma_pago)
    }

    if (a.p_forma_pago === "credito" && !a.p_cliente_id) {
      return errorDeVenta(
        "P0001",
        "Para una venta a crédito debes seleccionar un cliente registrado."
      )
    }

    // Cantidades agrupadas por producto, igual que en la base.
    const porProducto = new Map()

    for (const item of items) {
      const cantidad = Number(item.cantidad)

      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        return errorDeVenta(
          "P0001",
          "La cantidad de los productos debe ser mayor que cero."
        )
      }

      porProducto.set(
        item.producto_id,
        (porProducto.get(item.producto_id) || 0) + cantidad
      )
    }

    for (const [productoId, cantidad] of porProducto) {
      const producto = (datos.productos || []).find(
        (p) => p.id === productoId && p.empresa_id === empresaId
      )

      if (!producto) {
        return errorDeVenta("P0002", "Uno de los productos ya no existe en el inventario.")
      }

      if (producto.activo === false) {
        return errorDeVenta("P0002", "El producto " + producto.nombre + " ya no está disponible.")
      }

      const stock = (datos.movimientos_inventario || [])
        .filter((m) => m.producto_id === productoId)
        .reduce((suma, m) => suma + Number(m.cantidad), 0)

      if (stock < cantidad) {
        return errorDeVenta(
          "P0003",
          "Stock insuficiente de " + producto.nombre + ". Solo hay " + stock + " unidades disponibles."
        )
      }
    }

    if (
      a.p_cliente_id &&
      !(datos.clientes || []).some(
        (c) => c.id === a.p_cliente_id && c.empresa_id === empresaId
      )
    ) {
      return errorDeVenta("P0002", "El cliente indicado no pertenece a esta ferretería.")
    }

    // Los importes los calcula la base, no quien llama.
    const subtotal = items.reduce(
      (suma, i) => suma + Number(i.cantidad) * Number(i.precio),
      0
    )
    const tasa = Number(a.p_tasa_isv) || 0
    const isv = Math.round(subtotal * (tasa / 100) * 100) / 100

    const { data: correlativo, error: errorCorrelativo } =
      siguienteCorrelativo("factura")

    if (errorCorrelativo) return { data: null, error: errorCorrelativo }

    const empresa = (datos.empresas || [])[0] || {}

    const conFiscal =
      String(empresa.cai || "").trim() &&
      Number(empresa.rango_hasta) > 0 &&
      empresa.fecha_limite_emision

    const pad = (v, n) => String(v).padStart(n, "0")

    const numero = conFiscal
      ? [
          pad(empresa.establecimiento || "000", 3),
          pad(empresa.punto_emision || "001", 3),
          pad(empresa.tipo_documento || "01", 2),
          pad(correlativo, 8),
        ].join("-")
      : "FAC-" + pad(correlativo, 5)

    const ventaId = siguienteId()

    datos.ventas = [
      ...(datos.ventas || []),
      {
        id: ventaId,
        empresa_id: empresaId,
        cliente_id: a.p_cliente_id || null,
        usuario_id: usuario.id,
        numero_factura: numero,
        correlativo,
        fecha: new Date().toISOString(),
        nombre_cliente: a.p_nombre_cliente || "Consumidor Final",
        rtn_comprador: a.p_rtn_comprador || "",
        subtotal,
        isv,
        tasa_isv: tasa,
        total: subtotal + isv,
        forma_pago: a.p_forma_pago,
        fecha_vencimiento:
          a.p_forma_pago === "credito" ? a.p_fecha_vencimiento || null : null,
        estado: a.p_forma_pago === "credito" ? "pendiente" : "pagada",
        cai_emision: empresa.cai || "",
        rango_desde_emision: empresa.rango_desde ?? null,
        rango_hasta_emision: empresa.rango_hasta ?? null,
        fecha_limite_emision_emision: empresa.fecha_limite_emision ?? null,
        nota: a.p_nota || "",
        clave_idempotencia: a.p_clave_idempotencia || null,
      },
    ]

    datos.detalle_venta = [
      ...(datos.detalle_venta || []),
      ...items.map((item) => {
        const producto = (datos.productos || []).find((p) => p.id === item.producto_id)

        return {
          id: siguienteId(),
          empresa_id: empresaId,
          venta_id: ventaId,
          producto_id: item.producto_id,
          nombre: producto?.nombre || "",
          codigo: producto?.codigo || "",
          cantidad: Number(item.cantidad),
          precio: Number(item.precio),
          subtotal: Number(item.cantidad) * Number(item.precio),
        }
      }),
    ]

    datos.movimientos_inventario = [
      ...(datos.movimientos_inventario || []),
      ...items.map((item) => ({
        id: siguienteId(),
        empresa_id: empresaId,
        producto_id: item.producto_id,
        usuario_id: usuario.id,
        venta_id: ventaId,
        tipo: "salida",
        cantidad: -Math.abs(Number(item.cantidad)),
        motivo: "Venta",
        fecha: new Date().toISOString(),
      })),
    ]

    return { data: ventaId, error: null }
  }


  /*
    Almacenamiento en memoria. Guarda las rutas subidas para poder
    comprobar que la imagen queda en la carpeta de su empresa, que es de
    donde sale el aislamiento entre ferreterías.
  */
  const archivos = new Map()

  const cubeta = (nombreCubeta) => ({
    upload: vi.fn((ruta, archivo) => {
      archivos.set(nombreCubeta + "/" + ruta, {
        tipo: archivo?.type || "",
        tamano: archivo?.size || 0,
      })

      return Promise.resolve({ data: { path: ruta }, error: null })
    }),

    remove: vi.fn((rutas) => {
      rutas.forEach((r) => archivos.delete(nombreCubeta + "/" + r))

      return Promise.resolve({ data: [], error: null })
    }),

    getPublicUrl: vi.fn((ruta) => ({
      data: {
        publicUrl:
          "https://ejemplo.supabase.co/storage/v1/object/public/" +
          nombreCubeta +
          "/" +
          ruta,
      },
    })),
  })

  return {
    datos,
    archivos,

    storage: { from: vi.fn(cubeta) },

    from: vi.fn(consulta),

    rpc: vi.fn((nombre, argumentos = {}) => {
      if (nombre === "siguiente_correlativo") {
        return Promise.resolve(siguienteCorrelativo(argumentos.p_tipo))
      }

      if (nombre === "crear_venta_atomica") {
        return Promise.resolve(crearVentaAtomica(argumentos))
      }

      return Promise.resolve({
        data: null,
        error: { message: "función desconocida: " + nombre },
      })
    }),

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
