import { useContext, useMemo, useState } from "react"
import Swal from "sweetalert2"
import { ClientsContext } from "../context/ClientsContext"

const emptyForm = { id: null, name: "", rtn: "", phone: "", address: "", email: "" }

function Clients() {
  const { clients = [], addClient, updateClient, deleteClient } = useContext(ClientsContext)
  const [search, setSearch] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase()
    return clients.filter((c) => [c.name, c.rtn, c.phone, c.email].some((v) => String(v || "").toLowerCase().includes(q)))
  }, [clients, search])

  const openNew = () => { setForm(emptyForm); setModalOpen(true) }
  const openEdit = (client) => { setForm({ ...emptyForm, ...client }); setModalOpen(true) }

  const save = () => {
    if (!form.name.trim() || !form.phone.trim() || !form.address.trim()) {
      Swal.fire({ icon: "warning", title: "Faltan datos", text: "Nombre, teléfono y dirección son obligatorios" })
      return
    }
    if (form.id) updateClient(form.id, form)
    else addClient(form)
    setModalOpen(false)
    setForm(emptyForm)
    Swal.fire({ icon: "success", title: form.id ? "Cliente actualizado" : "Cliente agregado" })
  }

  const remove = async (id) => {
    const result = await Swal.fire({ title: "¿Eliminar cliente?", text: "Esta acción no se puede deshacer", icon: "warning", showCancelButton: true, confirmButtonText: "Sí, eliminar", cancelButtonText: "Cancelar" })
    if (!result.isConfirmed) return
    if (deleteClient) deleteClient(id)
    Swal.fire({ icon: "success", title: "Cliente eliminado" })
  }

  return (
    <div className="view active">
      <div className="view-header">
        <div><h2>Clientes</h2><p className="sub">Gestiona tus clientes y su información de contacto</p></div>
        <button className="btn btn-primary btn-lg" onClick={openNew}>+ Nuevo cliente</button>
      </div>

      <div className="toolbar">
        <div className="search-box"><span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}>⌕</span><input placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Cliente</th><th>RTN</th><th>Teléfono</th><th>Correo</th><th></th></tr></thead>
          <tbody>
            {filteredClients.map((c) => (
              <tr key={c.id}>
                <td><span className="product-name">{c.name}</span><span className="product-cat">{c.address || "—"}</span></td>
                <td>{c.rtn || "—"}</td><td>{c.phone || "—"}</td><td>{c.email || "—"}</td>
                <td><div className="row-actions"><button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>Editar</button><button className="btn btn-danger btn-sm" onClick={() => remove(c.id)}>Eliminar</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredClients.length === 0 && <div className="empty-state"><strong>{clients.length ? "No se encontraron resultados" : "No hay clientes todavía"}</strong></div>}
      </div>

      {modalOpen && <div className="modal-overlay open" onMouseDown={(e) => e.target === e.currentTarget && setModalOpen(false)}>
        <div className="modal">
          <div className="modal-head"><h3>{form.id ? "Editar cliente" : "Nuevo cliente"}</h3><button className="icon-btn" aria-label="Cerrar" onClick={() => setModalOpen(false)}>✕</button></div>
          <div className="modal-body"><div className="form-grid">
            <div className="field"><label>Nombre</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="field"><label>RTN (opcional)</label><input value={form.rtn} onChange={(e) => setForm({ ...form, rtn: e.target.value })} /></div>
            <div className="field"><label>Teléfono</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="field"><label>Correo</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="field full"><label>Dirección</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          </div></div>
          <div className="modal-foot"><button className="btn btn-primary" onClick={save}>Guardar cliente</button><button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button></div>
        </div>
      </div>}
    </div>
  )
}

export default Clients
