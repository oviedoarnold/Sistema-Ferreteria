import { createContext, useContext, useState } from "react"

const AuthContext = createContext()

export function AuthProvider({ children }) {

  const [user, setUser] = useState(
  JSON.parse(localStorage.getItem("user")) || null
)

  const login = (username, password) => {

    // Simulación temporal
    if (username === "admin" && password === "1234") {

      const userData = {
        name: "Administrador",
        email: "admin@ferreteria.com"
      }

      setUser(userData)

      localStorage.setItem(
        "user",
        JSON.stringify(userData)
      )

      return true
    }

    return false
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem("user")
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}