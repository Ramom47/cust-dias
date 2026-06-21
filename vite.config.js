import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// SPA estática — sem back-end. Todo o processamento (montagem das
// deliberações, DOCX e impressão) acontece no navegador.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
