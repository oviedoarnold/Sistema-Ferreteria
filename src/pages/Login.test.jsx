import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"

import { AuthProvider } from "../context/AuthContext"
import Login from "./Login"

function renderLogin() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<h1>Dashboard</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  )
}

const escribirCredenciales = (usuario, clave) => {
  fireEvent.change(screen.getByLabelText(/usuario/i), {
    target: { value: usuario },
  })

  fireEvent.change(screen.getByLabelText(/^contraseña$/i), {
    target: { value: clave },
  })
}

const enviar = () =>
  fireEvent.click(screen.getByRole("button", { name: /ingresar/i }))

describe("Login", () => {
  it("muestra el formulario", () => {
    renderLogin()

    expect(screen.getByLabelText(/usuario/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^contraseña$/i)).toBeInTheDocument()
  })

  it("entra al panel con las credenciales correctas", () => {
    renderLogin()
    escribirCredenciales("admin", "1234")
    enviar()

    expect(screen.getByText("Dashboard")).toBeInTheDocument()
  })

  it("avisa cuando las credenciales son incorrectas", () => {
    renderLogin()
    escribirCredenciales("admin", "equivocada")
    enviar()

    expect(screen.getByText(/incorrect/i)).toBeInTheDocument()
  })

  it("no deja pasar al panel con la clave equivocada", () => {
    renderLogin()
    escribirCredenciales("admin", "equivocada")
    enviar()

    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument()
  })

  it("la contraseña se oculta por defecto", () => {
    renderLogin()
    expect(screen.getByLabelText(/^contraseña$/i)).toHaveAttribute(
      "type",
      "password"
    )
  })

  it("el botón del ojo revela la contraseña", () => {
    renderLogin()

    fireEvent.click(
      screen.getByRole("button", { name: /mostrar u ocultar/i })
    )

    expect(screen.getByLabelText(/^contraseña$/i)).toHaveAttribute("type", "text")
  })
})
