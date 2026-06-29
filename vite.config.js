import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base must match the GitHub Pages repo name so asset URLs resolve at
// https://<user>.github.io/ChessAnalysis/
export default defineConfig({
  base: '/ChessAnalysis/',
  plugins: [react()],
})
