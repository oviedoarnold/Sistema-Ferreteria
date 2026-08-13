import {
  useRef,
  useState,
} from "react"

import Swal from "sweetalert2"

import {
  downloadDocumentPDF,
  printDocumentOnePage,
} from "../../utils/documentUtils"

function DocumentPreviewModal({
  open,
  title = "Vista previa",
  fileName = "documento.pdf",
  printTitle = "Documento",
  children,
  onClose,
  onConfirm,
  confirmLabel = "Confirmar",
  canExport = true,
}) {
  const documentRef = useRef(null)

  const [
    generatingPdf,
    setGeneratingPdf,
  ] = useState(false)

  if (!open) {
    return null
  }

  const handleDownload = async () => {
    if (!documentRef.current) {
      Swal.fire({
        icon: "warning",
        title: "Documento no disponible",
        text: "No se encontró el documento para generar el PDF.",
      })

      return
    }

    try {
      setGeneratingPdf(true)

      await downloadDocumentPDF(
        documentRef.current,
        fileName
      )
    } catch (error) {
      console.error(error)

      Swal.fire({
        icon: "warning",
        title: "No se pudo generar el PDF",
        text:
          'Puedes utilizar el botón "Imprimir" y seleccionar "Guardar como PDF".',
      })
    } finally {
      setGeneratingPdf(false)
    }
  }

  const handlePrint = () => {
    if (!documentRef.current) {
      Swal.fire({
        icon: "warning",
        title: "Documento no disponible",
        text: "No se encontró el documento para imprimir.",
      })

      return
    }

    try {
      printDocumentOnePage(
        documentRef.current,
        printTitle
      )
    } catch (error) {
      console.error(error)

      Swal.fire({
        icon: "error",
        title: "No se pudo imprimir",
        text:
          error.message ||
          "Ocurrió un error al preparar la impresión.",
      })
    }
  }

  return (
    <div
      className="modal-overlay open"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose?.()
        }
      }}
    >
      <div className="modal modal-document">
        <div className="modal-head">
          <h3>{title}</h3>

          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            title="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="modal-body document-preview-body">
          <div className="receipt-wrap">
            <div ref={documentRef}>
              {children}
            </div>
          </div>
        </div>

        <div className="modal-foot">
          {onConfirm && (
            <button
              type="button"
              className="btn btn-success"
              onClick={onConfirm}
            >
              ✓ {confirmLabel}
            </button>
          )}

          {canExport && (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleDownload}
                disabled={generatingPdf}
              >
                {generatingPdf
                  ? "Generando PDF..."
                  : "⬇ Descargar PDF"}
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handlePrint}
              >
                🖨 Imprimir
              </button>
            </>
          )}

          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

export default DocumentPreviewModal