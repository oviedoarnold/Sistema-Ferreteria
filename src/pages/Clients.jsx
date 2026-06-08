import { useState, useEffect } from "react"
import Swal from "sweetalert2"

function Clients() {

  const [clients, setClients] = useState(() => {

    const savedClients =
      localStorage.getItem("clients")

    return savedClients
      ? JSON.parse(savedClients)
      : []
  })

  const [name, setName] = useState("")
  const [rtn, setRtn] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [email, setEmail] = useState("")

  const [editingId, setEditingId] =
    useState(null)

  const [search, setSearch] = useState("")

  // GUARDAR EN LOCALSTORAGE

  useEffect(() => {

    localStorage.setItem(
      "clients",
      JSON.stringify(clients)
    )

  }, [clients])

  // FILTRAR

  const filteredClients = clients.filter(
    (client) =>
      client.name
        .toLowerCase()
        .includes(search.toLowerCase())
  )

  // LIMPIAR

  const clearForm = () => {

    setName("")
    setRtn("")
    setPhone("")
    setAddress("")
    setEmail("")

    setEditingId(null)
  }

  // AGREGAR

  const handleAddClient = () => {

    if (
      !name ||
      !rtn ||
      !phone
    ) {
      return
    }

    const newClient = {
      id: Date.now(),
      name,
      rtn,
      phone,
      address,
      email,
    }

    setClients([
      ...clients,
      newClient,
    ])

    Swal.fire({
      icon: "success",
      title: "Cliente agregado",
      text: "Cliente registrado correctamente",
    })

    clearForm()
  }

  // ELIMINAR

  const handleDelete = (id) => {

    Swal.fire({
      title: "¿Eliminar cliente?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí",
      cancelButtonText: "Cancelar",
    }).then((result) => {

      if (result.isConfirmed) {

        const updatedClients =
          clients.filter(
            (client) =>
              client.id !== id
          )

        setClients(updatedClients)

        Swal.fire({
          icon: "success",
          title: "Cliente eliminado",
        })
      }
    })
  }

  // EDITAR

  const handleEdit = (client) => {

    setName(client.name)
    setRtn(client.rtn)
    setPhone(client.phone)
    setAddress(client.address)
    setEmail(client.email)

    setEditingId(client.id)
  }

  // ACTUALIZAR

  const handleUpdate = () => {

    const updatedClients =
      clients.map((client) => {

        if (client.id === editingId) {

          return {
            ...client,
            name,
            rtn,
            phone,
            address,
            email,
          }
        }

        return client
      })

    setClients(updatedClients)

    Swal.fire({
      icon: "success",
      title: "Cliente actualizado",
    })

    clearForm()
  }

  return (

    <div>

      {/* BUSCADOR */}

      <div className="bg-white p-5 rounded-2xl shadow-sm mb-6">

        <h1 className="text-3xl font-bold text-gray-700 mb-5">
          Clientes
        </h1>

        <input
          type="text"
          placeholder="Buscar cliente..."
          className="w-full border p-3 rounded-lg"
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
        />

      </div>

      {/* FORMULARIO */}

      <div className="bg-white p-6 rounded-2xl shadow-sm mb-6">

        <h2 className="text-2xl font-bold mb-4">

          {
            editingId
              ? "Editar Cliente"
              : "Nuevo Cliente"
          }

        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <input
            type="text"
            placeholder="Nombre"
            className="border p-3 rounded-lg"
            value={name}
            onChange={(e) =>
              setName(e.target.value)
            }
          />

          <input
            type="text"
            placeholder="RTN"
            className="border p-3 rounded-lg"
            value={rtn}
            onChange={(e) =>
              setRtn(e.target.value)
            }
          />

          <input
            type="text"
            placeholder="Teléfono"
            className="border p-3 rounded-lg"
            value={phone}
            onChange={(e) =>
              setPhone(e.target.value)
            }
          />

          <input
            type="text"
            placeholder="Correo"
            className="border p-3 rounded-lg"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
          />

          <input
            type="text"
            placeholder="Dirección"
            className="border p-3 rounded-lg md:col-span-2"
            value={address}
            onChange={(e) =>
              setAddress(e.target.value)
            }
          />

        </div>

        <div className="mt-5 flex gap-4">

          {
            editingId ? (

              <button
                onClick={handleUpdate}
                className="bg-yellow-500 text-white px-5 py-3 rounded-xl"
              >
                Actualizar
              </button>

            ) : (

              <button
                onClick={handleAddClient}
                className="bg-blue-600 text-white px-5 py-3 rounded-xl"
              >
                Agregar Cliente
              </button>

            )
          }

          <button
            onClick={clearForm}
            className="bg-gray-500 text-white px-5 py-3 rounded-xl"
          >
            Limpiar
          </button>

        </div>

      </div>

      {/* TABLA */}

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">

        <table className="w-full">

          <thead className="bg-gray-100">

            <tr>

              <th className="p-4 text-left">
                Nombre
              </th>

              <th className="p-4 text-left">
                RTN
              </th>

              <th className="p-4 text-left">
                Teléfono
              </th>

              <th className="p-4 text-left">
                Correo
              </th>

              <th className="p-4 text-left">
                Acciones
              </th>

            </tr>

          </thead>

          <tbody>

            {
              filteredClients.map((client) => (

                <tr
                  key={client.id}
                  className="border-t"
                >

                  <td className="p-4">
                    {client.name}
                  </td>

                  <td className="p-4">
                    {client.rtn}
                  </td>

                  <td className="p-4">
                    {client.phone}
                  </td>

                  <td className="p-4">
                    {client.email}
                  </td>

                  <td className="p-4 flex gap-2">

                    <button
                      onClick={() =>
                        handleEdit(client)
                      }
                      className="bg-yellow-400 px-4 py-2 rounded-lg"
                    >
                      Editar
                    </button>

                    <button
                      onClick={() =>
                        handleDelete(client.id)
                      }
                      className="bg-red-500 text-white px-4 py-2 rounded-lg"
                    >
                      Eliminar
                    </button>

                  </td>

                </tr>

              ))
            }

          </tbody>

        </table>

      </div>

    </div>
  )
}

export default Clients