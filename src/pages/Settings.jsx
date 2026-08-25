import {
  useContext,
  useEffect,
  useState,
} from "react"

import Swal from "sweetalert2"

import { ProductContext } from "../context/ProductContext"

function Settings() {
  const {
    company,
    setCompany,
  } = useContext(ProductContext)

  const [form, setForm] =
    useState({
      name: "",
      address: "",
      phone: "",
      currency: "L",
      taxRate: 15,
    })

  /*
   * Cargamos los datos actuales
   * de la empresa en el formulario.
   */
  useEffect(() => {
    setForm({
      name:
        company?.name ||
        "",

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
        company?.taxRate ??
        15,
    })
  }, [company])

  const handleChange = (
    event
  ) => {
    const {
      name,
      value,
    } = event.target

    setForm(
      (current) => ({
        ...current,

        [name]:
          name ===
          "taxRate"
            ? value
            : value,
      })
    )
  }

  const handleSubmit = (
    event
  ) => {
    event.preventDefault()

    const name =
      form.name.trim()

    const address =
      form.address.trim()

    const phone =
      form.phone.trim()

    const currency =
      form.currency.trim()

    const taxRate =
      Number(
        form.taxRate
      )

    if (
      !name ||
      !address ||
      !phone ||
      !currency
    ) {
      Swal.fire({
        icon: "warning",

        title:
          "Faltan datos",

        text:
          "Completa todos los campos obligatorios.",
      })

      return
    }

    if (
      !Number.isFinite(
        taxRate
      ) ||
      taxRate < 0 ||
      taxRate > 100
    ) {
      Swal.fire({
        icon: "warning",

        title:
          "ISV inválido",

        text:
          "La tasa de ISV debe estar entre 0 y 100.",
      })

      return
    }

    const updatedCompany = {
      name,
      address,
      phone,
      currency,
      taxRate,
    }

    setCompany(
      updatedCompany
    )

    Swal.fire({
      icon: "success",

      title:
        "Configuración guardada",

      text:
        "Los datos de la ferretería fueron actualizados correctamente.",
    })
  }

  const handleRestoreForm =
    () => {
      setForm({
        name:
          company?.name ||
          "",

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
          company?.taxRate ??
          15,
      })
    }

  return (
    <div className="view active">

      {/* ENCABEZADO */}
      <div className="view-header">

        <div>
          <h2>
            Configuración
          </h2>

          <p className="sub">
            Datos de tu
            ferretería y
            configuración del
            sistema
          </p>
        </div>

      </div>

      <div className="card card-pad">

        {/* DATOS EMPRESA */}
        <div className="config-section">

          <h3>
            Datos de la
            ferretería
          </h3>

          <p
            className="sub"
            style={{
              marginBottom:
                18,
            }}
          >
            Esta información
            aparece en las
            facturas y
            cotizaciones.
          </p>

          <form
            onSubmit={
              handleSubmit
            }
          >

            <div className="form-grid">

              {/* NOMBRE */}
              <div className="field full">

                <label>
                  Nombre
                </label>

                <input
                  type="text"
                  name="name"
                  value={
                    form.name
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Nombre de la ferretería"
                  required
                />

              </div>

              {/* DIRECCIÓN */}
              <div className="field full">

                <label>
                  Dirección
                </label>

                <input
                  type="text"
                  name="address"
                  value={
                    form.address
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Dirección del negocio"
                  required
                />

              </div>

              {/* TELÉFONO */}
              <div className="field">

                <label>
                  Teléfono
                </label>

                <input
                  type="text"
                  name="phone"
                  value={
                    form.phone
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Teléfono"
                  required
                />

              </div>

              {/* MONEDA */}
              <div className="field">

                <label>
                  Símbolo de moneda
                </label>

                <input
                  type="text"
                  name="currency"
                  value={
                    form.currency
                  }
                  onChange={
                    handleChange
                  }
                  maxLength={4}
                  placeholder="L"
                  required
                />

              </div>

              {/* ISV */}
              <div className="field">

                <label>
                  Tasa ISV (%)
                </label>

                <input
                  type="number"
                  name="taxRate"
                  min="0"
                  max="100"
                  step="0.5"
                  value={
                    form.taxRate
                  }
                  onChange={
                    handleChange
                  }
                  required
                />

              </div>

            </div>

            <div
              className="toolbar"
              style={{
                marginTop: 16,
                gap: 10,
              }}
            >

              <button
                type="submit"
                className="btn btn-primary btn-lg"
              >
                Guardar cambios
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-lg"
                onClick={
                  handleRestoreForm
                }
              >
                Deshacer cambios
              </button>

            </div>

          </form>

        </div>

        <hr className="divider" />

        {/* VISTA PREVIA */}
        <div className="config-section">

          <h3>
            Vista previa
          </h3>

          <p
            className="sub"
            style={{
              marginBottom:
                16,
            }}
          >
            Así se utilizarán
            estos datos dentro
            del sistema.
          </p>

          <div
            className="card"
            style={{
              padding: 18,
              background:
                "var(--cream)",
            }}
          >

            <div
              style={{
                display:
                  "flex",

                alignItems:
                  "center",

                gap: 14,
              }}
            >

              <div
                style={{
                  width: 48,
                  height: 48,

                  borderRadius:
                    12,

                  display:
                    "flex",

                  alignItems:
                    "center",

                  justifyContent:
                    "center",

                  background:
                    "var(--orange-light)",

                  fontSize: 24,
                }}
              >
                🔧
              </div>

              <div>

                <strong
                  style={{
                    display:
                      "block",

                    fontSize: 18,
                  }}
                >
                  {form.name ||
                    "Ferretería"}
                </strong>

                <span
                  style={{
                    display:
                      "block",

                    color:
                      "var(--steel)",

                    marginTop: 3,
                  }}
                >
                  {form.address ||
                    "Dirección"}
                </span>

                <span
                  style={{
                    display:
                      "block",

                    color:
                      "var(--steel)",

                    marginTop: 2,
                  }}
                >
                  Tel:{" "}
                  {form.phone ||
                    "—"}
                </span>

              </div>

            </div>

            <div
              style={{
                marginTop: 18,

                paddingTop:
                  14,

                borderTop:
                  "1px solid var(--line)",

                display:
                  "flex",

                gap: 24,

                flexWrap:
                  "wrap",
              }}
            >

              <div>

                <span
                  style={{
                    display:
                      "block",

                    fontSize: 11,

                    color:
                      "var(--steel)",

                    textTransform:
                      "uppercase",
                  }}
                >
                  Moneda
                </span>

                <strong>
                  {form.currency ||
                    "L"}
                </strong>

              </div>

              <div>

                <span
                  style={{
                    display:
                      "block",

                    fontSize: 11,

                    color:
                      "var(--steel)",

                    textTransform:
                      "uppercase",
                  }}
                >
                  ISV
                </span>

                <strong>
                  {form.taxRate ||
                    0}
                  %
                </strong>

              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  )
}

export default Settings