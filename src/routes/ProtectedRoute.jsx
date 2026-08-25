import {
  Navigate,
  useLocation,
} from "react-router-dom"

import { useAuth } from "../context/AuthContext"

function ProtectedRoute({
  children,
  permission = null,
}) {
  const {
    user,
    hasPermission,
  } = useAuth()

  const location =
    useLocation()

  if (!user) {
    return (
      <Navigate
        to="/"
        replace
        state={{
          from: location.pathname,
        }}
      />
    )
  }

  if (
    permission &&
    !hasPermission(permission)
  ) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    )
  }

  return children
}

export default ProtectedRoute