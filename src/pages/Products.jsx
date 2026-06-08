import { useState, useContext } from "react"
import Swal from "sweetalert2"
import { ProductContext } from "../context/ProductContext"

function Products() {

  const { products, setProducts } = useContext(ProductContext)

  const [name, setName] = useState("")
  const [category, setCategory] = useState("")
  const [price, setPrice] = useState("")
  const [stock, setStock] = useState("")

  const [editingId, setEditingId] = useState(null)

  const [search, setSearch] = useState("")

  // ESTADO DEL STOCK
  const getStockStatus = (stock) => {

    if (stock == 0) {
      return {
        text: "Agotado",
        color: "bg-red-500",
      }
    }

    if (stock <= 5) {
      return {
        text: "Stock Bajo",
        color: "bg-yellow-500",
      }
    }

    return {
      text: "Disponible",
      color: "bg-green-500",
    }
  }

  // ESTADÍSTICAS
  const totalProducts = products.length

  const lowStockProducts = products.filter(
    (product) => product.stock <= 5 && product.stock > 0
  ).length

  const outOfStockProducts = products.filter(
    (product) => product.stock == 0
  ).length

  // FILTRO DE BÚSQUEDA
  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(search.toLowerCase())
  )

  // AGREGAR PRODUCTO
  const handleAddProduct = () => {

    if (!name || !category || !price || !stock) {
      return
    }

    const newProduct = {
      id: Date.now(),
      name,
      category,
      price: Number(price),
      stock: Number(stock),
    }

    setProducts([...products, newProduct])

    Swal.fire({
      icon: "success",
      title: "Producto agregado",
      text: "El producto fue agregado correctamente",
    })

    clearForm()
  }

  // LIMPIAR FORMULARIO
  const clearForm = () => {

    setName("")
    setCategory("")
    setPrice("")
    setStock("")
    setEditingId(null)
  }

  // ELIMINAR
  const handleDelete = (id) => {

    Swal.fire({
      title: "¿Estás seguro?",
      text: "Este producto será eliminado",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    }).then((result) => {

      if (result.isConfirmed) {

        const filteredProducts = products.filter(
          (product) => product.id !== id
        )

        setProducts(filteredProducts)

        Swal.fire({
          icon: "success",
          title: "Producto eliminado",
          text: "El producto fue eliminado correctamente",
        })
      }
    })
  }

  // EDITAR
  const handleEdit = (product) => {

    setName(product.name)
    setCategory(product.category)
    setPrice(product.price)
    setStock(product.stock)

    setEditingId(product.id)
  }

  // ACTUALIZAR
  const handleUpdate = () => {

    const updatedProducts = products.map((product) => {

      if (product.id === editingId) {

        return {
          ...product,
          name,
          category,
          price: Number(price),
          stock: Number(stock),
        }
      }

      return product
    })

    setProducts(updatedProducts)

    Swal.fire({
      icon: "success",
      title: "Producto actualizado",
      text: "Los cambios fueron guardados",
    })

    clearForm()
  }

  return (

    <div>

      {/* BUSCADOR */}

      <div className="bg-white p-4 rounded-2xl shadow-sm mb-6">

        <input
          type="text"
          placeholder="Buscar producto..."
          className="w-full border p-3 rounded-lg"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

      </div>

      {/* TITULO */}

      <h1 className="text-3xl font-bold text-gray-700 mb-6">
        Productos
      </h1>

      {/* ESTADÍSTICAS */}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">

        <div className="bg-white p-6 rounded-2xl shadow-sm">

          <h2 className="text-gray-500">
            Total Productos
          </h2>

          <p className="text-3xl font-bold mt-2">
            {totalProducts}
          </p>

        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm">

          <h2 className="text-gray-500">
            Stock Bajo
          </h2>

          <p className="text-3xl font-bold mt-2 text-yellow-500">
            {lowStockProducts}
          </p>

        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm">

          <h2 className="text-gray-500">
            Agotados
          </h2>

          <p className="text-3xl font-bold mt-2 text-red-500">
            {outOfStockProducts}
          </p>

        </div>

      </div>

      {/* FORMULARIO */}

      <div className="bg-white p-6 rounded-2xl shadow-sm mb-6">

        <h2 className="text-2xl font-bold mb-4">

          {
            editingId
              ? "Editar Producto"
              : "Nuevo Producto"
          }

        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

          <input
            type="text"
            placeholder="Nombre"
            className="border p-3 rounded-lg"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            type="text"
            placeholder="Categoría"
            className="border p-3 rounded-lg"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />

          <input
            type="number"
            placeholder="Precio"
            className="border p-3 rounded-lg"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />

          <input
            type="number"
            placeholder="Stock"
            className="border p-3 rounded-lg"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
          />

        </div>

        <div className="mt-4 flex gap-4">

          {
            editingId ? (

              <button
                onClick={handleUpdate}
                className="bg-yellow-500 text-white px-5 py-3 rounded-xl hover:bg-yellow-600"
              >
                Actualizar
              </button>

            ) : (

              <button
                onClick={handleAddProduct}
                className="bg-blue-600 text-white px-5 py-3 rounded-xl hover:bg-blue-700"
              >
                Agregar Producto
              </button>

            )
          }

          <button
            onClick={clearForm}
            className="bg-gray-500 text-white px-5 py-3 rounded-xl hover:bg-gray-600"
          >
            Limpiar
          </button>

        </div>

      </div>

      {/* TABLA */}

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">

        <table className="w-full">

          <thead className="bg-gray-100">

            <tr>

              <th className="text-left p-4">
                Producto
              </th>

              <th className="text-left p-4">
                Categoría
              </th>

              <th className="text-left p-4">
                Precio
              </th>

              <th className="text-left p-4">
                Stock
              </th>

              <th className="text-left p-4">
                Estado
              </th>

              <th className="text-left p-4">
                Acciones
              </th>

            </tr>

          </thead>

          <tbody>

            {
              filteredProducts.map((product) => (

                <tr
                  key={product.id}
                  className="border-t"
                >

                  <td className="p-4 font-semibold">
                    {product.name}
                  </td>

                  <td className="p-4">
                    {product.category}
                  </td>

                  <td className="p-4">
                    L {product.price}
                  </td>

                  <td className="p-4">
                    {product.stock}
                  </td>

                  <td className="p-4">

                    <span
                      className={`
                        ${getStockStatus(product.stock).color}
                        text-white
                        px-3
                        py-1
                        rounded-full
                        text-sm
                      `}
                    >

                      {getStockStatus(product.stock).text}

                    </span>

                  </td>

                  <td className="p-4 flex gap-2">

                    <button
                      onClick={() => handleEdit(product)}
                      className="bg-yellow-400 px-4 py-2 rounded-lg"
                    >
                      Editar
                    </button>

                    <button
                      onClick={() => handleDelete(product.id)}
                      className="bg-red-500 text-white px-4 py-2 rounded-lg"
                    >
                      Eliminar
                    </button>

                  </td>

                </tr>

              ))
            }

          </tbody>

        </table>

      </div>

    </div>
  )
}

export default Products