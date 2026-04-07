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
      fileName: (format) => {
        if (format === 'cjs') return 'rsimzo.cjs'
        if (format === 'es') return 'rsimzo.mjs'
        return `rsimzo.${format}.js`  // umd
      }
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
    dts({
      // insertTypesEntry: true,
      outDir: 'dist',
      // include: ['src'],
      rollupTypes: true,        // ← merges all types into one file
      // tsconfigPath: './tsconfig.json',
      // compilerOptions: {
      //   moduleResolution: 100, // ModuleResolutionKind.Bundler
      //   baseUrl: '.',
      //   paths: {
      //     '~/*': ['./src/*']  // keep alias working for dts
      //   }
      // }
    })
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
