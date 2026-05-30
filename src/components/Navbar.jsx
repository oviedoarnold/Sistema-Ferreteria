import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

function Navbar() {

  const { user, logout } = useAuth()

  const navigate = useNavigate()

  const handleLogout = () => {

    logout()

    navigate("/")
  }

  return (
    <div className="bg-white shadow-sm p-4 flex justify-between items-center">

      <h1 className="text-2xl font-bold text-gray-700">
        Dashboard
      </h1>

      <div className="flex items-center gap-4">

        <div>
          <p className="font-semibold">
            {user?.name}
          </p>

          <p className="text-sm text-gray-500">
            {user?.email}
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600"
        >
          Salir
        </button>

      </div>

    </div>
  )
}

export default Navbar