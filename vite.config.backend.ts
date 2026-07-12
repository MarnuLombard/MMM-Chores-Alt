import { defineConfig } from "vite"

export default defineConfig({
  build: {
    lib: {
      entry: "src/backend/index.ts",
      formats: ["cjs"],
      fileName: () => "node_helper.js",
    },
    outDir: ".",
    emptyOutDir: false,
    sourcemap: true,
    minify: "terser",
    target: "node24",
    rollupOptions: {
      external: [
        "node_helper",
        "logger",
        "node:sqlite",
        "node-cron",
        "node:path",
        "path",
        "node:fs",
        "fs",
      ],
    },
  },
  ssr: { noExternal: [] },
})
