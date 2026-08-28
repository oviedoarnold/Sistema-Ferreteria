import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],

  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx}'],

    coverage: {
      provider: 'v8',
      // json-summary genera coverage/coverage-summary.json, que el proyecto versiona.
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/main.jsx',
        'src/test/**',
        'src/**/*.{test,spec}.{js,jsx}',
        // Plantillas de impresión: son marcado, se validan mirando el PDF.
        'src/components/InvoiceTemplate.jsx',
        'src/components/QuoteTemplate.jsx',
      ],
    },
  },
})
