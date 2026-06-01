// electron.vite.config.ts
import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
var __electron_vite_injected_dirname = "/Users/albertmp/Downloads/concep-workshop/apps/shell";
var bundleWorkspace = { exclude: ["@toolbox/sdk", "@toolbox/tool-host"] };
var electron_vite_config_default = defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(bundleWorkspace)],
    build: {
      rollupOptions: { input: { index: resolve(__electron_vite_injected_dirname, "src/main/index.ts") } }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin(bundleWorkspace)],
    build: {
      rollupOptions: {
        input: {
          // shell renderer preload (window.shellApi) + per-tool preload (window.toolbox)
          shell: resolve(__electron_vite_injected_dirname, "src/preload/shell.ts"),
          tool: resolve(__electron_vite_injected_dirname, "src/preload/tool.ts")
        },
        // Sandboxed preloads MUST be CommonJS — emit .js (not .mjs).
        output: { format: "cjs", entryFileNames: "[name].js" }
      }
    }
  },
  renderer: {
    root: resolve(__electron_vite_injected_dirname, "src/renderer"),
    build: {
      rollupOptions: { input: { index: resolve(__electron_vite_injected_dirname, "src/renderer/index.html") } }
    },
    plugins: [vue(), tailwindcss()]
  }
});
export {
  electron_vite_config_default as default
};
