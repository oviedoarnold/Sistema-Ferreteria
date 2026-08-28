import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"

function Login() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const navigate = useNavigate()
  const { login } = useAuth()

  const handleLogin = (e) => {
    e.preventDefault()
    setError("")
    const success = login(username.trim(), password)
    if (success) navigate("/dashboard")
    else setError("Usuario o contraseña incorrectos.")
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
            <label htmlFor="login-usuario">Usuario</label>
            <input id="login-usuario" autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="login-password">Contraseña</label>
            <div className="pw-wrap">
              <input id="login-password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="pw-toggle" onClick={() => setShowPassword((v) => !v)} aria-label="Mostrar u ocultar contraseña">{showPassword ? "🙈" : "👁"}</button>
            </div>
          </div>
          <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 4 }} type="submit">Ingresar</button>
        </form>
      </div>
    </div>
  )
}

export default Login
