import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const here = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],

  /*
    .env.local sits at the top of the repository, not in this folder, so that
    both sites read one set of Supabase keys. Without this Vite looks only in
    the app's own directory, finds nothing, and quietly builds a bundle with
    no database in it at all — the app still runs, on browser storage, and
    every counter sees an empty catalogue of its own.
  */
  envDir: resolve(here, '../..'),

  server: { port: 5173, open: false },
})
