import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/frontend/Frontend.ts',
      formats: ['umd'],
      name: 'MMMChoresAlt',
      fileName: () => 'MMM-Chores-Alt.js',
    },
    outDir: '.',
    emptyOutDir: false,
    sourcemap: true,
    minify: 'terser',
    rollupOptions: {
      external: ['logger'],
      output: {
        globals: { logger: 'Log' },
      },
    },
  },
})
