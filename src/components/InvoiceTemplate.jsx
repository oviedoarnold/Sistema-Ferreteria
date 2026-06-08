function InvoiceTemplate({ sale }) {
  if (!sale) return null

  return (
    <div className="p-6 bg-white text-black w-full">

      {/* ENCABEZADO */}
      <div className="text-center border-b pb-3 mb-4">
        <h1 className="text-2xl font-bold">FERRETERÍA ISAAC</h1>
        <p className="text-sm">Materiales de Construcción y Herramientas</p>
        <p className="text-xs">San Pedro Sula, Honduras</p>
      </div>

      {/* INFO FACTURA */}
      <div className="text-sm mb-4">
        <p><strong>Factura #:</strong> {sale.invoiceNumber}</p>
        <p><strong>Cliente:</strong> {sale.customer}</p>
        <p><strong>Fecha:</strong> {sale.date}</p>
      </div>

      {/* TABLA */}
      <table className="w-full text-sm border">
        <thead>
          <tr className="border-b bg-gray-100">
            <th>Producto</th>
            <th>Cant</th>
            <th>Precio</th>
            <th>Subtotal</th>
          </tr>
        </thead>

        <tbody>
          {sale.products.map((p) => (
            <tr key={p.id} className="text-center border-b">
              <td>{p.name}</td>
              <td>{p.quantity}</td>
              <td>L {p.price}</td>
              <td>L {p.price * p.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* TOTALES */}
      <div className="mt-4 text-right text-sm">
        <p>Subtotal: L {sale.subtotal.toFixed(2)}</p>
        <p>ISV: L {sale.tax.toFixed(2)}</p>
        <p className="font-bold text-lg">TOTAL: L {sale.total.toFixed(2)}</p>
      </div>

      {/* FOOTER */}
      <p className="text-center text-xs mt-6">
        ¡Gracias por su compra!
      </p>
    </div>
  )
}

export default InvoiceTemplate