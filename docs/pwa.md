# PWA y funcionamiento sin conexión

Código de verificación: `LEARN-CAP-50768C03`

## Datos exactos

| Dato | Valor |
|---|---|
| Ruta del service worker | `public/sw.js` → servido en `/sw.js` |
| Nombre del caché en `caches.open()` | `ferreteria-v1` |
| Manifest | `public/manifest.webmanifest` → servido en `/manifest.webmanifest` |
| `start_url` | `/` |
| `scope` | `/` |
| `display` | `standalone` |
| Iconos | 192×192, 512×512 y 512×512 maskable |
| Registro | `src/registrarServiceWorker.js`, llamado desde `src/main.jsx` |

## Estrategia principal

**Stale-while-revalidate** sobre los archivos propios del sitio.

Se responde de inmediato con lo que hay en caché y en segundo plano se descarga la
versión nueva para el próximo arranque. En un mostrador importa más abrir rápido que
tener el último byte: el cajero necesita cobrar, no la versión más reciente del CSS.

La navegación tiene un caso aparte: siempre resuelve a `/index.html`, porque la
aplicación es de una sola página y el enrutado ocurre en el navegador. Si no hay red
ni copia en caché, se sirve `/offline.html`.

## Qué funciona sin Internet

- **Abrir la aplicación completa.** El HTML, el JavaScript, los estilos y los iconos
  están en caché.
- **Facturar, cotizar y consultar el inventario.** Los datos del negocio viven en
  `localStorage`, que no necesita red.
- **Registrar abonos y ver saldos.**
- **Iniciar sesión.** Los usuarios y sus permisos también están en el navegador.

## Qué no funciona sin Internet, y por qué se puso ahí la frontera

- **Las tipografías de Google.** Se cargan desde `fonts.googleapis.com`. Sin red el
  navegador cae en la tipografía de respaldo declarada en cada familia. Se decidió
  no empaquetarlas para no sumar cientos de kilobytes al primer arranque, que es
  justo cuando el cajero está esperando.
- **La primera visita.** Un equipo que nunca abrió el sistema no tiene nada en caché.
  El service worker se instala en la primera carga con red.
- **Sincronizar entre equipos.** Hoy cada navegador guarda sus propios datos. Dos
  cajas no comparten inventario ni ven las ventas de la otra. Esta es la limitación
  que resuelve el [ADR-1](adr/adr-001-postgresql-multiempresa.md) al mover los datos
  a PostgreSQL, conservando `localStorage` como caché con cola de sincronización.

La frontera está donde está porque **cobrar no puede depender del Internet**, pero
compartir datos entre equipos sí. Un mostrador desconectado tiene que poder facturar;
que esa factura tarde unos minutos en aparecer en la computadora del dueño es
aceptable.

## Verificación pendiente

La activación del service worker **no se pudo confirmar en Chrome headless**: el
registro resuelve correctamente pero el navegador no persiste la instalación ni
crea el caché en ese modo. Lo verificado hasta ahora:

- `sw.js` se sirve con `Content-Type: text/javascript` y sintaxis válida
- El manifest se sirve y parsea, con los tres iconos accesibles
- El código de registro está en el bundle de producción y se ejecuta
- `offline.html` se sirve correctamente

**Queda confirmar en un navegador real** que el service worker se instala, que el
caché `ferreteria-v1` se crea y que la aplicación abre sin conexión. Esa comprobación
coincide con la evidencia que pide el requisito 12: la PWA instalada en un teléfono
real.
