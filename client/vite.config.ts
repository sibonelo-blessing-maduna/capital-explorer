import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev proxy sends /api/* to the Express server on :3001 so the browser
// only ever talks to one origin. In production the same Express server
// serves this app's build output directly, so there's no proxy involved.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
