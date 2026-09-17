import Tablero from "../components/dashboard/Tablero"
import { useOperacion } from "../hooks/useOperacion"

function Dashboard() {
  return <Tablero operacion={useOperacion()} />
}

export default Dashboard
