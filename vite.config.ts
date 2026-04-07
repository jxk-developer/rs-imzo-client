import { resolve } from 'path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  resolve: {
    alias: {
      '~': resolve(__dirname, './src'),
    }
  },
  build: {
    target: 'es2017',
    lib: {
      entry: resolve(__dirname, 'src/main.ts'),
      name: 'RsImzoClient',
      formats: ['cjs', 'es', 'umd'],
      fileName: (format: string) => {
        if (format === 'cjs') return 'rsimzo.cjs'
        if (format === 'es') return 'rsimzo.mjs'
        return `rsimzo.${format}.js`  // umd
      }
    }
  },
  plugins: [
    dts({
      rollupTypes: true
    })
  ],
  esbuild: {
    include: /src\/.*\.[tj]s$/,
    exclude: [],
  }
})
