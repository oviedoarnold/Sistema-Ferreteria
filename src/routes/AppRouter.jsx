import {
  BrowserRouter,
  Routes,
  Route
} from "react-router-dom"

import Login from "../pages/Login"
import Dashboard from "../pages/Dashboard"
import Products from "../pages/Products"
import POS from "../pages/POS"
import SalesHistory from "../pages/SalesHistory"
import Clients from "../pages/Clients"
import MainLayout from "../layouts/MainLayout"


import ProtectedRoute from "./ProtectedRoute"

function AppRouter() {

  return (

    <BrowserRouter>

      <Routes>

        {/* LOGIN */}

        <Route
          path="/"
          element={<Login />}
        />

        {/* DASHBOARD */}

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

        {/* PRODUCTOS */}

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
        {/* CLIENTES */}
        <Route
        path="/clients"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Clients />
            </MainLayout>
          </ProtectedRoute>
        }
      />

        {/* POS */}

        <Route
          path="/pos"
          element={
            <ProtectedRoute>

              <MainLayout>
                <POS />
              </MainLayout>

            </ProtectedRoute>
          }
        />

        {/* HISTORIAL VENTAS */}

        <Route
          path="/sales-history"
          element={
            <ProtectedRoute>

              <MainLayout>
                <SalesHistory />
              </MainLayout>

            </ProtectedRoute>
          }
          />
     
      </Routes>

    </BrowserRouter>
  )
}

export default AppRouter