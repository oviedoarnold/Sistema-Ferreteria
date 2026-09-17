import { useContext, useMemo } from "react"

import { ClientsContext, ProductContext, SalesContext } from "../context/contexts"
import { resumirOperacion } from "../utils/operacion"

export function useOperacion() {
  const { products = [] } = useContext(ProductContext)
  const { sales = [] } = useContext(SalesContext)
  const { clients = [] } = useContext(ClientsContext)

  return useMemo(
    () => resumirOperacion({ productos: products, ventas: sales, clientes: clients }),
    [products, sales, clients]
  )
}
