import { Link } from "react-router-dom"

import "../styles/landing.css"

const FEATURES = [
  {
    icon: "📦",
    tone: "ico-o",
    title: "Inventario al día",
    text: "Cataloga productos por categoría y precio, y detecta al instante lo que está bajo en stock o agotado antes de que un cliente te lo pida.",
  },
  {
    icon: "🧾",
    tone: "ico-b",
    title: "Facturación rápida",
    text: "Punto de venta pensado para el mostrador: busca, agrega al carrito y cobra en segundos, al contado o al crédito.",
  },
  {
    icon: "📄",
    tone: "ico-t",
    title: "Cotizaciones en PDF",
    text: "Arma una cotización con validez definida y expórtala en PDF con el formato de tu ferretería, lista para enviar al cliente.",
  },
  {
    icon: "👥",
    tone: "ico-p",
    title: "Clientes y RTN",
    text: "Guarda RTN, teléfono, correo y dirección de cada cliente para que se completen solos en facturas y cotizaciones.",
  },
  {
    icon: "💳",
    tone: "ico-a",
    title: "Control de crédito",
    text: "Lleva cuenta de lo que te deben. El panel te muestra el saldo por cobrar de las ventas a crédito sin que tengas que sacar cuentas.",
  },
  {
    icon: "🔐",
    tone: "ico-g",
    title: "Usuarios y permisos",
    text: "Crea usuarios con roles y decide qué puede ver o tocar cada quien. El cajero factura, el dueño ve los números.",
  },
]

const STEPS = [
  {
    n: "1",
    title: "Carga tu inventario",
    text: "Registra tus productos con precio, existencia y stock mínimo. Es el único paso que toma tiempo, y se hace una sola vez.",
  },
  {
    n: "2",
    title: "Vende y cotiza",
    text: "Tu equipo factura desde el punto de venta y genera cotizaciones en PDF. El inventario se descuenta solo.",
  },
  {
    n: "3",
    title: "Revisa los números",
    text: "El panel resume ventas del día y del mes, productos más vendidos, stock crítico y cuentas por cobrar.",
  },
]

function Landing() {
  return (
    <div className="landing">
      <nav className="lp-nav">
        <div className="wrap">
          <Link to="/" className="lp-brand">
            <span className="mark">🔧</span>
            <span>
              <b>Sistema Ferretería</b>
              <span>GESTIÓN DE MOSTRADOR</span>
            </span>
          </Link>

          <div className="lp-nav-links">
            <a href="#funciones">Funciones</a>
            <a href="#como-funciona">Cómo funciona</a>
            <Link to="/login" className="btn btn-primary">
              Iniciar sesión
            </Link>
          </div>
        </div>
      </nav>

      <header className="lp-hero">
        <div className="wrap">
          <div>
            <span className="lp-eyebrow">Hecho para ferreterías</span>

            <h1>
              Tu ferretería, <em>ordenada</em> de la bodega a la caja.
            </h1>

            <p className="lead">
              Inventario, facturación, cotizaciones y clientes en un solo lugar.
              Sin hojas de cálculo sueltas y sin adivinar qué te queda en bodega.
            </p>

            <div className="lp-cta-row">
              <Link to="/login" className="btn btn-primary btn-lg">
                Entrar al sistema
              </Link>
              <a href="#funciones" className="btn btn-secondary btn-lg">
                Ver funciones
              </a>
            </div>

            <p className="lp-note">
              Corre en tu navegador · Precios en lempiras · Formato RTN
            </p>
          </div>

          <div className="lp-mock" aria-hidden="true">
            <div className="lp-mock-bar">
              <i></i>
              <i></i>
              <i></i>
              <span>panel · hoy</span>
            </div>

            <div className="lp-mock-body">
              <div className="lp-stat o">
                <span className="k">Ventas hoy</span>
                <span className="v">L 18,450</span>
                <span className="d">Total del día</span>
              </div>
              <div className="lp-stat b">
                <span className="k">Ventas del mes</span>
                <span className="v">L 312,900</span>
                <span className="d">Mes actual</span>
              </div>
              <div className="lp-stat w">
                <span className="k">Stock bajo</span>
                <span className="v">7</span>
                <span className="d">productos</span>
              </div>
              <div className="lp-stat g">
                <span className="k">Por cobrar</span>
                <span className="v">L 24,100</span>
                <span className="d">ventas a crédito</span>
              </div>
            </div>

            <div className="lp-mock-foot">
              <div className="t">Ventas por mes</div>
              <div className="lp-bars">
                <i style={{ height: "38%" }}></i>
                <i style={{ height: "54%" }}></i>
                <i style={{ height: "45%" }}></i>
                <i style={{ height: "71%" }}></i>
                <i style={{ height: "86%" }}></i>
                <i style={{ height: "100%" }}></i>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="lp-features" id="funciones">
        <div className="wrap">
          <div className="lp-head">
            <span className="kicker">Funciones</span>
            <h2>Todo lo que se hace en el mostrador</h2>
            <p>
              Cada módulo resuelve una tarea concreta del día a día de una
              ferretería, sin funciones de más que nadie usa.
            </p>
          </div>

          <div className="lp-grid">
            {FEATURES.map((feature) => (
              <article className="lp-card" key={feature.title}>
                <div className={`ico ${feature.tone}`}>{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-steps" id="como-funciona">
        <div className="wrap">
          <div className="lp-head">
            <span className="kicker">Cómo funciona</span>
            <h2>Tres pasos y estás operando</h2>
            <p>
              No necesitas instalar nada ni contratar a alguien para que te lo
              configure.
            </p>
          </div>

          <div className="lp-grid">
            {STEPS.map((step) => (
              <div className="lp-step" key={step.n}>
                <span className="n">{step.n}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-cta">
        <div className="wrap">
          <h2>Empieza a ordenar tu ferretería hoy</h2>
          <p>
            Entra con tu usuario y encuentra el inventario, las ventas y los
            clientes donde deben estar.
          </p>
          <div className="lp-cta-row">
            <Link to="/login" className="btn btn-primary btn-lg">
              Iniciar sesión
            </Link>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="wrap">
          <div className="lp-brand">
            <span className="mark">🔧</span>
            <span>
              <b>Sistema Ferretería</b>
            </span>
          </div>
          <p>© {new Date().getFullYear()} Sistema Ferretería</p>
        </div>
      </footer>
    </div>
  )
}

export default Landing
