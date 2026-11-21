import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/dashboard-boletas-ice/',
  plugins: [react()],
})
