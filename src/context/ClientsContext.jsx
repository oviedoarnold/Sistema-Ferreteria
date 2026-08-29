import {
  useEffect,
  useState,
} from "react"

import { ClientsContext } from "./contexts"

import { crearId } from "../utils/ids"

function ClientsProvider({ children }) {
  const [clients, setClients] = useState(() => {
    try {
      const savedClients =
        localStorage.getItem("clients")

      return savedClients
        ? JSON.parse(savedClients)
        : []
    } catch (error) {
      console.error(
        "Error cargando clientes:",
        error
      )

      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(
      "clients",
      JSON.stringify(clients)
    )
  }, [clients])

  const addClient = (client) => {
    const newClient = {
      ...client,

      id:
        client.id ||
        crearId("C"),

      name:
        client.name?.trim() || "",

      rtn:
        client.rtn?.trim() || "",

      phone:
        client.phone?.trim() || "",

      address:
        client.address?.trim() || "",

      email:
        client.email?.trim() || "",

      balance:
        Number(client.balance || 0),
    }

    setClients((currentClients) => [
      newClient,
      ...currentClients,
    ])

    return newClient
  }

  const updateClient = (
    id,
    updatedData
  ) => {
    let updatedClient = null

    setClients((currentClients) =>
      currentClients.map((client) => {
        if (
          String(client.id) !==
          String(id)
        ) {
          return client
        }

        updatedClient = {
          ...client,
          ...updatedData,

          id: client.id,

          name:
            updatedData.name?.trim() ??
            client.name,

          rtn:
            updatedData.rtn?.trim() ??
            client.rtn,

          phone:
            updatedData.phone?.trim() ??
            client.phone,

          address:
            updatedData.address?.trim() ??
            client.address,

          email:
            updatedData.email?.trim() ??
            client.email,
        }

        return updatedClient
      })
    )

    return updatedClient
  }

  const deleteClient = (id) => {
    setClients((currentClients) =>
      currentClients.filter(
        (client) =>
          String(client.id) !==
          String(id)
      )
    )
  }

  const getClientById = (id) => {
    return clients.find(
      (client) =>
        String(client.id) ===
        String(id)
    )
  }

  return (
    <ClientsContext.Provider
      value={{
        clients,
        setClients,

        addClient,
        updateClient,
        deleteClient,
        getClientById,
      }}
    >
      {children}
    </ClientsContext.Provider>
  )
}

export default ClientsProvider