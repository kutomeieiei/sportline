import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');

  // Filter only VITE_ variables to expose to the client via process.env
  // This ensures a fallback if import.meta.env is not working as expected
  const clientEnv = Object.keys(env).reduce((acc, key) => {
    if (key.startsWith('VITE_')) {
      acc[key] = env[key];
    }
    return acc;
  }, {} as Record<string, string>);

  return {
    plugins: [react()],
    define: {
      // Polyfill process.env for robust access
      'process.env': clientEnv,
      // Helper for GenAI SDK or other libs expecting this specific key
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.VITE_GOOGLE_MAPS_API_KEY),
    }
  }
})