import {defineConfig} from "vite";
// export default defineConfig({server:{port:5173,proxy:{"/api":"http://localhost:3001"}}});
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },

  preview: {
    host: "0.0.0.0",
    allowedHosts: [
      "robust-generosity-production-7i7r.up.railway.app",
    ],
  },
});