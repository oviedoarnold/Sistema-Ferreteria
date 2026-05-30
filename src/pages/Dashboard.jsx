function Dashboard() {
  return (
    <div>

      <h1 className="text-3xl font-bold text-gray-700 mb-6">
        Bienvenido al Sistema
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

        <div className="bg-white p-6 rounded-2xl shadow-sm">
          <h2 className="text-gray-500">
            Ventas Hoy
          </h2>

          <p className="text-3xl font-bold mt-2">
            L 25,000
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm">
          <h2 className="text-gray-500">
            Productos
          </h2>

          <p className="text-3xl font-bold mt-2">
            1,250
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm">
          <h2 className="text-gray-500">
            Clientes
          </h2>

          <p className="text-3xl font-bold mt-2">
            320
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm">
          <h2 className="text-gray-500">
            Facturas
          </h2>

          <p className="text-3xl font-bold mt-2">
            85
          </p>
        </div>

      </div>

      <div className="mt-8 bg-white p-6 rounded-2xl shadow-sm">
        <h2 className="text-2xl font-bold mb-4">
          Resumen General
        </h2>

        <p className="text-gray-600">
          Aquí podrás visualizar estadísticas, ventas,
          inventario y reportes del sistema.
        </p>
      </div>

    </div>
  )
}

export default Dashboard