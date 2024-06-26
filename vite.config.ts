import { resolve } from 'path'
import { defineConfig } from 'vite'
import dts from "vite-plugin-dts";

export default defineConfig({
  resolve: {
    alias: {
      '~': resolve(__dirname, './src'),
    }
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/main.ts'),
      name: 'RsImzoClient',
      formats: ['cjs', 'es', 'umd'],
    }
  },
  plugins: [
    dts({ insertTypesEntry: true })
  ]
})