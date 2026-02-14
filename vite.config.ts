import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Polyfill process.env.API_KEY for the GenAI SDK
      // We fall back to VITE_GOOGLE_MAPS_API_KEY if API_KEY isn't explicitly set, 
      // assuming the user might reuse the key for the demo.
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.VITE_GOOGLE_MAPS_API_KEY),
      // Prevent "process is not defined" error in browser
      'process.env': {}
    }
  }
})