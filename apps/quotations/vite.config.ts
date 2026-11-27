import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const here = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],

  /* One set of Supabase keys at the top of the repo — see apps/billing. */
  envDir: resolve(here, '../..'),

  /* A different port, so both sites can run side by side while developing. */
  server: { port: 5174, open: false },
})
