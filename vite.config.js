import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ⚠️ Change 'lumina-auth' to match YOUR GitHub repository name exactly
export default defineConfig({
  plugins: [react()],
  base: '/teja_dashboard/',
})
