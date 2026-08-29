import { hashPassword } from "./password"
import { guardarJSON, borrar } from "./almacenamiento"

/*
  Datos ficticios para la demostración. No corresponden a ningún cliente
  real: la ferretería, los clientes y las ventas son inventados.
*/

export const CREDENCIALES_DEMO = {
  usuario: "demo",
  contrasena: "Demo2026",
}

export const CREDENCIALES_DEMO_ADMIN = {
  usuario: "demo-admin",
  contrasena: "Admin2026",
}

const EMPRESA_DEMO = {
  name: "Ferretería El Yunque",
  address: "Bulevar del Norte, San Pedro Sula",
  phone: "2555-0100",
  currency: "L",
  taxRate: 15,
}

const PRODUCTOS_DEMO = [
  { id: "d-p1", code: "CEM-001", name: "Cemento gris 42.5 kg", category: "Construcción", price: 245, costPrice: 198, stock: 60, minStock: 15, supplierId: "d-s1" },
  { id: "d-p2", code: "HER-001", name: "Martillo de uña 16 oz", category: "Herramientas", price: 185, costPrice: 120, stock: 24, minStock: 6, supplierId: "" },
  { id: "d-p3", code: "TOR-001", name: "Tornillo para madera 1\" (caja 100 u)", category: "Tornillería", price: 42, costPrice: 26, stock: 4, minStock: 10, supplierId: "" },
  { id: "d-p4", code: "PIN-001", name: "Pintura acrílica blanca 1 galón", category: "Pinturas", price: 385, costPrice: 280, stock: 18, minStock: 5, supplierId: "d-s2" },
  { id: "d-p5", code: "ELE-001", name: "Cable THHN #12 (rollo 100 m)", category: "Eléctrico", price: 1150, costPrice: 890, stock: 0, minStock: 4, supplierId: "" },
  { id: "d-p6", code: "HER-002", name: "Cinta métrica 5 m", category: "Herramientas", price: 78, costPrice: 45, stock: 31, minStock: 8, supplierId: "" },
  { id: "d-p7", code: "CER-001", name: "Candado de bronce 40 mm", category: "Cerrajería", price: 145, costPrice: 92, stock: 12, minStock: 5, supplierId: "" },
  { id: "d-p8", code: "PLO-001", name: "Tubo PVC 1/2\" x 6 m", category: "Plomería", price: 96, costPrice: 61, stock: 45, minStock: 12, supplierId: "d-s1" },
]

const PROVEEDORES_DEMO = [
  { id: "d-s1", name: "Distribuidora Ferretera del Valle", contact: "Carlos Mejía", phone: "2550-1234", email: "ventas@dfvalle.hn", notes: "Cemento, varilla y block" },
  { id: "d-s2", name: "Pinturas del Norte", contact: "Ana López", phone: "2558-7788", email: "", notes: "Pinturas y accesorios" },
]

const CLIENTES_DEMO = [
  { id: "d-c1", name: "Constructora Sula", rtn: "05019012345678", phone: "9988-1122", address: "Col. Trejo, San Pedro Sula", email: "compras@csula.hn" },
  { id: "d-c2", name: "Taller Mecánico Rivera", rtn: "05019087654321", phone: "9877-3344", address: "Barrio Guamilito", email: "" },
  { id: "d-c3", name: "Josué Andino", rtn: "", phone: "9755-6677", address: "Col. Fesitranh", email: "" },
]

function fechaRelativa(diasAtras) {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() - diasAtras)

  return fecha
}

function formatoCorto(fecha) {
  return fecha.toLocaleDateString("es-HN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatoISO(fecha) {
  return [
    fecha.getFullYear(),
    String(fecha.getMonth() + 1).padStart(2, "0"),
    String(fecha.getDate()).padStart(2, "0"),
  ].join("-")
}

function crearVenta({
  numero,
  diasAtras,
  cliente,
  items,
  formaPago,
  diasVencimiento,
  abonos = [],
}) {
  const fecha = fechaRelativa(diasAtras)

  const detalle = items.map(({ producto, cantidad }) => ({
    productId: producto.id,
    id: producto.id,
    code: producto.code,
    name: producto.name,
    category: producto.category,
    qty: cantidad,
    quantity: cantidad,
    price: producto.price,
    subtotal: producto.price * cantidad,
  }))

  const subtotal = detalle.reduce((suma, linea) => suma + linea.subtotal, 0)
  const isv = Math.round(subtotal * 0.15 * 100) / 100
  const total = Math.round((subtotal + isv) * 100) / 100
  const abonado = abonos.reduce((suma, abono) => suma + abono.amount, 0)

  const vencimiento = diasVencimiento
    ? formatoISO(fechaRelativa(diasAtras - diasVencimiento))
    : null

  return {
    id: `d-F-${numero}`,
    invoiceNumber: `FAC-0${numero}`,
    date: formatoCorto(fecha),
    timestamp: fecha.getTime(),
    isoDate: fecha.toISOString(),
    clientId: cliente?.id || null,
    clientName: cliente?.name || "Consumidor Final",
    customerName: cliente?.name || "Consumidor Final",
    customer: cliente?.name || "Consumidor Final",
    rtn: cliente?.rtn || "",
    items: detalle,
    subtotal,
    tax: isv,
    taxRate: 15,
    total,
    paymentType: formaPago,
    type: formaPago,
    dueDate: vencimiento,
    status:
      formaPago === "credito" && total - abonado > 0.005
        ? "pendiente"
        : "pagada",
    payments: abonos,
    fiscal: null,
    note: "",
    company: EMPRESA_DEMO,
  }
}

function construirVentasDemo() {
  const [cemento, martillo, , pintura, , cinta, candado, tubo] = PRODUCTOS_DEMO

  return [
    crearVenta({
      numero: 1201,
      diasAtras: 0,
      items: [
        { producto: martillo, cantidad: 1 },
        { producto: cinta, cantidad: 2 },
      ],
      formaPago: "contado",
    }),
    crearVenta({
      numero: 1202,
      diasAtras: 0,
      cliente: CLIENTES_DEMO[2],
      items: [{ producto: candado, cantidad: 3 }],
      formaPago: "contado",
    }),
    crearVenta({
      numero: 1203,
      diasAtras: 3,
      cliente: CLIENTES_DEMO[0],
      items: [
        { producto: cemento, cantidad: 40 },
        { producto: tubo, cantidad: 12 },
      ],
      formaPago: "credito",
      diasVencimiento: -27,
      abonos: [
        {
          id: "d-ab1",
          amount: 4000,
          date: formatoCorto(fechaRelativa(1)),
          isoDate: fechaRelativa(1).toISOString(),
          timestamp: fechaRelativa(1).getTime(),
          note: "Efectivo",
        },
      ],
    }),
    crearVenta({
      numero: 1204,
      diasAtras: 12,
      cliente: CLIENTES_DEMO[1],
      items: [{ producto: pintura, cantidad: 4 }],
      formaPago: "credito",
      diasVencimiento: -18,
    }),
    crearVenta({
      numero: 1205,
      diasAtras: 40,
      cliente: CLIENTES_DEMO[0],
      items: [{ producto: cemento, cantidad: 20 }],
      formaPago: "credito",
      diasVencimiento: -10,
    }),
  ]
}

function construirCotizacionesDemo() {
  const [cemento, , , pintura] = PRODUCTOS_DEMO
  const hoy = new Date()

  const armar = (numero, cliente, items, diasVigencia) => {
    const detalle = items.map(({ producto, cantidad }) => ({
      productId: producto.id,
      id: producto.id,
      code: producto.code,
      name: producto.name,
      category: producto.category,
      price: producto.price,
      qty: cantidad,
      quantity: cantidad,
      subtotal: producto.price * cantidad,
    }))

    const subtotal = detalle.reduce((s, l) => s + l.subtotal, 0)
    const isv = Math.round(subtotal * 0.15 * 100) / 100

    const vence = new Date()
    vence.setDate(vence.getDate() + diasVigencia)

    return {
      id: `d-Q-${numero}`,
      quoteNumber: `COT-0${numero}`,
      date: formatoCorto(hoy),
      timestamp: hoy.getTime(),
      clientId: cliente.id,
      clientName: cliente.name,
      clientPhone: cliente.phone,
      clientAddress: cliente.address,
      rtn: cliente.rtn,
      validity: formatoISO(vence),
      notes: "",
      includeTax: true,
      taxRate: 15,
      items: detalle,
      subtotal,
      tax: isv,
      total: Math.round((subtotal + isv) * 100) / 100,
      company: EMPRESA_DEMO,
    }
  }

  return [
    armar(2101, CLIENTES_DEMO[0], [{ producto: cemento, cantidad: 25 }], 12),
    armar(2102, CLIENTES_DEMO[1], [{ producto: pintura, cantidad: 6 }], -4),
  ]
}

function construirUsuariosDemo() {
  const ahora = new Date().toISOString()

  return [
    {
      id: "d-u-admin",
      name: "Administrador de la demo",
      username: CREDENCIALES_DEMO_ADMIN.usuario,
      passwordHash: hashPassword(CREDENCIALES_DEMO_ADMIN.contrasena),
      role: "admin",
      active: true,
      permissions: [
        "dashboard", "pos", "quotes", "products",
        "clients", "suppliers", "sales-history", "settings",
      ],
      createdAt: ahora,
    },
    {
      id: "d-u-vendedor",
      name: "Vendedor de mostrador",
      username: CREDENCIALES_DEMO.usuario,
      passwordHash: hashPassword(CREDENCIALES_DEMO.contrasena),
      role: "vendedor",
      active: true,
      // A propósito sin inventario ni configuración: así se ve el
      // control de acceso funcionando.
      permissions: ["dashboard", "pos", "quotes", "clients", "sales-history"],
      createdAt: ahora,
    },
  ]
}

export function sembrarDatosDemo() {
  const ventas = construirVentasDemo()

  guardarJSON("ferreteria_users", construirUsuariosDemo())
  guardarJSON("company", EMPRESA_DEMO)
  guardarJSON("products", PRODUCTOS_DEMO)
  guardarJSON("suppliers", PROVEEDORES_DEMO)
  guardarJSON("clients", CLIENTES_DEMO)
  guardarJSON("sales", ventas)
  guardarJSON("quotes", construirCotizacionesDemo())
  guardarJSON("nextQuoteNumber", 2103)
  guardarJSON("counters", { invoice: 1206, quote: 2103 })

  borrar("ferreteria_session_user_id")

  return {
    productos: PRODUCTOS_DEMO.length,
    clientes: CLIENTES_DEMO.length,
    ventas: ventas.length,
    cotizaciones: 2,
  }
}
