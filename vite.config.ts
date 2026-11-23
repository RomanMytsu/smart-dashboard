import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

const sassAbstractsPath = fileURLToPath(
  new URL('./src/app/styles/abstracts', import.meta.url),
)

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [react()],
  oxc: {
    target: 'chrome81',
  },
  optimizeDeps: {
    rolldownOptions: {
      transform: {
        target: 'chrome81',
      },
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        loadPaths: [sassAbstractsPath],
        additionalData:
          '@use "variables" as *;\n@use "mixins" as *;\n@use "breakpoints" as *;\n',
      },
    },
  },
  build: {
    target: 'chrome81',
    cssTarget: 'chrome81',
  },
})
