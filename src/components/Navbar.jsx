import { NavLink, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { FaHome, FaCashRegister, FaBox, FaUsers, FaTruck, FaHistory } from "react-icons/fa"

function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const handleLogout = () => { logout(); navigate('/') }

  const tabs = [
    { to: "/dashboard", label: "Dashboard", Icon: FaHome },
    { to: "/pos", label: "Facturar", Icon: FaCashRegister },
    { to: "/products", label: "Inventario", Icon: FaBox },
    { to: "/clients", label: "Clientes", Icon: FaUsers },
    { to: "/suppliers", label: "Proveedores", Icon: FaTruck },
    { to: "/sales-history", label: "Historial", Icon: FaHistory },
  ]

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="topbar-top">
          <div className="brand">
            <div className="brand-mark">🔧</div>
            <div className="brand-text"><h1 style={{margin:0}}>Ferretería Isaac</h1><p style={{margin:0}} className="sub">Panel</p></div>
          </div>

          <div className="topbar-user">
            <div className="user-pill">
              <div className="user-avatar">{user?.name ? user.name.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase() : 'US'}</div>
              <div className="user-meta"><b>{user?.name || 'Usuario'}</b><span>{user?.role === 'admin' ? 'Administrador' : 'Vendedor'}</span></div>
            </div>
            <button onClick={handleLogout} className="btn-logout">⎋</button>
          </div>
        </div>

        <nav className="tabs">
          {tabs.map((tab) => {
            const Icon = tab.Icon
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) => isActive ? 'tab-link active' : 'tab-link'}
              >
                <Icon />
                {tab.label}
              </NavLink>
            )
          })}
        </nav>
      </div>
    </header>
  )
}

export default Navbar