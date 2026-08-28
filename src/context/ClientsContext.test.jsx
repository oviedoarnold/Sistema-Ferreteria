import { describe, it, expect } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useContext } from "react"

import ClientsProvider from "./ClientsContext"
import { ClientsContext } from "./contexts"

const renderClients = () =>
  renderHook(() => useContext(ClientsContext), {
    wrapper: ClientsProvider,
  })

const clientePrueba = {
  name: "  Ferremax  ",
  rtn: " 0801199912345 ",
  phone: " 9999-0000 ",
  address: " San Pedro Sula ",
  email: " ventas@ferremax.hn ",
}

describe("ClientsContext", () => {
  it("arranca sin clientes cuando el almacenamiento está vacío", () => {
    const { result } = renderClients()
    expect(result.current.clients).toEqual([])
  })

  it("lee los clientes guardados previamente", () => {
    localStorage.setItem(
      "clients",
      JSON.stringify([{ id: "c1", name: "Taller Díaz" }])
    )

    const { result } = renderClients()

    expect(result.current.clients).toHaveLength(1)
    expect(result.current.clients[0].name).toBe("Taller Díaz")
  })

  it("no revienta si el almacenamiento tiene datos corruptos", () => {
    localStorage.setItem("clients", "{esto no es json")

    const { result } = renderClients()

    expect(result.current.clients).toEqual([])
  })

  it("agrega un cliente recortando los espacios", () => {
    const { result } = renderClients()

    act(() => {
      result.current.addClient(clientePrueba)
    })

    const [cliente] = result.current.clients

    expect(cliente.name).toBe("Ferremax")
    expect(cliente.rtn).toBe("0801199912345")
    expect(cliente.address).toBe("San Pedro Sula")
  })

  it("le asigna un identificador al cliente nuevo", () => {
    const { result } = renderClients()

    act(() => {
      result.current.addClient({ name: "Nuevo" })
    })

    expect(result.current.clients[0].id).toBeTruthy()
  })

  it("respeta el identificador si viene dado", () => {
    const { result } = renderClients()

    act(() => {
      result.current.addClient({ id: "propio", name: "Nuevo" })
    })

    expect(result.current.clients[0].id).toBe("propio")
  })

  it("persiste los clientes en el almacenamiento", () => {
    const { result } = renderClients()

    act(() => {
      result.current.addClient({ name: "Persistente" })
    })

    const guardado = JSON.parse(localStorage.getItem("clients"))

    expect(guardado[0].name).toBe("Persistente")
  })

  it("actualiza un cliente existente", () => {
    const { result } = renderClients()

    act(() => {
      result.current.addClient({ id: "c1", name: "Antes" })
    })

    act(() => {
      result.current.updateClient("c1", { name: "Después" })
    })

    expect(result.current.clients[0].name).toBe("Después")
  })

  it("no toca a los demás clientes al actualizar uno", () => {
    const { result } = renderClients()

    act(() => {
      result.current.addClient({ id: "c1", name: "Uno" })
      result.current.addClient({ id: "c2", name: "Dos" })
    })

    act(() => {
      result.current.updateClient("c1", { name: "Uno editado" })
    })

    const dos = result.current.clients.find((c) => c.id === "c2")

    expect(dos.name).toBe("Dos")
  })

  it("elimina un cliente", () => {
    const { result } = renderClients()

    act(() => {
      result.current.addClient({ id: "c1", name: "Temporal" })
    })

    act(() => {
      result.current.deleteClient("c1")
    })

    expect(result.current.clients).toHaveLength(0)
  })

  it("encuentra un cliente por identificador", () => {
    const { result } = renderClients()

    act(() => {
      result.current.addClient({ id: "c1", name: "Buscado" })
    })

    expect(result.current.getClientById("c1").name).toBe("Buscado")
  })

  it("devuelve algo falsy si el cliente no existe", () => {
    const { result } = renderClients()
    expect(result.current.getClientById("no-existe")).toBeFalsy()
  })
})
