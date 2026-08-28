import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

import { AuthProvider } from "../context/AuthContext"
import NotFound from "./NotFound"

function renderNotFound({ conSesion = false } = {}) {
  if (conSesion) {
    localStorage.setItem(
      "ferreteria_users",
      JSON.stringify([
        {
          id: "u1",
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

    localStorage.setItem("ferreteria_session_user_id", "u1")
  }

  return render(
    <AuthProvider>
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    </AuthProvider>
  )
}

describe("NotFound", () => {
  it("muestra el código 404", () => {
    renderNotFound()
    expect(screen.getByText("404")).toBeInTheDocument()
  })

  it("explica qué pasó sin tecnicismos", () => {
    renderNotFound()
    expect(screen.getByText(/esta página no existe/i)).toBeInTheDocument()
  })

  it("sin sesión ofrece volver al inicio", () => {
    renderNotFound()

    const enlace = screen.getByRole("link", { name: /ir al inicio/i })

    expect(enlace).toHaveAttribute("href", "/")
  })

  it("con sesión ofrece volver al panel", () => {
    renderNotFound({ conSesion: true })

    const enlace = screen.getByRole("link", { name: /volver al panel/i })

    expect(enlace).toHaveAttribute("href", "/dashboard")
  })
})
