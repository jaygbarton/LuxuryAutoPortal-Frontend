import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react({
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  optimizeDeps: {
    include: ["qrcode.react"],
    esbuildOptions: {
      target: "es2022", // Support top-level await for pdfjs-dist v4.x
    },
  },
  css: {
    postcss: "./postcss.config.cjs",
  },
  build: {
    target: "es2022", // Support top-level await for pdfjs-dist v4.x
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  server: {
    port: 5000, // Use port 5000 to show in Replit Preview (maps to external port 80)
    host: "localhost", // Listen on all network interfaces
    open: false, // Don't auto-open browser
    strictPort: false, // Allow port fallback if busy
    // Allow all hosts for Replit (hostnames are dynamic like *.replit.dev)
    // This is safe because:
    // 1. It only affects the dev server (not production builds)
    // 2. Replit provides secure isolation between projects
    // 3. Dynamic hostnames make it impractical to whitelist specific hosts
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: "localhost",
        cookiePathRewrite: "/",
        // No timeout - allow long-running operations like imports
        ws: true, // Enable WebSocket proxying
        configure: (proxy, _options) => {
          proxy.on("error", (err, _req, res) => {
            console.error("Proxy error:", err.message);
            if (res && !res.headersSent) {
              res.writeHead(500, {
                "Content-Type": "application/json",
              });
              res.end(
                JSON.stringify({
                  success: false,
                  error: "Backend server is not available. Please ensure the backend server is running on port 3000.",
                  details: process.env.NODE_ENV === "development" ? err.message : undefined,
                })
              );
            }
          });
          proxy.on("proxyReq", (proxyReq, req, _res) => {
            console.log(`[Proxy] ${req.method} ${req.url} -> http://localhost:3000${req.url}`);
          });
        },
      },
      "/contracts": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
        // No timeout - allow long-running operations
        ws: true,
        configure: (proxy, _options) => {
          proxy.on("error", (err, _req, res) => {
            console.error("Proxy error (contracts):", err.message);
            if (res && !res.headersSent) {
              res.writeHead(500, {
                "Content-Type": "application/json",
              });
              res.end(
                JSON.stringify({
                  success: false,
                  error: "Backend server is not available.",
                })
              );
            }
          });
        },
      },
      "/signed-contracts": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
        // No timeout - allow long-running operations
        ws: true,
        configure: (proxy, _options) => {
          proxy.on("error", (err, _req, res) => {
            console.error("Proxy error (signed-contracts):", err.message);
            if (res && !res.headersSent) {
              res.writeHead(500, {
                "Content-Type": "application/json",
              });
              res.end(
                JSON.stringify({
                  success: false,
                  error: "Backend server is not available.",
                })
              );
            }
          });
        },
      },
      "/car-photos": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
        // No timeout - allow long-running operations
        ws: true,
        configure: (proxy, _options) => {
          proxy.on("error", (err, _req, res) => {
            console.error("Proxy error (car-photos):", err.message);
            if (res && !res.headersSent) {
              res.writeHead(500, {
                "Content-Type": "application/json",
              });
              res.end(
                JSON.stringify({
                  success: false,
                  error: "Backend server is not available.",
                })
              );
            }
          });
        },
      },
      "/income-expense-images": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
        // No timeout - allow long-running operations
        ws: true,
        configure: (proxy, _options) => {
          proxy.on("error", (err, _req, res) => {
            console.error("Proxy error (income-expense-images):", err.message);
            if (res && !res.headersSent) {
              res.writeHead(500, {
                "Content-Type": "application/json",
              });
              res.end(
                JSON.stringify({
                  success: false,
                  error: "Backend server is not available.",
                })
              );
            }
          });
        },
      },
      "/uploads": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
        ws: false,
        configure: (proxy, _options) => {
          proxy.on("error", (err, _req, res) => {
            console.error("Proxy error (uploads):", err.message);
            if (res && !res.headersSent) {
              (res as any).writeHead(502, { "Content-Type": "text/plain" });
              (res as any).end("File not available");
            }
          });
        },
      },
    },
  },
});
