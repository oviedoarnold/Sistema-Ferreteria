import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom"

import Login from "../pages/Login"
import Dashboard from "../pages/Dashboard"
import Products from "../pages/Products"
import POS from "../pages/POS"
import Quotes from "../pages/Quotes"
import SalesHistory from "../pages/SalesHistory"
import Clients from "../pages/Clients"
import Suppliers from "../pages/Suppliers"

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

        {/* FACTURAR */}
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

        {/* COTIZAR */}
        <Route
          path="/quotes"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Quotes />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        {/* HISTORIAL */}
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

        {/* PROVEEDORES */}
        <Route
          path="/suppliers"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Suppliers />
              </MainLayout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default AppRouter