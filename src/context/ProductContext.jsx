import { useState, useEffect } from "react"

import { ProductContext } from "./contexts"

import {
  guardarJSON,
} from "../utils/almacenamiento"

function ProductProvider({ children }) {

  const [products, setProducts] = useState(() => {
    const saved = localStorage.getItem("products")
    return saved
      ? JSON.parse(saved)
      : [
          { id: "p1", code: "CEM-001", name: "Cemento Gris (saco 42.5kg)", category: "Cemento y Construcción", price: 195, costPrice: 150, stock: 40, minStock: 10, supplierId: "s1" },
          { id: "p2", code: "HER-001", name: "Martillo de Uña 16oz", category: "Herramientas", price: 145, costPrice: 95, stock: 15, minStock: 5, supplierId: "" },
          { id: "p3", code: "TOR-001", name: "Tornillos para Madera 1\" (caja 100u)", category: "Tornillería", price: 35, costPrice: 22, stock: 8, minStock: 10, supplierId: "" },
          { id: "p4", code: "PIN-001", name: "Pintura Acrílica Blanca 1 Galón", category: "Pinturas", price: 320, costPrice: 230, stock: 12, minStock: 4, supplierId: "s2" },
          { id: "p5", code: "ELE-001", name: "Cable Eléctrico THHN #12 (rollo 100m)", category: "Eléctrico", price: 980, costPrice: 760, stock: 3, minStock: 5, supplierId: "" },
          { id: "p6", code: "HER-002", name: "Cinta Métrica 5m", category: "Herramientas", price: 65, costPrice: 38, stock: 0, minStock: 5, supplierId: "" },
          { id: "p7", code: "CER-001", name: "Candado de Bronce 40mm", category: "Cerrajería", price: 120, costPrice: 78, stock: 20, minStock: 5, supplierId: "" },
          { id: "p8", code: "PIN-002", name: "Brocha 3 pulgadas", category: "Pinturas", price: 45, costPrice: 26, stock: 25, minStock: 8, supplierId: "s2" }
        ]
  })

  const [suppliers, setSuppliers] = useState(() => {
    const saved = localStorage.getItem("suppliers")
    return saved
      ? JSON.parse(saved)
      : [
          { id: "s1", name: "Distribuidora Ferretera S.A.", contact: "Carlos Mejía", phone: "+504 2550-1234", email: "ventas@distferretera.hn", notes: "Cemento, varilla, block" },
          { id: "s2", name: "Pinturas del Norte", contact: "Ana López", phone: "+504 2558-7788", email: "", notes: "Pinturas y accesorios" }
        ]
  })

  const [company, setCompany] = useState(() => {
    const saved = localStorage.getItem("company")
    return saved
      ? JSON.parse(saved)
      : { name: "Ferretería Isaac", address: "Asentamientos Humanos, San Pedro Sula, Cortés", phone: "9709-0121", currency: "L", taxRate: 15 }
  })

  useEffect(() => { guardarJSON("products", products) }, [products])
  useEffect(() => { guardarJSON("suppliers", suppliers) }, [suppliers])
  useEffect(() => { guardarJSON("company", company) }, [company])

  return (
    <ProductContext.Provider value={{ products, setProducts, suppliers, setSuppliers, company, setCompany }}>
      {children}
    </ProductContext.Provider>
  )
}

export default ProductProvider