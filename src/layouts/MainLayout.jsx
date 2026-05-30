import Sidebar from "../components/Sidebar"
import Navbar from "../components/Navbar"

function MainLayout({ children }) {
  return (
    <div className="flex">

      <Sidebar />

      <div className="flex-1 ml-64 bg-gray-100 min-h-screen">

        <Navbar />

        <div className="p-6">
          {children}
        </div>

      </div>

    </div>
  )
}

export default MainLayout