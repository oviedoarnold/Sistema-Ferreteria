import { useEffect, useMemo, useState } from "react"
import Swal from "sweetalert2"

const emptyForm = { id: null, name: "", contact: "", phone: "", email: "", notes: "" }

function Suppliers() {
  const [suppliers, setSuppliers] = useState(() => JSON.parse(localStorage.getItem("suppliers") || "[]"))
  const [search, setSearch] = useState("")
  const [form, setForm] = useState(emptyForm)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => { localStorage.setItem("suppliers", JSON.stringify(suppliers)); window.dispatchEvent(new CustomEvent("suppliersUpdated", { detail: suppliers })) }, [suppliers])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return suppliers.filter((s) => `${s.name} ${s.contact || ""}`.toLowerCase().includes(q))
  }, [suppliers, search])

  const openNew = () => { setForm(emptyForm); setModalOpen(true) }
  const openEdit = (s) => { setForm({ ...emptyForm, ...s }); setModalOpen(true) }

  const save = () => {
    if (!form.name.trim()) { Swal.fire({ icon: "warning", title: "Nombre requerido" }); return }
    if (form.id) setSuppliers((prev) => prev.map((s) => s.id === form.id ? { ...s, ...form } : s))
    else setSuppliers((prev) => [...prev, { ...form, id: `s_${Date.now()}` }])
    setModalOpen(false); setForm(emptyForm)
    Swal.fire({ icon: "success", title: form.id ? "Proveedor actualizado" : "Proveedor agregado" })
  }

  const remove = async (id) => {
    const result = await Swal.fire({ title: "¿Eliminar proveedor?", icon: "warning", showCancelButton: true, confirmButtonText: "Sí, eliminar", cancelButtonText: "Cancelar" })
    if (result.isConfirmed) setSuppliers((prev) => prev.filter((s) => s.id !== id))
  }

  return <div className="view active">
    <div className="view-header"><div><h2>Proveedores</h2><p className="sub">Contactos de quienes te abastecen</p></div><button className="btn btn-primary btn-lg" onClick={openNew}>+ Nuevo proveedor</button></div>
    <div className="toolbar"><div className="search-box"><span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}>⌕</span><input placeholder="Buscar proveedor..." value={search} onChange={(e) => setSearch(e.target.value)} /></div></div>
    <div className="table-wrap"><table><thead><tr><th>Proveedor</th><th>Contacto</th><th>Teléfono</th><th>Suministra</th><th></th></tr></thead><tbody>
      {filtered.map((s) => <tr key={s.id}><td><span className="product-name">{s.name}</span>{s.email && <span className="product-cat">{s.email}</span>}</td><td>{s.contact || "—"}</td><td>{s.phone || "—"}</td><td>{s.notes || "—"}</td><td><div className="row-actions"><button className="btn btn-secondary btn-sm" onClick={() => openEdit(s)}>Editar</button><button className="btn btn-danger btn-sm" onClick={() => remove(s.id)}>Eliminar</button></div></td></tr>)}
    </tbody></table>{filtered.length === 0 && <div className="empty-state"><strong>{suppliers.length ? "No se encontraron resultados" : "No hay proveedores todavía"}</strong></div>}</div>

    {modalOpen && <div className="modal-overlay open"><div className="modal"><div className="modal-head"><h3>{form.id ? "Editar proveedor" : "Nuevo proveedor"}</h3><button className="icon-btn" onClick={() => setModalOpen(false)}>✕</button></div><div className="modal-body"><div className="form-grid">
      <div className="field full"><label>Proveedor</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
      <div className="field"><label>Contacto</label><input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></div>
      <div className="field"><label>Teléfono</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
      <div className="field full"><label>Correo</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
      <div className="field full"><label>Suministra / Notas</label><textarea rows="3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
    </div></div><div className="modal-foot"><button className="btn btn-primary" onClick={save}>Guardar proveedor</button><button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button></div></div></div>}
  </div>
}

export default Suppliers
