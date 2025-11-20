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
    target: 'es2015',
    lib: {
      entry: resolve(__dirname, 'src/main.ts'),
      name: 'RsImzoClient',
      formats: ['cjs', 'es', 'umd'],
      fileName: (format) => `rsimzo-client.${format}.js`
    },
    rollupOptions: {
      output: {
        // globals: {
        //   vue: 'Vue'
        // }
      }
    }
  },
  plugins: [
    dts({ insertTypesEntry: true })
  ],
  esbuild: {
    loader: 'ts',
    include: /src\/.*\.[tj]s$/,
    exclude: [],
    target: 'es6',

    minifyIdentifiers: false,
    minifySyntax: false,
    minifyWhitespace: true
  }
})
