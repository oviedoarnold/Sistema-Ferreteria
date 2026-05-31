import {
  BrowserRouter,
  Routes,
  Route
} from "react-router-dom"

import Login from "../pages/Login"
import Dashboard from "../pages/Dashboard"
import Products from "../pages/Products"
import MainLayout from "../layouts/MainLayout"

import ProtectedRoute from "./ProtectedRoute"

function AppRouter() {

  return (
    <BrowserRouter>

      <Routes>

        <Route
          path="/"
          element={<Login />}
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>

              <MainLayout>
                <Dashboard />
              </MainLayout>

            </ProtectedRoute>
          }
        />
  <Route
  path="/products"
  element={
    <ProtectedRoute>

      <MainLayout>
        <Products />
      </MainLayout>

    </ProtectedRoute>
  }
/>
      </Routes>

    </BrowserRouter>
  )
}

export default AppRouter