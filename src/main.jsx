import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/ferreteria.css'
import './index.css'

import {AuthProvider} from './context/AuthContext'
import ProductProvider from './context/ProductContext'
import SalesProvider from './context/SalesContext'
import ClientsProvider from './context/ClientsContext'


ReactDOM.createRoot(document.getElementById('root')).render(

  <React.StrictMode>

    <AuthProvider>
      <ProductProvider>
        <ClientsProvider>
          <SalesProvider>
            <App />
          </SalesProvider>
        </ClientsProvider>
      </ProductProvider>
    </AuthProvider>

  </React.StrictMode>
)