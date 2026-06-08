import { useContext, useState } from "react"
import { SalesContext } from "../context/SalesContext"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import InvoiceTemplate from "../components/InvoiceTemplate"

function SalesHistory() {

  const { sales = [] } = useContext(SalesContext)

  const [search, setSearch] = useState("")
  const [selectedSale, setSelectedSale] = useState(null)

  // =========================
  // FILTRO
  // =========================
  const filteredSales = sales.filter(s =>
    (s.customer || "")
      .toLowerCase()
      .includes(search.toLowerCase())
  )

  // =========================
  // PDF PROFESIONAL
  // =========================
  const generatePDF = (sale) => {

    const doc = new jsPDF()

    doc.setFont("helvetica", "bold")
    doc.setFontSize(18)
    doc.text("FERRETERÍA ISAAC", 105, 15, { align: "center" })

    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.text("Factura de Venta", 105, 22, { align: "center" })

    doc.line(10, 28, 200, 28)

    doc.setFontSize(11)
    doc.text(`Factura #: ${sale.invoiceNumber}`, 14, 38)
    doc.text(`Cliente: ${sale.customer}`, 14, 45)
    doc.text(`Fecha: ${sale.date}`, 14, 52)

    autoTable(doc, {
      startY: 60,
      head: [["Producto", "Cant", "Precio", "Subtotal"]],
      body: sale.products.map(p => [
        p.name,
        p.quantity,
        `L ${p.price}`,
        `L ${p.price * p.quantity}`
      ])
    })

    const y = doc.lastAutoTable.finalY + 10

    doc.text(`Subtotal: L ${sale.subtotal.toFixed(2)}`, 140, y)
    doc.text(`ISV: L ${sale.tax.toFixed(2)}`, 140, y + 7)

    doc.setFont("helvetica", "bold")
    doc.text(`TOTAL: L ${sale.total.toFixed(2)}`, 140, y + 16)

    doc.save(`Factura-${sale.invoiceNumber}.pdf`)
  }

  // =========================
  // IMPRIMIR
  // =========================
  const printSale = (sale) => {
    setSelectedSale(sale)

    setTimeout(() => {
      window.print()
    }, 300)
  }

  return (
    <div className="p-6">

      <h1 className="text-3xl font-bold mb-4">
        Historial de Ventas
      </h1>

      {/* BUSCADOR */}
      <input
        className="border p-2 w-full mb-4"
        placeholder="Buscar cliente..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* TABLA */}
      <div className="bg-white rounded-xl shadow">

        <table className="w-full">

          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Factura</th>
              <th className="p-3 text-left">Cliente</th>
              <th className="p-3 text-left">Fecha</th>
              <th className="p-3 text-left">Total</th>
              <th className="p-3 text-left">Acciones</th>
            </tr>
          </thead>

          <tbody>

            {filteredSales.map(sale => (
              <tr key={sale.id} className="border-t">

                <td className="p-3">#{sale.invoiceNumber}</td>
                <td className="p-3">{sale.customer}</td>
                <td className="p-3">{sale.date}</td>
                <td className="p-3 font-bold text-green-600">
                  L {sale.total.toFixed(2)}
                </td>

                <td className="p-3 flex gap-2">

                  <button
                    onClick={() => setSelectedSale(sale)}
                    className="bg-gray-700 text-white px-3 py-1 rounded"
                  >
                    Ver
                  </button>

                  <button
                    onClick={() => printSale(sale)}
                    className="bg-blue-600 text-white px-2 py-1 rounded"
                  >
                    Imprimir
                  </button>

                  <button
                    onClick={() => generatePDF(sale)}
                    className="bg-red-600 text-white px-2 py-1 rounded"
                  >
                    PDF
                  </button>

                </td>

              </tr>
            ))}

          </tbody>

        </table>
      </div>

      {/* =========================
          MODAL VISTA PREVIA
      ========================= */}
      {selectedSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">

          <div className="bg-white w-[420px] p-4 rounded overflow-auto">

            <InvoiceTemplate sale={selectedSale} />

            <div className="flex gap-2 mt-3">

              <button
                onClick={() => window.print()}
                className="flex-1 bg-blue-600 text-white p-2 rounded"
              >
                Imprimir
              </button>

              <button
                onClick={() => generatePDF(selectedSale)}
                className="flex-1 bg-green-600 text-white p-2 rounded"
              >
                PDF
              </button>

            </div>

            <button
              onClick={() => setSelectedSale(null)}
              className="w-full mt-2 bg-red-500 text-white p-2 rounded"
            >
              Cerrar
            </button>

          </div>

        </div>
      )}

    </div>
  )
}

export default SalesHistory