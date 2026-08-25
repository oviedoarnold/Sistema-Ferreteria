import {
  useContext,
  useMemo,
  useState,
} from "react"

import { SalesContext } from "../context/SalesContext"
import { ProductContext } from "../context/ProductContext"

import InvoiceTemplate from "../components/InvoiceTemplate"
import DocumentPreviewModal from "../components/documents/DocumentPreviewModal"

function formatMoney(
  value,
  currency = "L"
) {
  return `${currency} ${Number(
    value || 0
  ).toLocaleString("es-HN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function isOverdue(sale) {
  if (
    sale.status !== "pendiente" ||
    !sale.dueDate
  ) {
    return false
  }

  const today =
    new Date()

  today.setHours(
    0,
    0,
    0,
    0
  )

  const due =
    new Date(
      `${sale.dueDate}T00:00:00`
    )

  return due < today
}

function getPaymentType(sale) {
  return (
    sale.paymentType ||
    sale.type ||
    "contado"
  ).toLowerCase()
}

function getClientName(sale) {
  return (
    sale.clientName ||
    sale.customerName ||
    sale.customer ||
    "Consumidor Final"
  )
}

function SalesHistory() {
  const {
    sales = [],
  } = useContext(SalesContext)

  const {
    company = {},
  } = useContext(ProductContext)

  const [search, setSearch] =
    useState("")

  const [filter, setFilter] =
    useState("todas")

  const [
    selectedSale,
    setSelectedSale,
  ] = useState(null)

  const currency =
    company?.currency ||
    "L"

  const filteredSales =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase()

      return sales.filter(
        (sale) => {
          const clientName =
            getClientName(
              sale
            ).toLowerCase()

          const invoiceNumber =
            String(
              sale.invoiceNumber ||
                ""
            ).toLowerCase()

          const matchesSearch =
            clientName.includes(
              query
            ) ||
            invoiceNumber.includes(
              query
            )

          if (
            !matchesSearch
          ) {
            return false
          }

          const paymentType =
            getPaymentType(
              sale
            )

          if (
            filter ===
            "contado"
          ) {
            return (
              paymentType ===
              "contado"
            )
          }

          if (
            filter ===
            "credito"
          ) {
            return (
              paymentType ===
              "credito"
            )
          }

          return true
        }
      )
    }, [
      sales,
      search,
      filter,
    ])

  const totalSales =
    sales.reduce(
      (sum, sale) =>
        sum +
        Number(
          sale.total || 0
        ),
      0
    )

  const cashSales =
    sales.filter(
      (sale) =>
        getPaymentType(
          sale
        ) === "contado"
    ).length

  const creditSales =
    sales.filter(
      (sale) =>
        getPaymentType(
          sale
        ) === "credito"
    ).length

  const pendingSales =
    sales.filter(
      (sale) =>
        sale.status ===
        "pendiente"
    ).length

  const getStatusBadge = (
    sale
  ) => {
    if (
      sale.status ===
      "pagada"
    ) {
      return (
        <span className="badge badge-paid">
          <span className="badge-dot" />
          Pagada
        </span>
      )
    }

    if (
      isOverdue(sale)
    ) {
      return (
        <span className="badge badge-overdue">
          <span className="badge-dot" />
          Vencida
        </span>
      )
    }

    return (
      <span className="badge badge-credit">
        <span className="badge-dot" />
        Pendiente
      </span>
    )
  }

  return (
    <div className="view active">

      {/* ENCABEZADO */}
      <div className="view-header">
        <div>
          <h2>
            Historial de facturas
          </h2>

          <p className="sub">
            Consulta las ventas
            registradas en el
            sistema
          </p>
        </div>
      </div>

      {/* RESUMEN */}
      <div className="dash-grid">

        <div className="stat-card blue">
          <div className="label">
            Facturas
          </div>

          <div className="value">
            {sales.length}
          </div>

          <div className="sub-val">
            Total registradas
          </div>
        </div>

        <div className="stat-card teal">
          <div className="label">
            Ventas contado
          </div>

          <div className="value">
            {cashSales}
          </div>

          <div className="sub-val">
            Facturas pagadas
          </div>
        </div>

        <div className="stat-card purple">
          <div className="label">
            Ventas crédito
          </div>

          <div className="value">
            {creditSales}
          </div>

          <div className="sub-val">
            Facturas a crédito
          </div>
        </div>

        <div className="stat-card amber">
          <div className="label">
            Pendientes
          </div>

          <div className="value">
            {pendingSales}
          </div>

          <div className="sub-val">
            Por pagar
          </div>
        </div>

      </div>

      {/* TOTAL VENDIDO */}
      <div
        className="card card-pad"
        style={{
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display:
              "flex",
            alignItems:
              "center",
            justifyContent:
              "space-between",
            gap: 16,
          }}
        >
          <div>
            <span
              style={{
                display:
                  "block",
                fontSize: 12,
                color:
                  "var(--steel)",
              }}
            >
              Total facturado
            </span>

            <strong
              style={{
                fontSize: 24,
              }}
            >
              {formatMoney(
                totalSales,
                currency
              )}
            </strong>
          </div>
        </div>
      </div>

      {/* FILTROS */}
      <div className="toolbar">

        <div className="search-box">

          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle
              cx="11"
              cy="11"
              r="8"
            />

            <line
              x1="21"
              y1="21"
              x2="16.65"
              y2="16.65"
            />
          </svg>

          <input
            type="text"
            placeholder="Buscar por cliente o número de factura..."
            value={search}
            onChange={(
              event
            ) =>
              setSearch(
                event
                  .target
                  .value
              )
            }
          />

        </div>

        <select
          className="filter-select"
          value={filter}
          onChange={(
            event
          ) =>
            setFilter(
              event
                .target
                .value
            )
          }
        >
          <option value="todas">
            Todas
          </option>

          <option value="contado">
            Contado
          </option>

          <option value="credito">
            Crédito
          </option>
        </select>

      </div>

      {/* LISTA */}
      {sales.length === 0 ? (
        <div className="empty-state">

          <strong>
            No hay facturas
            registradas
          </strong>

          Las ventas que generes
          desde Facturar aparecerán
          aquí.

        </div>
      ) : (
        <div
          className="card"
          style={{
            display:
              "flex",
            flexDirection:
              "column",
          }}
        >

          {filteredSales.map(
            (
              sale,
              index
            ) => {
              const paymentType =
                getPaymentType(
                  sale
                )

              return (
                <div
                  className="sale-card"
                  key={sale.id}
                  style={{
                    borderTop:
                      index > 0
                        ? "1px solid var(--line)"
                        : "none",
                  }}
                >

                  <div className="left">

                    <div className="sale-icon">
                      🧾
                    </div>

                    <div className="sale-info">

                      <b>
                        {getClientName(
                          sale
                        )}
                      </b>

                      <span>
                        {sale.invoiceNumber}

                        {" · "}

                        {sale.date}
                      </span>

                      <div className="badges">

                        {paymentType ===
                        "credito" ? (
                          <span className="badge badge-credit">
                            <span className="badge-dot" />
                            Crédito
                          </span>
                        ) : (
                          <span className="badge badge-paid">
                            <span className="badge-dot" />
                            Contado
                          </span>
                        )}

                        {getStatusBadge(
                          sale
                        )}

                      </div>

                    </div>

                  </div>

                  <div className="sale-right">

                    <div className="sale-total">
                      {formatMoney(
                        sale.total,
                        sale
                          .company
                          ?.currency ||
                          currency
                      )}
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() =>
                        setSelectedSale(
                          sale
                        )
                      }
                    >
                      Ver factura
                    </button>

                  </div>

                </div>
              )
            }
          )}

          {filteredSales.length ===
            0 && (
            <div className="empty-state">
              <strong>
                No se encontraron
                facturas
              </strong>

              Cambia la búsqueda
              o el filtro.
            </div>
          )}

        </div>
      )}

      {/* FACTURA */}
      <DocumentPreviewModal
        open={
          !!selectedSale
        }
        title={
          selectedSale
            ? `Factura ${selectedSale.invoiceNumber}`
            : "Factura"
        }
        fileName={`Factura-${
          selectedSale?.invoiceNumber ||
          "documento"
        }.pdf`}
        printTitle={
          selectedSale
            ? `Factura ${selectedSale.invoiceNumber}`
            : "Factura"
        }
        canExport
        onClose={() =>
          setSelectedSale(
            null
          )
        }
      >
        <InvoiceTemplate
          sale={
            selectedSale
          }
        />
      </DocumentPreviewModal>

    </div>
  )
}

export default SalesHistory