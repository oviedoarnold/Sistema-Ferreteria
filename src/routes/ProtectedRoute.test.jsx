import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"

import { AuthProvider } from "../context/AuthContext"
import { PERMISSIONS } from "../context/permissions"
import ProtectedRoute from "./ProtectedRoute"

const Pantalla = ({ nombre }) => <h1>{nombre}</h1>

function renderEnRuta(rutaInicial, permisoRequerido = null) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[rutaInicial]}>
        <Routes>
          <Route path="/login" element={<Pantalla nombre="Pantalla de login" />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute permission={PERMISSIONS.DASHBOARD}>
                <Pantalla nombre="Dashboard" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pos"
            element={
              <ProtectedRoute permission={PERMISSIONS.POS}>
                <Pantalla nombre="Facturar" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute permission={permisoRequerido || PERMISSIONS.SETTINGS}>
                <Pantalla nombre="Configuración" />
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  )
}

function sembrarUsuario({ permissions, active = true, role = "vendedor" }) {
  localStorage.setItem(
    "ferreteria_users",
    JSON.stringify([
      {
        id: "u1",
        name: "Usuario Prueba",
        username: "prueba",
        passwordHash: "irrelevante",
        role,
        active,
        permissions,
        createdAt: new Date().toISOString(),
      },
    ])
  )

  localStorage.setItem("ferreteria_session_user_id", "u1")
}

describe("ProtectedRoute sin sesión", () => {
  it("manda al login", () => {
    renderEnRuta("/dashboard")
    expect(screen.getByText("Pantalla de login")).toBeInTheDocument()
  })

  it("no filtra el contenido protegido", () => {
    renderEnRuta("/dashboard")
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument()
  })
})

describe("ProtectedRoute con sesión", () => {
  it("deja pasar cuando el usuario tiene el permiso", () => {
    sembrarUsuario({ permissions: [PERMISSIONS.DASHBOARD] })
    renderEnRuta("/dashboard")

    expect(screen.getByText("Dashboard")).toBeInTheDocument()
  })

  it("desvía a la primera página habilitada cuando falta el permiso", () => {
    sembrarUsuario({ permissions: [PERMISSIONS.POS] })
    renderEnRuta("/settings")

    expect(screen.getByText("Facturar")).toBeInTheDocument()
    expect(screen.queryByText("Configuración")).not.toBeInTheDocument()
  })

  it("el administrador entra a todo", () => {
    sembrarUsuario({ role: "admin", permissions: [] })
    renderEnRuta("/settings")

    expect(screen.getByText("Configuración")).toBeInTheDocument()
  })

  it("muestra la pantalla de sin acceso cuando no tiene ninguna página", () => {
    sembrarUsuario({ permissions: [] })
    renderEnRuta("/dashboard")

    expect(screen.getByText("Sin acceso")).toBeInTheDocument()
  })

  it("un usuario desactivado va al login", () => {
    sembrarUsuario({ permissions: [PERMISSIONS.DASHBOARD], active: false })
    renderEnRuta("/dashboard")

    expect(screen.getByText("Pantalla de login")).toBeInTheDocument()
  })
})
