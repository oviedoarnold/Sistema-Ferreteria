import { describe, it, expect } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"

import { AuthProvider } from "../context/AuthContext"
import ProductProvider from "../context/ProductContext"
import SalesProvider from "../context/SalesContext"
import Settings from "./Settings"

const EMPRESA = {
  name: "Ferretería Isaac",
  address: "San Pedro Sula",
  phone: "9709-0121",
  currency: "L",
  taxRate: 15,
}

const FISCAL_COMPLETO = {
  rtn: "08019012345678",
  cai: "A1B2C3-D4E5F6-A7B8C9-D1E2F3-A4B5C6-D7",
  establecimiento: "000",
  puntoEmision: "001",
  tipoDocumento: "01",
  rangoDesde: 1,
  rangoHasta: 9999,
  fechaLimiteEmision: "2027-12-31",
}

function renderSettings({ empresa = EMPRESA, correlativo = 1000 } = {}) {
  localStorage.setItem("company", JSON.stringify(empresa))
  localStorage.setItem("products", JSON.stringify([]))
  localStorage.setItem("sales", JSON.stringify([]))
  localStorage.setItem(
    "counters",
    JSON.stringify({ invoice: correlativo, quote: 2000 })
  )

  localStorage.setItem(
    "ferreteria_users",
    JSON.stringify([
      {
        id: "admin-inicial",
        name: "Administrador",
        username: "admin",
        passwordHash: "irrelevante",
        role: "admin",
        active: true,
        permissions: [],
        createdAt: new Date().toISOString(),
      },
    ])
  )

  localStorage.setItem("ferreteria_session_user_id", "admin-inicial")

  return render(
    <AuthProvider>
      <ProductProvider>
        <SalesProvider>
          <Settings />
        </SalesProvider>
      </ProductProvider>
    </AuthProvider>
  )
}

const campo = (nombre) => document.querySelector(`[name="${nombre}"]`)

const escribir = (nombre, valor) =>
  fireEvent.change(campo(nombre), { target: { value: valor } })

describe("Settings: datos de la ferretería", () => {
  it("carga los datos guardados en el formulario", () => {
    renderSettings()

    expect(campo("name")).toHaveValue("Ferretería Isaac")
    expect(campo("address")).toHaveValue("San Pedro Sula")
    expect(campo("phone")).toHaveValue("9709-0121")
  })

  it("carga la tasa de ISV", () => {
    renderSettings()
    expect(campo("taxRate")).toHaveValue(15)
  })

  it("permite editar el nombre", () => {
    renderSettings()
    escribir("name", "Ferretería Nueva")

    expect(campo("name")).toHaveValue("Ferretería Nueva")
  })

  it("deshacer cambios devuelve los valores guardados", () => {
    renderSettings()
    escribir("name", "Cambio temporal")

    fireEvent.click(screen.getByRole("button", { name: /deshacer/i }))

    expect(campo("name")).toHaveValue("Ferretería Isaac")
  })
})

describe("Settings: datos fiscales", () => {
  it("avisa cuando no hay CAI configurado", () => {
    renderSettings()

    expect(screen.getByText(/sin datos fiscales/i)).toBeInTheDocument()
  })

  it("muestra los campos fiscales vacíos al inicio", () => {
    renderSettings()

    expect(campo("cai")).toHaveValue("")
    expect(campo("rtn")).toHaveValue("")
  })

  it("carga los datos fiscales guardados", () => {
    renderSettings({ empresa: { ...EMPRESA, fiscal: FISCAL_COMPLETO } })

    expect(campo("cai")).toHaveValue(FISCAL_COMPLETO.cai)
    expect(campo("rtn")).toHaveValue(FISCAL_COMPLETO.rtn)
  })

  it("informa cuántas facturas quedan del rango", () => {
    renderSettings({
      empresa: { ...EMPRESA, fiscal: FISCAL_COMPLETO },
      correlativo: 1000,
    })

    expect(screen.getByText(/quedan 8999 facturas/i)).toBeInTheDocument()
  })

  it("avisa cuando el rango está por agotarse", () => {
    renderSettings({
      empresa: { ...EMPRESA, fiscal: FISCAL_COMPLETO },
      correlativo: 9980,
    })

    expect(screen.getByText(/conviene tramitar/i)).toBeInTheDocument()
  })

  it("avisa cuando el rango ya se agotó", () => {
    renderSettings({
      empresa: { ...EMPRESA, fiscal: FISCAL_COMPLETO },
      correlativo: 10500,
    })

    expect(screen.getByText(/se agotó el rango/i)).toBeInTheDocument()
  })

  it("avisa cuando el CAI está vencido", () => {
    renderSettings({
      empresa: {
        ...EMPRESA,
        fiscal: { ...FISCAL_COMPLETO, fechaLimiteEmision: "2020-01-01" },
      },
    })

    expect(screen.getByText(/venció el/i)).toBeInTheDocument()
  })

  it("actualiza el aviso al escribir los datos fiscales", () => {
    renderSettings()

    escribir("cai", "A1B2C3-D4E5F6")
    escribir("rangoDesde", "1")
    escribir("rangoHasta", "5000")
    escribir("fechaLimiteEmision", "2027-06-30")

    expect(screen.getByText(/rango vigente/i)).toBeInTheDocument()
  })

  it("recuerda confirmar la normativa con un contador", () => {
    renderSettings()

    expect(screen.getByText(/contador/i)).toBeInTheDocument()
  })
})

describe("Settings: usuarios", () => {
  it("lista los usuarios registrados", () => {
    renderSettings()
    expect(screen.getAllByText("Administrador").length).toBeGreaterThan(0)
  })

  it("abre el formulario de usuario nuevo", () => {
    renderSettings()

    fireEvent.click(screen.getByRole("button", { name: /nuevo usuario/i }))

    expect(
      screen.getByRole("heading", { name: /nuevo usuario/i })
    ).toBeInTheDocument()
  })

  it("el formulario ofrece elegir los permisos por sección", () => {
    renderSettings()

    fireEvent.click(screen.getByRole("button", { name: /nuevo usuario/i }))

    const modal = document.querySelector(".modal")

    expect(within(modal).getByText("Facturar")).toBeInTheDocument()
    expect(within(modal).getByText("Inventario")).toBeInTheDocument()
  })
})
