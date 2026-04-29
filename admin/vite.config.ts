import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "admin",
  base: "/admin/",
  plugins: [react()],
  build: {
    outDir: "../dist-admin",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/admin/api": "http://localhost:5100",
    },
  },
});
