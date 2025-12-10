// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { componentTagger } from "lovable-tagger"
import path from "path"

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  publicDir: 'public',
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
    // Add the nodePolyfills plugin here
    nodePolyfills({
      // Options are available, but defaults are usually fine.
      // For example, to exclude certain polyfills:
      // exclude: ['fs'],
      // Whether to polyfill `global`
      globals: {
        Buffer: true, // can also be 'build', 'dev', or false
        global: true,
        process: true,
      },
      // Whether to polyfill modules with `node:` prefix
      protocolImports: true,
    }),
  ].filter(Boolean),
  resolve: {
    // This alias is good practice for imports
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Stub out native modules that can't run in browser
      "usb": path.resolve(__dirname, "./src/lib/empty-module.ts"),
      "node-hid": path.resolve(__dirname, "./src/lib/empty-module.ts"),
    },
  },
  optimizeDeps: {
    exclude: ['usb', 'node-hid', '@ledgerhq/hw-transport-node-hid'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  build: {
    rollupOptions: {
      external: ['usb', 'node-hid'],
    },
  },
}))
