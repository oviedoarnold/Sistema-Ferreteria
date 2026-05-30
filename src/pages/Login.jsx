import { useState } from "react"
import { useNavigate } from "react-router-dom"

import { useAuth } from "../context/AuthContext"

function Login() {

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")

  const [error, setError] = useState("")

  const navigate = useNavigate()

  const { login } = useAuth()

  const handleLogin = (e) => {

    e.preventDefault()

    const success = login(username, password)

    if (success) {
      navigate("/dashboard")
    } else {
      setError("Usuario o contraseña incorrectos")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">

      <form
        onSubmit={handleLogin}
        className="bg-white p-8 rounded-2xl shadow-lg w-96"
      >

        <h1 className="text-3xl font-bold text-center mb-6">
          Ferretería
        </h1>

        {
          error && (
            <div className="bg-red-100 text-red-600 p-3 rounded-lg mb-4">
              {error}
            </div>
          )
        }

        <input
          type="text"
          placeholder="Usuario"
          className="w-full border p-3 rounded-lg mb-4"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          type="password"
          placeholder="Contraseña"
          className="w-full border p-3 rounded-lg mb-4"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700">
          Iniciar Sesión
        </button>

        <div className="mt-4 text-sm text-gray-500">
          Usuario: admin
          <br />
          Contraseña: 1234
        </div>

      </form>

    </div>
  )
}

export default Login