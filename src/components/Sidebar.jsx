import {
  FaHome,
  FaCashRegister,
  FaBox,
  FaUsers,
  FaTruck,
  FaChartBar,
} from "react-icons/fa"

import { Link } from "react-router-dom"

function Sidebar() {
  return (
    <div className="w-64 h-screen bg-gray-900 text-white p-5 fixed">

      <h1 className="text-2xl font-bold mb-10 text-center">
        Ferretería Isaac
      </h1>

      <ul className="space-y-3">

        <Link to="/dashboard">
          <li className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 cursor-pointer">
            <FaHome />
            Dashboard
          </li>
        </Link>

        <li className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 cursor-pointer">
          <FaCashRegister />
          Ventas
        </li>

        <Link to="/products">
  <li className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 cursor-pointer">
    <FaBox />
    Productos
  </li>
</Link>

        <li className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 cursor-pointer">
          <FaUsers />
          Clientes
        </li>

        <li className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 cursor-pointer">
          <FaTruck />
          Proveedores
        </li>

        <li className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 cursor-pointer">
          <FaChartBar />
          Reportes
        </li>

      </ul>
    </div>
  )
}

export default Sidebar