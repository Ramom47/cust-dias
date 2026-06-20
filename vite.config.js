import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// During `npm run dev`, the React app runs on :5173 and the Anthropic proxy
// (server.js) runs on :8787. Calls to /api are forwarded to the proxy so the
// API key never reaches the browser.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
