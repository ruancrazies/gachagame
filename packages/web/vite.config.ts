import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    // Giai đoạn 3: proxy /api sang server Node khi có API.
    port: 5173,
  },
});
