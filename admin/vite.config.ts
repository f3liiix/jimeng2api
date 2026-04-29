import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: "admin",
  base: "/admin/",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "../dist-admin",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1024,
  },
  server: {
    port: 5173,
    proxy: {
      "/admin/api": "http://localhost:5100",
    },
  },
});
