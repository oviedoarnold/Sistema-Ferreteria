import {
  FaHome,
  FaCashRegister,
  FaBox,
  FaUsers,
  FaTruck,
  FaChartBar,
  FaHistory,
} from "react-icons/fa"

import { Link } from "react-router-dom"

function Sidebar() {

  return (

    <div className="w-64 h-screen bg-gray-900 text-white p-5 fixed">

      <h1 className="text-2xl font-bold mb-10 text-center">
        Ferretería Isaac
      </h1>

      <ul className="space-y-3">

        {/* DASHBOARD */}

        <Link to="/dashboard">

          <li className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 cursor-pointer">

            <FaHome />
            Dashboard

          </li>

        </Link>
        

        {/* POS / FACTURACIÓN */}

        <Link to="/pos">

          <li className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 cursor-pointer">

            <FaCashRegister />
            Facturación

          </li>

        </Link>

        {/* PRODUCTOS */}

        <Link to="/products">

          <li className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 cursor-pointer">

            <FaBox />
            Inventario

          </li>

        </Link>

        {/* CLIENTES */}

        <Link to="/clients">

        <li className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 cursor-pointer">

          <FaUsers />
          Clientes

        </li>

        </Link>

        {/* PROVEEDORES */}

        <li className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 cursor-pointer">

          <FaTruck />
          Proveedores

        </li>

        {/* REPORTES */}
        <Link to="/sales-history">

          <li className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 cursor-pointer">

            <FaHistory />

            Historial Ventas

          </li>

        </Link>

      </ul>

    </div>
  )
}

export default Sidebar