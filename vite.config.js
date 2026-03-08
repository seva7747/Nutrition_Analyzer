import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'opennote-resolver',
      resolveId(id) {
        if (id === 'opennote') {
          return { id: 'opennote', external: true }
        }
      },
    },
  ],
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      external: ['opennote'],
    },
  },
  optimizeDeps: {
    exclude: ['opennote'],
  },
})
