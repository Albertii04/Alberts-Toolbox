import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// @openappstore/* are workspace packages; adm-zip is a small CJS lib we'd otherwise
// have to ship in node_modules (brittle under pnpm). Bundle them all into the
// main/preload output rather than treating them as external, so packaging stays
// self-contained.
const bundleWorkspace = { exclude: ['@openappstore/sdk', '@openappstore/tool-host', 'adm-zip'] }

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(bundleWorkspace)],
    build: {
      rollupOptions: { input: { index: resolve(__dirname, 'src/main/index.ts') } },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin(bundleWorkspace)],
    build: {
      rollupOptions: {
        input: {
          // shell renderer preload (window.shellApi) + per-tool preload (window.toolbox)
          shell: resolve(__dirname, 'src/preload/shell.ts'),
          tool: resolve(__dirname, 'src/preload/tool.ts'),
        },
        // Sandboxed preloads MUST be CommonJS — emit .js (not .mjs).
        output: { format: 'cjs', entryFileNames: '[name].js' },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      rollupOptions: { input: { index: resolve(__dirname, 'src/renderer/index.html') } },
    },
    plugins: [vue(), tailwindcss()],
  },
})
