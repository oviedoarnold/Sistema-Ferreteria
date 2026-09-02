import { useState } from "react"
import { useNavigate } from "react-router-dom"

import { useAuth } from "../hooks/useAuth"

function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [entrando, setEntrando] = useState(false)

  const navigate = useNavigate()
  const { login } = useAuth()

  const handleLogin = async (e) => {
    e.preventDefault()
    setError("")
    setEntrando(true)

    const resultado = await login(email, password)

    setEntrando(false)

    if (resultado.ok) {
      navigate("/dashboard")
      return
    }

    setError(resultado.mensaje)
  }

  return (
    <div id="login-screen">
      <div className="login-card">
        <div style={{ fontSize: 36, marginBottom: 10 }}>🔧</div>
        <h2>Iniciar sesión</h2>
        <p className="sub">Accede al sistema de tu ferretería</p>
        <div className={`login-error ${error ? "show" : ""}`}>{error}</div>

        <form onSubmit={handleLogin}>
          <div className="field">
            <label htmlFor="login-correo">Correo</label>
            <input
              id="login-correo"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="login-password">Contraseña</label>
            <div className="pw-wrap">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="pw-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label="Mostrar u ocultar contraseña"
              >
                {showPassword ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          <button
            className="btn btn-primary btn-lg btn-block"
            style={{ marginTop: 4 }}
            type="submit"
            disabled={entrando}
          >
            {entrando ? "Entrando…" : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login
