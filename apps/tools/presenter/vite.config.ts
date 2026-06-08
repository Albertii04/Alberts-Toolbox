import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base: './' so the built deck loads over file:// inside the shell's
// WebContentsView (assets resolved relative to index.html, not site root).
// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [vue()],
})
