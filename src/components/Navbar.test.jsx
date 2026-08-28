import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"

import { AuthProvider, PERMISSIONS } from "../context/AuthContext"
import Navbar from "./Navbar"

function sembrarSesion({ permissions, role = "vendedor", name = "María Vendedora" }) {
  localStorage.setItem(
    "ferreteria_users",
    JSON.stringify([
      {
        id: "u1",
        name,
        username: "maria",
        passwordHash: "irrelevante",
        role,
        active: true,
        permissions,
        createdAt: new Date().toISOString(),
      },
    ])
  )

  localStorage.setItem("ferreteria_session_user_id", "u1")
}

function renderNavbar() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/dashboard" element={<Navbar />} />
          <Route path="/login" element={<h1>Pantalla de login</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  )
}

const pestañasVisibles = () =>
  screen
    .getAllByRole("link")
    .map((enlace) => enlace.getAttribute("href"))

describe("Navbar", () => {
  it("muestra el nombre del usuario en sesión", () => {
    sembrarSesion({ permissions: [PERMISSIONS.DASHBOARD] })
    renderNavbar()

    expect(screen.getByText("María Vendedora")).toBeInTheDocument()
  })

  it("el administrador ve todas las secciones", () => {
    sembrarSesion({ role: "admin", permissions: [], name: "Administrador" })
    renderNavbar()

    expect(pestañasVisibles()).toContain("/settings")
    expect(pestañasVisibles()).toContain("/pos")
    expect(pestañasVisibles()).toContain("/products")
  })

  it("el vendedor solo ve las secciones habilitadas", () => {
    sembrarSesion({
      permissions: [PERMISSIONS.POS, PERMISSIONS.SALES_HISTORY],
    })

    renderNavbar()

    const enlaces = pestañasVisibles()

    expect(enlaces).toContain("/pos")
    expect(enlaces).toContain("/sales-history")
    expect(enlaces).not.toContain("/settings")
    expect(enlaces).not.toContain("/products")
  })

  it("no muestra ninguna sección a un usuario sin permisos", () => {
    sembrarSesion({ permissions: [] })
    renderNavbar()

    expect(screen.queryAllByRole("link")).toHaveLength(0)
  })

  it("cerrar sesión lleva al login", () => {
    sembrarSesion({ permissions: [PERMISSIONS.DASHBOARD] })
    renderNavbar()

    fireEvent.click(screen.getByRole("button", { name: /cerrar sesión/i }))

    expect(screen.getByText("Pantalla de login")).toBeInTheDocument()
  })

  it("cerrar sesión borra la sesión guardada", () => {
    sembrarSesion({ permissions: [PERMISSIONS.DASHBOARD] })
    renderNavbar()

    fireEvent.click(screen.getByRole("button", { name: /cerrar sesión/i }))

    expect(localStorage.getItem("ferreteria_session_user_id")).toBeNull()
  })
})
