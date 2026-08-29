import { useState } from "react"


import {
  sembrarDatosDemo,
  CREDENCIALES_DEMO,
  CREDENCIALES_DEMO_ADMIN,
} from "../utils/datosDemo"

function Credencial({ titulo, usuario, contrasena, detalle }) {
  return (
    <div
      style={{
        background: "var(--cream)",
        border: "1px solid var(--line-strong)",
        borderRadius: 10,
        padding: "13px 15px",
        textAlign: "left",
      }}
    >
      <b style={{ fontSize: 14.5 }}>{titulo}</b>

      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 14,
          marginTop: 7,
          lineHeight: 1.9,
        }}
      >
        <div>
          usuario: <b>{usuario}</b>
        </div>
        <div>
          contraseña: <b>{contrasena}</b>
        </div>
      </div>

      <p
        style={{
          margin: "8px 0 0",
          fontSize: 13,
          color: "var(--steel)",
        }}
      >
        {detalle}
      </p>
    </div>
  )
}

function Demo() {
  const [resumen, setResumen] = useState(null)

  const preparar = () => {
    setResumen(sembrarDatosDemo())
  }

  return (
    <div id="login-screen">
      <div
        className="login-card"
        style={{ maxWidth: 460 }}
      >
        <div style={{ fontSize: 34, marginBottom: 8 }}>🧰</div>

        <h2>Demostración guiada</h2>

        <p className="sub">
          Carga una ferretería de ejemplo con productos, clientes, ventas
          a crédito y cotizaciones, para probar el sistema sin capturar
          nada a mano.
        </p>

        {!resumen ? (
          <>
            <button
              type="button"
              className="btn btn-primary btn-lg btn-block"
              onClick={preparar}
            >
              Preparar la demostración
            </button>

            <p
              style={{
                fontSize: 12.5,
                color: "var(--steel)",
                marginTop: 14,
                lineHeight: 1.6,
              }}
            >
              Los datos son ficticios y se guardan solo en este navegador.
              No corresponden a ninguna ferretería real.
            </p>
          </>
        ) : (
          <>
            <div
              style={{
                background: "var(--teal-light)",
                color: "var(--teal)",
                borderRadius: 9,
                padding: "11px 14px",
                fontSize: 14,
                marginBottom: 16,
              }}
            >
              Listo: {resumen.productos} productos, {resumen.clientes}{" "}
              clientes, {resumen.ventas} ventas y {resumen.cotizaciones}{" "}
              cotizaciones.
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <Credencial
                titulo="Vendedor de mostrador"
                usuario={CREDENCIALES_DEMO.usuario}
                contrasena={CREDENCIALES_DEMO.contrasena}
                detalle="Sin acceso a Inventario, Proveedores ni Configuración: sirve para comprobar el control de permisos."
              />

              <Credencial
                titulo="Administrador"
                usuario={CREDENCIALES_DEMO_ADMIN.usuario}
                contrasena={CREDENCIALES_DEMO_ADMIN.contrasena}
                detalle="Acceso completo, incluida la administración de usuarios y los datos fiscales."
              />
            </div>

            {/*
              Enlace normal y no navegación interna: los contextos leen el
              almacenamiento al montarse, así que sin recargar seguirían
              trabajando con la lista de usuarios anterior.
            */}
            <a
              href="/login"
              className="btn btn-primary btn-lg btn-block"
            >
              Ir a iniciar sesión
            </a>
          </>
        )}
      </div>
    </div>
  )
}

export default Demo
