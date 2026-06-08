import { useContext, useState } from "react"
import { ProductContext } from "../context/ProductContext"
import { SalesContext } from "../context/SalesContext"
import Swal from "sweetalert2"
import InvoiceTemplate from "../components/InvoiceTemplate"

function POS() {

  const { products, setProducts } = useContext(ProductContext)
  const { sales, setSales } = useContext(SalesContext)

  const [search, setSearch] = useState("")
  const [cart, setCart] = useState([])

  const [customerName, setCustomerName] = useState("Consumidor Final")

  const [showPreview, setShowPreview] = useState(false)
  const [pendingSale, setPendingSale] = useState(null)

  const clients = JSON.parse(localStorage.getItem("clients")) || []

  const currentDate = new Date().toLocaleString()
  const invoiceNumber = Date.now()

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  // =========================
  // AGREGAR CARRITO
  // =========================
  const addToCart = (product) => {

    const exists = cart.find(i => i.id === product.id)

    if (exists) {
      setCart(
        cart.map(i =>
          i.id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        )
      )
    } else {
      setCart([...cart, { ...product, quantity: 1 }])
    }
  }

  // =========================
  // TOTALES
  // =========================
  const subtotal = cart.reduce((a, i) => a + i.price * i.quantity, 0)
  const tax = subtotal * 0.15
  const total = subtotal + tax

  // =========================
  // PREVIEW
  // =========================
  const handlePreview = () => {

    if (cart.length === 0) {
      Swal.fire({ icon: "warning", title: "Factura vacía" })
      return
    }

    const sale = {
      id: Date.now(),
      invoiceNumber,
      customer: customerName,
      products: cart,
      subtotal,
      tax,
      total,
      date: currentDate,
    }

    setPendingSale(sale)
    setShowPreview(true)
  }

  // =========================
  // CONFIRMAR VENTA
  // =========================
  const confirmSale = () => {

    setSales([...sales, pendingSale])

    const updated = products.map(p => {
      const sold = pendingSale.products.find(i => i.id === p.id)
      if (sold) {
        return { ...p, stock: p.stock - sold.quantity }
      }
      return p
    })

    setProducts(updated)

    setCart([])
    setPendingSale(null)
    setShowPreview(false)

    Swal.fire({
      icon: "success",
      title: "Venta realizada",
    })
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

      {/* PRODUCTOS */}
      <div className="md:col-span-2">
        <div className="bg-white p-5 rounded-xl">

          <h1 className="text-2xl font-bold mb-4">
            Ferretería Isaac
          </h1>

          <select
            className="w-full border p-2 mb-3"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          >
            <option value="Consumidor Final">Consumidor Final</option>
            {clients.map(c => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          <input
            className="w-full border p-2 mb-3"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-2">
            {filteredProducts.map(p => (
              <div
                key={p.id}
                onClick={() => addToCart(p)}
                className="border p-2 cursor-pointer"
              >
                {p.name} - L {p.price}
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* FACTURA */}
      <div className="bg-white p-5 rounded-xl">

        <h2 className="font-bold">Factura</h2>

        <p>{customerName}</p>
        <p>{currentDate}</p>
        <p>#{invoiceNumber}</p>

        <hr />

        {cart.map(i => (
          <div key={i.id}>
            {i.name} x{i.quantity}
          </div>
        ))}

        <hr />

        <p>Total: L {total.toFixed(2)}</p>

        <button
          onClick={handlePreview}
          className="w-full bg-blue-600 text-white p-2 mt-3"
        >
          Vista Previa
        </button>

      </div>

      {/* PREVIEW */}
      {showPreview && pendingSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">

          <div className="bg-white w-[420px] p-4 rounded">

            <InvoiceTemplate sale={pendingSale} />

            <div className="flex gap-2 mt-3">

              <button
                onClick={confirmSale}
                className="bg-green-600 text-white flex-1 p-2"
              >
                Confirmar
              </button>

              <button
                onClick={() => setShowPreview(false)}
                className="bg-gray-500 text-white flex-1 p-2"
              >
                Cerrar
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  )
}

export default POS