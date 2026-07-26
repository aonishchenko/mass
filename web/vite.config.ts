import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Second entry: the subname console. Separate page rather than a route in
    // the app, because it is an owner-only tool that pulls in wallet code the
    // session UI has no reason to ship.
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        "ens-admin": resolve(__dirname, "ens-admin.html"),
      },
    },
  },
  server: {
    // `npm run web:dev` talks to `wrangler dev` on 8788.
    proxy: {
      "/ws": { target: "ws://127.0.0.1:8788", ws: true },
      "/api": { target: "http://127.0.0.1:8788" },
    },
  },
});
