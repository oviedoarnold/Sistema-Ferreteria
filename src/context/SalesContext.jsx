import { createContext, useState, useEffect } from "react"

export const SalesContext = createContext()

function SalesProvider({ children }) {

  const [sales, setSales] = useState(() => {

    const savedSales = localStorage.getItem("sales")

    return savedSales
      ? JSON.parse(savedSales)
      : []

  })

  // GUARDAR EN LOCALSTORAGE

  useEffect(() => {

    localStorage.setItem(
      "sales",
      JSON.stringify(sales)
    )

  }, [sales])

  return (

    <SalesContext.Provider
      value={{
        sales,
        setSales,
      }}
    >

      {children}

    </SalesContext.Provider>
  )
}

export default SalesProvider