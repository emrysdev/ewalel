
import { defineConfig } from "vite";

export default defineConfig({
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
