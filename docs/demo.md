# Acceso demo y recorrido guiado

Código de verificación: `LEARN-CAP-50768C03`

Recorrido de **5 minutos** para probar el sistema sin ayuda. Los datos son
ficticios: la ferretería, los clientes y las ventas son inventados, y no
corresponden a ningún cliente real.

---

## Credenciales

| Cuenta | Usuario | Contraseña | Para qué sirve |
|---|---|---|---|
| Vendedor de mostrador | `demo` | `Demo2026` | Ver el sistema con permisos limitados |
| Administrador | `demo-admin` | `Admin2026` | Ver el sistema completo |

Las dos se crean al abrir el paso 1. No son credenciales de ningún cliente.

---

## Los 4 pasos

### Paso 1 · Preparar la demostración

**URL:** https://www.oviedoarnold.lat/demo

Pulse **«Preparar la demostración»**.

*Qué debe observar:* un aviso verde confirmando que se cargaron **8 productos,
3 clientes, 5 ventas y 2 cotizaciones**, y debajo las dos cuentas con sus
contraseñas. Los datos quedan solo en este navegador.

---

### Paso 2 · Entrar como vendedor

**URL:** https://www.oviedoarnold.lat/login

Entre con `demo` / `Demo2026`.

*Qué debe observar:*

- El panel muestra las ventas del día, el **saldo por cobrar** (unos L 16.000)
  y los productos con existencias bajas o agotadas.
- En el menú superior hay **solo cinco secciones**: Dashboard, Facturar,
  Cotizar, Clientes e Historial. **No aparecen Inventario, Proveedores ni
  Configuración**, porque este usuario no las tiene habilitadas.
- **Compruebe el control de acceso:** escriba a mano
  `https://www.oviedoarnold.lat/products` en la barra de direcciones. El
  sistema **no lo deja entrar** y lo devuelve al panel. Ocultar el botón no
  es lo único que hace: cada ruta verifica el permiso.

---

### Paso 3 · Facturar una venta

**URL:** https://www.oviedoarnold.lat/pos

Busque un producto, pulse **«Agregar»** y observe el resumen de la derecha.

*Qué debe observar:*

- El subtotal, el ISV del 15 % y el total se calculan al instante.
- Junto a cada producto, las existencias **bajan** conforme agrega unidades:
  el sistema descuenta lo que ya está en el carrito.
- Intente agregar más unidades de las que hay: aparece un aviso indicando
  cuántas quedan disponibles.
- Puede elegir **Contado** o **Crédito**. Al elegir crédito, el sistema exige
  seleccionar un cliente registrado y una fecha de vencimiento.

---

### Paso 4 · Registrar un abono

**URL:** https://www.oviedoarnold.lat/sales-history

Busque la factura **FAC-01203** (Constructora Sula) y pulse **«Abonar»**.

*Qué debe observar:*

- La lista distingue las ventas de **Contado** de las de **Crédito**, y marca
  las que están **Pendiente**, **Vencida** o **Cancelada**.
- En las facturas a crédito con saldo aparece **«Abonado»** y **«Resta»**.
  FAC-01203 ya tiene un abono parcial de L 4.000.
- Al abrir el modal verá el total, lo abonado y el saldo. Pulse **«Pagar el
  saldo completo»** y luego **«Registrar abono»**.
- La factura pasa a **Cancelada**, el botón «Abonar» desaparece y el
  **saldo por cobrar del encabezado baja**.
- Si intenta abonar más que el saldo, el sistema lo rechaza.

---

## Si quiere ver el resto del sistema

Cierre sesión y entre con `demo-admin` / `Admin2026`. Con esa cuenta aparecen
las tres secciones que faltaban:

- **Inventario** — productos con alerta de existencias bajas y agotadas
- **Proveedores** — directorio ligado a los productos
- **Configuración** — usuarios con permisos por sección, y los datos fiscales
  (CAI, rango autorizado y fecha límite de emisión) con aviso cuando el rango
  está por agotarse o venció

---

## Volver a empezar

Repita el paso 1: vuelve a cargar los datos de ejemplo desde cero.

## Nota sobre dónde viven los datos

Todo se guarda en el navegador, así que cada persona que abra la demostración
trabaja sobre su propia copia y nada de lo que haga afecta a otro. Esa misma
característica es la limitación que documenta el
[ADR-1](adr/adr-001-postgresql-multiempresa.md): mientras los datos no estén
en una base compartida, dos cajas no ven el mismo inventario.
