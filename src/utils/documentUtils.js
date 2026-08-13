import html2canvas from "html2canvas"
import jsPDF from "jspdf"

const LETTER_WIDTH_MM = 215.9
const LETTER_HEIGHT_MM = 279.4

/**
 * Genera y descarga un documento PDF
 * en tamaño carta.
 */
export async function downloadDocumentPDF(
  element,
  fileName = "documento.pdf"
) {
  if (!element) {
    throw new Error(
      "No se encontró el documento para generar el PDF."
    )
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    scrollX: 0,
    scrollY: 0,
    logging: false,
  })

  const imageData = canvas.toDataURL(
    "image/png",
    1.0
  )

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "letter",
  })

  /*
   * Calculamos el tamaño manteniendo
   * la proporción original.
   */
  const canvasRatio =
    canvas.height / canvas.width

  let imageWidth = LETTER_WIDTH_MM
  let imageHeight =
    imageWidth * canvasRatio

  /*
   * Si por alguna razón el documento
   * supera el alto de una hoja carta,
   * lo reducimos proporcionalmente.
   */
  if (imageHeight > LETTER_HEIGHT_MM) {
    imageHeight = LETTER_HEIGHT_MM
    imageWidth =
      imageHeight / canvasRatio
  }

  /*
   * Centramos horizontalmente.
   */
  const x =
    (LETTER_WIDTH_MM - imageWidth) / 2

  pdf.addImage(
    imageData,
    "PNG",
    x,
    0,
    imageWidth,
    imageHeight
  )

  const finalFileName =
    fileName
      .toLowerCase()
      .endsWith(".pdf")
      ? fileName
      : `${fileName}.pdf`

  pdf.save(finalFileName)
}

/**
 * Obtiene las hojas CSS cargadas
 * actualmente por React/Vite.
 */
function getDocumentStyles() {
  const styleTags = Array.from(
    document.querySelectorAll("style")
  )
    .map(
      (style) =>
        `<style>${style.innerHTML}</style>`
    )
    .join("\n")

  const styleLinks = Array.from(
    document.querySelectorAll(
      'link[rel="stylesheet"]'
    )
  )
    .map(
      (link) =>
        `<link rel="stylesheet" href="${link.href}">`
    )
    .join("\n")

  return `
    ${styleLinks}
    ${styleTags}
  `
}

/**
 * Imprime únicamente el documento,
 * sin navbar, sidebar, modal ni
 * resto de la aplicación.
 */
export function printDocumentOnePage(
  element,
  title = "Documento"
) {
  if (!element) {
    throw new Error(
      "No se encontró el documento para imprimir."
    )
  }

  const iframe =
    document.createElement("iframe")

  iframe.setAttribute(
    "title",
    "Vista de impresión"
  )

  iframe.style.position = "fixed"
  iframe.style.right = "0"
  iframe.style.bottom = "0"
  iframe.style.width = "0"
  iframe.style.height = "0"
  iframe.style.border = "0"
  iframe.style.visibility = "hidden"

  document.body.appendChild(iframe)

  const printWindow =
    iframe.contentWindow

  const printDocument =
    iframe.contentDocument ||
    printWindow?.document

  if (!printWindow || !printDocument) {
    iframe.remove()

    throw new Error(
      "No se pudo preparar la impresión."
    )
  }

  const styles = getDocumentStyles()

  printDocument.open()

  printDocument.write(`
    <!DOCTYPE html>

    <html lang="es">
      <head>
        <meta charset="UTF-8" />

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />

        <title>${title}</title>

        ${styles}

        <style>
          @page {
            size: letter portrait;
            margin: 0;
          }

          html,
          body {
            margin: 0 !important;
            padding: 0 !important;

            width: 100% !important;
            height: 100% !important;

            background: #ffffff !important;

            overflow: hidden !important;
          }

          body {
            display: flex !important;
            justify-content: center !important;
            align-items: flex-start !important;
          }

          .document-print-container {
            width: 8.5in !important;
            height: 11in !important;

            margin: 0 !important;
            padding: 0 !important;

            background: #ffffff !important;

            overflow: hidden !important;

            box-sizing: border-box !important;
          }

          .document-print-container .receipt {
            width: 8.5in !important;
            max-width: 8.5in !important;

            height: 11in !important;
            min-height: 11in !important;
            max-height: 11in !important;

            margin: 0 !important;

            box-shadow: none !important;
            border-radius: 0 !important;

            box-sizing: border-box !important;

            overflow: hidden !important;
          }

          .document-print-container
          .document-letter {
            display: flex !important;
            flex-direction: column !important;
          }

          .document-print-container
          .inv-table-wrap {
            flex: 1 1 auto !important;
            min-height: 0 !important;
          }

          .document-print-container
          .inv-footer {
            margin-top: auto !important;
          }

          .inv-header,
          .inv-stripe,
          .inv-footer,
          .inv-pending,
          .inv-grand {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        </style>
      </head>

      <body>
        <div class="document-print-container">
          ${element.innerHTML}
        </div>
      </body>
    </html>
  `)

  printDocument.close()

  const startPrint = () => {
    window.setTimeout(() => {
      try {
        printWindow.focus()
        printWindow.print()
      } finally {
        window.setTimeout(() => {
          iframe.remove()
        }, 1000)
      }
    }, 350)
  }

  if (
    printDocument.readyState === "complete"
  ) {
    startPrint()
  } else {
    iframe.onload = startPrint
  }
}