/*
  Las vistas del Dashboard. Es navegación dentro de la misma página: cambia
  qué se muestra, no la dirección, y conserva los filtros.
*/
function NavegacionDelTablero({ vistas, activa, onCambiar }) {
  return (
    <div className="tablero-vistas" role="tablist" aria-label="Vistas del Dashboard">
      {vistas.map((vista) => (
        <button
          key={vista.id}
          type="button"
          role="tab"
          id={`pestana-${vista.id}`}
          aria-selected={vista.id === activa}
          aria-controls={`vista-${vista.id}`}
          className={vista.id === activa ? "activa" : undefined}
          onClick={() => onCambiar(vista.id)}
        >
          {vista.etiqueta}
        </button>
      ))}
    </div>
  )
}

export default NavegacionDelTablero
