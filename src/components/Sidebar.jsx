import { NavLink } from "react-router-dom"
import { FaHome, FaCashRegister, FaBox, FaUsers, FaTruck, FaHistory } from "react-icons/fa"

function Sidebar() {
  return (
    <aside className="card card-pad" style={{ width: 240, height: '100vh', position: 'fixed' }}>
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <div className="brand-mark" style={{ display: 'inline-block' }}>🔧</div>
        <div className="brand-text" style={{ display: 'block' }}><strong>Ferretería Isaac</strong></div>
      </div>

      <div className="picker-list">
        <NavLink to="/dashboard" className="picker-item">
          <div><FaHome /></div>
          <div style={{ marginLeft: 8 }}>Dashboard</div>
        </NavLink>

        <NavLink to="/pos" className="picker-item">
          <div><FaCashRegister /></div>
          <div style={{ marginLeft: 8 }}>Facturación</div>
        </NavLink>

        <NavLink to="/products" className="picker-item">
          <div><FaBox /></div>
          <div style={{ marginLeft: 8 }}>Inventario</div>
        </NavLink>

        <NavLink to="/clients" className="picker-item">
          <div><FaUsers /></div>
          <div style={{ marginLeft: 8 }}>Clientes</div>
        </NavLink>

        <NavLink to="/suppliers" className="picker-item">
          <div><FaTruck /></div>
          <div style={{ marginLeft: 8 }}>Proveedores</div>
        </NavLink>

        <NavLink to="/sales-history" className="picker-item">
          <div><FaHistory /></div>
          <div style={{ marginLeft: 8 }}>Historial Ventas</div>
        </NavLink>
      </div>
    </aside>
  )
}

export default Sidebar