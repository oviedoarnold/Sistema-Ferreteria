import { useEffect, useState } from "react"

import { traerProyeccion } from "../lib/api/proyeccion"

/*
  Carga el archivo de la proyección una vez. Si el Dashboard se desmonta
  antes de que llegue, la respuesta tardía se descarta.
*/
export function useProyeccion() {
  const [estado, setEstado] = useState({ datos: null, error: "" })

  useEffect(() => {
    let vigente = true

    traerProyeccion()
      .then((datos) => {
        if (vigente) setEstado({ datos, error: "" })
      })
      .catch((problema) => {
        if (vigente) setEstado({ datos: null, error: problema.message })
      })

    return () => {
      vigente = false
    }
  }, [])

  return estado
}
