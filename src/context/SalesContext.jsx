import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react"

import { ProductContext } from "./ProductContext"

export const SalesContext = createContext()

const DEFAULT_COUNTERS = {
  invoice: 1000,
  quote: 2000,
}

function formatInvoiceNumber(number) {
  return `FAC-${String(number).padStart(5, "0")}`
}

function formatDate(date = new Date()) {
  return date.toLocaleDateString("es-HN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function SalesProvider({ children }) {
  const {
    products,
    setProducts,
    company,
  } = useContext(ProductContext)

  const [sales, setSales] = useState(() => {
    try {
      const saved =
        localStorage.getItem("sales")

      return saved
        ? JSON.parse(saved)
        : []
    } catch (error) {
      console.error(
        "Error cargando ventas:",
        error
      )

      return []
    }
  })

  const [counters, setCounters] =
    useState(() => {
      try {
        const saved =
          localStorage.getItem(
            "counters"
          )

        if (!saved) {
          return DEFAULT_COUNTERS
        }

        const parsed =
          JSON.parse(saved)

        return {
          ...DEFAULT_COUNTERS,
          ...parsed,
        }
      } catch (error) {
        console.error(
          "Error cargando contadores:",
          error
        )

        return DEFAULT_COUNTERS
      }
    })

  useEffect(() => {
    localStorage.setItem(
      "sales",
      JSON.stringify(sales)
    )
  }, [sales])

  useEffect(() => {
    localStorage.setItem(
      "counters",
      JSON.stringify(counters)
    )
  }, [counters])

  const validateSaleItems = (
    items = []
  ) => {
    if (!Array.isArray(items)) {
      throw new Error(
        "Los productos de la venta no son válidos."
      )
    }

    if (items.length === 0) {
      throw new Error(
        "La venta debe contener al menos un producto."
      )
    }

    items.forEach((item) => {
      const productId =
        item.productId ?? item.id

      const quantity = Number(
        item.qty ?? item.quantity ?? 0
      )

      if (!productId) {
        throw new Error(
          "Uno de los productos no tiene identificador."
        )
      }

      if (
        !Number.isFinite(quantity) ||
        quantity <= 0
      ) {
        throw new Error(
          "La cantidad de los productos debe ser mayor que cero."
        )
      }

      const product = products.find(
        (candidate) =>
          String(candidate.id) ===
          String(productId)
      )

      if (!product) {
        throw new Error(
          "Uno de los productos ya no existe en el inventario."
        )
      }

      if (
        quantity >
        Number(product.stock || 0)
      ) {
        throw new Error(
          `Stock insuficiente de ${product.name}. Solo hay ${product.stock} unidades disponibles.`
        )
      }
    })
  }

  const buildInvoiceItems = (
    items = []
  ) => {
    return items.map((item) => {
      const productId =
        item.productId ?? item.id

      const product = products.find(
        (candidate) =>
          String(candidate.id) ===
          String(productId)
      )

      const quantity = Number(
        item.qty ?? item.quantity ?? 1
      )

      const price = Number(
        item.price ??
          product?.price ??
          0
      )

      return {
        productId,
        id: productId,

        code:
          product?.code || "",

        name:
          product?.name ||
          item.name ||
          "Producto",

        category:
          product?.category ||
          item.category ||
          "",

        qty: quantity,
        quantity,

        price,

        subtotal:
          price * quantity,
      }
    })
  }

  const calculateTotals = (
    invoiceItems
  ) => {
    const subtotal =
      invoiceItems.reduce(
        (sum, item) =>
          sum + item.subtotal,
        0
      )

    const taxRate = Number(
      company?.taxRate ?? 15
    )

    const tax =
      subtotal * (taxRate / 100)

    return {
      subtotal,
      tax,
      taxRate,
      total: subtotal + tax,
    }
  }

  const reduceStock = (
    invoiceItems
  ) => {
    setProducts(
      (currentProducts) =>
        currentProducts.map(
          (product) => {
            const soldItem =
              invoiceItems.find(
                (item) =>
                  String(
                    item.productId
                  ) ===
                  String(
                    product.id
                  )
              )

            if (!soldItem) {
              return product
            }

            return {
              ...product,

              stock:
                Number(
                  product.stock || 0
                ) -
                Number(
                  soldItem.qty
                ),
            }
          }
        )
    )
  }

  const addSale = (sale) => {
    if (!sale) {
      throw new Error(
        "No se recibieron datos de la venta."
      )
    }

    validateSaleItems(
      sale.items
    )

    const invoiceItems =
      buildInvoiceItems(
        sale.items
      )

    const totals =
      calculateTotals(
        invoiceItems
      )

    const paymentType =
      sale.paymentType ||
      sale.type ||
      "contado"

    const isCredit =
      paymentType === "credito"

    if (
      isCredit &&
      !sale.clientId
    ) {
      throw new Error(
        "Para una venta a crédito debes seleccionar un cliente registrado."
      )
    }

    const invoiceCounter =
      counters.invoice

    const invoiceNumber =
      formatInvoiceNumber(
        invoiceCounter
      )

    const now = new Date()

    const customerName =
      sale.customerName ||
      sale.customer ||
      "Consumidor Final"

    const newInvoice = {
      id: `F-${invoiceCounter}`,

      invoiceNumber,

      date: formatDate(now),

      timestamp:
        now.getTime(),

      isoDate:
        now.toISOString(),

      clientId:
        sale.clientId || null,

      clientName:
        customerName,

      customerName:
        customerName,

      customer:
        customerName,

      rtn:
        sale.rtn || "",

      items:
        invoiceItems,

      subtotal:
        totals.subtotal,

      tax:
        totals.tax,

      taxRate:
        totals.taxRate,

      total:
        totals.total,

      paymentType,

      type:
        paymentType,

      dueDate:
        isCredit
          ? sale.dueDate || null
          : null,

      status:
        isCredit
          ? "pendiente"
          : "pagada",

      note:
        sale.note || "",

      company: {
        name:
          company?.name ||
          "Ferretería Isaac",

        address:
          company?.address ||
          "",

        phone:
          company?.phone ||
          "",

        currency:
          company?.currency ||
          "L",

        taxRate:
          totals.taxRate,
      },
    }

    /*
      SalesContext es quien modifica
      el inventario.

      POS solamente valida y envía
      los datos de la venta.
    */
    reduceStock(
      invoiceItems
    )

    setSales(
      (currentSales) => [
        newInvoice,
        ...currentSales,
      ]
    )

    setCounters(
      (currentCounters) => ({
        ...currentCounters,

        invoice:
          currentCounters.invoice +
          1,
      })
    )

    return newInvoice
  }

  const getSaleById = (id) => {
    return sales.find(
      (sale) =>
        String(sale.id) ===
        String(id)
    )
  }

  const getSaleByInvoiceNumber = (
    invoiceNumber
  ) => {
    return sales.find(
      (sale) =>
        String(
          sale.invoiceNumber
        ) ===
        String(invoiceNumber)
    )
  }

  return (
    <SalesContext.Provider
      value={{
        sales,
        setSales,

        addSale,

        getSaleById,
        getSaleByInvoiceNumber,

        counters,
        setCounters,
      }}
    >
      {children}
    </SalesContext.Provider>
  )
}

export default SalesProvider