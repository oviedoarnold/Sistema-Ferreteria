import { createContext, useState, useEffect } from "react"

export const ProductContext = createContext()

function ProductProvider({ children }) {

  const [products, setProducts] = useState(() => {

    const savedProducts = localStorage.getItem("products")

    return savedProducts
      ? JSON.parse(savedProducts)
      : [
          {
            id: 1,
            name: "Martillo",
            category: "Herramientas",
            price: 250,
            stock: 15,
          },
          {
            id: 2,
            name: "Cemento",
            category: "Construcción",
            price: 180,
            stock: 40,
          },
        ]
  })

  useEffect(() => {

    localStorage.setItem(
      "products",
      JSON.stringify(products)
    )

  }, [products])

  return (

    <ProductContext.Provider
      value={{
        products,
        setProducts,
      }}
    >

      {children}

    </ProductContext.Provider>

  )
}

export default ProductProvider