import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // `npm run dev` opens the home page (landing page) in your browser
  server: { port: 5173, open: '/' },
});
