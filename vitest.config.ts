import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['__tests__/setup.ts'],
    include: ['__tests__/unit/**/*.test.ts'],
    globals: false,
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      logger: fileURLToPath(new URL('./__mocks__/logger.ts', import.meta.url)),
      node_helper: fileURLToPath(new URL('./__mocks__/node_helper.ts', import.meta.url)),
    },
  },
})
