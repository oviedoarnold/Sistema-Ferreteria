import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

import {AuthProvider} from './context/AuthContext'
import ProductProvider from './context/ProductContext'
import SalesProvider from './context/SalesContext'


ReactDOM.createRoot(document.getElementById('root')).render(

  <React.StrictMode>

    <AuthProvider>
      <ProductProvider>
        <SalesProvider>
          <App />
        </SalesProvider>
      </ProductProvider>
    
    </AuthProvider>

  </React.StrictMode>
)