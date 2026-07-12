import { defineConfig } from "vitest/config"
import { fileURLToPath } from "node:url"

export default defineConfig({
  // Vitest's bundled Vite predates the `node:sqlite` builtin: it strips the
  // `node:` prefix and then tries to resolve a `sqlite` package, and it does
  // not honour an `external` flag for it in the SSR loader. Serve a tiny shim
  // that hands back Node's real built-in module at runtime instead.
  plugins: [
    {
      name: "node-sqlite-shim",
      enforce: "pre",
      resolveId(id) {
        if (id === "node:sqlite" || id === "sqlite") return "\0node-sqlite-shim"
      },
      load(id) {
        if (id === "\0node-sqlite-shim") {
          return `const mod = process.getBuiltinModule("node:sqlite")
            export const DatabaseSync = mod.DatabaseSync
            export const StatementSync = mod.StatementSync
            export default mod
          `
        }
      },
    },
  ],
  test: {
    environment: "happy-dom",
    setupFiles: ["__tests__/setup.ts"],
    include: ["__tests__/unit/**/*.test.ts"],
    globals: false,
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      logger: fileURLToPath(new URL("./__mocks__/logger.ts", import.meta.url)),
      node_helper: fileURLToPath(new URL("./__mocks__/node_helper.ts", import.meta.url)),
    },
  },
})
