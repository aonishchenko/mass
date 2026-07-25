import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: "dist", emptyOutDir: true },
  server: {
    // `npm run web:dev` talks to `wrangler dev` on 8788.
    proxy: {
      "/ws": { target: "ws://127.0.0.1:8788", ws: true },
      "/api": { target: "http://127.0.0.1:8788" },
    },
  },
});
