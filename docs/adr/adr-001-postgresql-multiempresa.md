# ADR-1: PostgreSQL multi-empresa con seguridad a nivel de fila

- **Fecha:** 2026-08-28
- **Estado:** Aceptada
- **Ruta:** `docs/adr/adr-001-postgresql-multiempresa.md`

## Contexto

El sistema nació para una sola ferretería y guarda todo en `localStorage`: productos,
clientes, ventas, cotizaciones y hasta los usuarios con sus permisos. Eso funcionó
para llegar a un producto usable, pero tiene tres consecuencias que ya nos alcanzaron:

1. **El portal privado no es privado.** Todos los datos viajan al navegador. Cualquiera
   abre las herramientas de desarrollo y los lee sin iniciar sesión, y también puede
   editarse los permisos.
2. **No hay forma de tener un segundo cliente.** El sistema asume una sola ferretería
   en todo el modelo de datos.
3. **Las contraseñas no están protegidas.** La función de hash es el `hashCode` de
   Java: 32 bits, trivial de colisionar. Sirve para una demo, no para guardar
   credenciales de empleados de un cliente real.

El producto se va a comercializar, así que la decisión no es solo académica.

Se evaluaron tres opciones:

| Opción | A favor | En contra |
|---|---|---|
| Seguir con `localStorage` | Cero trabajo, funciona sin Internet | Ninguno de los tres problemas se resuelve |
| SQL Server con backend propio | Control total del backend | Hosting con fricción, *row-level security* costoso de armar, más código que mantener |
| **PostgreSQL vía Supabase** | RLS nativo, autenticación con hashing serio, API JSON automática, HTTPS incluido | Dependencia de un proveedor |

## Decisión

Migrar a **PostgreSQL gestionado por Supabase**, con **`empresa_id` en todas las
tablas desde la primera migración** y políticas de *row-level security* que filtren
por esa columna.

La autenticación pasa a Supabase Auth. Los roles y permisos por sección se conservan
en tablas propias ligadas a `auth.users`, porque son lógica del negocio y no del
proveedor de identidad.

El inventario deja de ser un número mutable y pasa a ser un **libro de movimientos**:
cada entrada, salida, ajuste y devolución queda registrada, y el stock actual es la
suma.

## Consecuencias

**A favor**

- El portal privado se vuelve realmente privado: los datos no salen de la base sin
  una sesión válida, y la política se aplica en el motor, no en el frontend.
- Vender a una segunda ferretería deja de requerir un despliegue aparte.
- Las contraseñas quedan protegidas con hashing real, con recuperación y
  verificación por correo incluidas.
- El inventario se puede auditar: si el conteo físico no cuadra, hay rastro de
  quién lo movió y cuándo.
- Aparece un endpoint de salud en JSON, que el requisito 2 pide y hoy no existe.

**En contra**

- Dependencia de Supabase. Se mitiga en que por debajo es PostgreSQL estándar: los
  datos se exportan e importan a cualquier otro PostgreSQL. Lo único realmente atado
  es la autenticación, y aun eso es migrable.
- El frontend deja de ser síncrono. Los cuatro contextos pasan de leer `localStorage`
  al instante a esperar respuestas de red, con estados de carga y de error que hoy
  no existen.
- **Se pierde el funcionamiento sin Internet si no se hace nada más.** Hoy la
  aplicación funciona desconectada por accidente. Para una ferretería, que se caiga
  el Internet no puede significar que no se pueda cobrar.

## Qué se sacrificó, y por qué valió la pena para el cliente

**Se sacrificó la simplicidad del acceso síncrono a los datos.** Hoy leer el
inventario es una línea que devuelve el resultado de inmediato. Después será una
llamada asíncrona que puede fallar, tardar o volver vacía, y cada pantalla tendrá
que manejar esos tres casos. Eso encarece cada funcionalidad futura.

Valió la pena porque **lo que se compra a cambio es lo que hace vendible el
producto**: que los datos de un cliente no sean visibles para otro, que las
contraseñas de sus empleados estén realmente protegidas, y que el inventario tenga
un rastro auditable. Un sistema que guarda todo en el navegador puede demostrarse,
pero no se le puede cobrar a una ferretería que confía sus números y los datos de
sus clientes.

Para no sacrificar además el trabajo sin conexión —que en Honduras no es un lujo—
`localStorage` **no se elimina**: se convierte en caché con cola de sincronización.
El mostrador sigue vendiendo desconectado y sincroniza al volver la señal. Esa
decisión se toma ahora y no después, porque reconvertir una aplicación que asume
servidor siempre disponible en una que tolera estar desconectada es de las
reescrituras más caras que existen.
