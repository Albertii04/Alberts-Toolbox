import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// @toolbox/* are workspace packages — bundle them into main/preload rather than
// treating them as external node_modules, so packaging stays simple.
const bundleWorkspace = { exclude: ['@toolbox/sdk', '@toolbox/tool-host'] }

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
