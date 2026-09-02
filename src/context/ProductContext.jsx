import { useCallback, useEffect, useMemo, useState } from "react"

import { ProductContext } from "./contexts"
import { useAuth } from "../hooks/useAuth"

import {
  traerProductos,
  crearProducto,
  actualizarProducto,
  desactivarProducto,
  traerProveedores,
  crearProveedor,
  actualizarProveedor,
  eliminarProveedor,
  traerEmpresa,
  actualizarEmpresa,
} from "../lib/api/catalogos"

function ProductProvider({ children }) {
  const { user } = useAuth()

  const [products, setProducts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [company, setCompanyState] = useState(null)
  const [empresaCargada, setEmpresaCargada] = useState(null)
  const [error, setError] = useState("")

  const empresaId = user?.empresa_id
  const usuarioId = user?.id

  /*
    Se deriva en lugar de encenderse dentro del efecto: mientras la empresa
    del usuario no coincida con la ya cargada, la pantalla está esperando.
  */
  const cargando = Boolean(empresaId) && empresaCargada !== empresaId

  const recargar = useCallback(async () => {
    const [listaProductos, listaProveedores, datosEmpresa] = await Promise.all([
      traerProductos(),
      traerProveedores(),
      traerEmpresa(),
    ])

    return { listaProductos, listaProveedores, datosEmpresa }
  }, [])

  useEffect(() => {
    if (!empresaId) {
      return
    }

    let vigente = true

    recargar()
      .then(({ listaProductos, listaProveedores, datosEmpresa }) => {
        if (!vigente) return

        setProducts(listaProductos)
        setSuppliers(listaProveedores)
        setCompanyState(datosEmpresa)
        setError("")
      })
      .catch((e) => {
        if (vigente) setError(e.message)
      })
      .finally(() => {
        if (vigente) setEmpresaCargada(empresaId)
      })

    return () => {
      vigente = false
    }
  }, [empresaId, recargar])

  const refrescarProductos = useCallback(async () => {
    setProducts(await traerProductos())
  }, [])

  const agregarProducto = useCallback(
    async (producto) => {
      await crearProducto(producto, empresaId, usuarioId)
      await refrescarProductos()
    },
    [empresaId, usuarioId, refrescarProductos]
  )

  const editarProducto = useCallback(
    async (id, producto) => {
      const anterior = products.find((p) => String(p.id) === String(id))

      await actualizarProducto(id, producto, {
        empresaId,
        usuarioId,
        stockAnterior: anterior?.stock ?? 0,
      })

      await refrescarProductos()
    },
    [products, empresaId, usuarioId, refrescarProductos]
  )

  const quitarProducto = useCallback(
    async (id) => {
      await desactivarProducto(id)
      await refrescarProductos()
    },
    [refrescarProductos]
  )

  const refrescarProveedores = useCallback(async () => {
    setSuppliers(await traerProveedores())
  }, [])

  const agregarProveedor = useCallback(
    async (proveedor) => {
      await crearProveedor(proveedor, empresaId)
      await refrescarProveedores()
    },
    [empresaId, refrescarProveedores]
  )

  const editarProveedor = useCallback(
    async (id, proveedor) => {
      await actualizarProveedor(id, proveedor, empresaId)
      await refrescarProveedores()
    },
    [empresaId, refrescarProveedores]
  )

  const quitarProveedor = useCallback(
    async (id) => {
      await eliminarProveedor(id)
      await refrescarProveedores()
    },
    [refrescarProveedores]
  )

  const setCompany = useCallback(
    async (datos) => {
      await actualizarEmpresa(company?.id, datos)
      setCompanyState(await traerEmpresa())
    },
    [company]
  )

  const value = useMemo(
    () => ({
      products,
      suppliers,
      company,
      cargando,
      error,

      agregarProducto,
      editarProducto,
      quitarProducto,
      refrescarProductos,

      agregarProveedor,
      editarProveedor,
      quitarProveedor,

      setCompany,
    }),
    [
      products,
      suppliers,
      company,
      cargando,
      error,
      agregarProducto,
      editarProducto,
      quitarProducto,
      refrescarProductos,
      agregarProveedor,
      editarProveedor,
      quitarProveedor,
      setCompany,
    ]
  )

  return (
    <ProductContext.Provider value={value}>
      {children}
    </ProductContext.Provider>
  )
}

export default ProductProvider
