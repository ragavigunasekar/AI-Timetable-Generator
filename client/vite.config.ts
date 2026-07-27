import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiBaseUrl = env.VITE_API_URL ?? 'http://localhost:4000/api'

  let target = 'http://localhost:4000'
  try {
    const u = new URL(apiBaseUrl)
    target = `${u.protocol}//${u.host}`
  } catch (_) {
    // use default
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
          secure: mode === 'production',
        },
      },
    },
    preview: {
      port: 5173,
      host: true,
    },
    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      target: 'es2020',
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) return 'react-vendor';
              if (id.includes('zustand')) return 'state';
              if (id.includes('axios')) return 'data';
              if (id.includes('jspdf') || id.includes('xlsx')) return 'export';
              if (id.includes('lucide-react')) return 'icons';
              return 'vendor';
            }
            return;
          },
        },
      },
      chunkSizeWarningLimit: 1200,
    },
  }
})
