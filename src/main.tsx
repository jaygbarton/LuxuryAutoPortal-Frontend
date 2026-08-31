import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// PDF worker is configured in pdf-config.ts - import it to ensure it runs
// Use dynamic import to prevent blocking app initialization if PDF config fails
// This is non-critical - PDF features will work when needed, just may need to configure worker then
import("@/lib/pdf-config").catch((error) => {
  console.warn("⚠️ [MAIN] Failed to load PDF config (non-critical, app will continue):", error);
  // PDF config is not critical for app initialization, continue anyway
  // PDF components will handle worker configuration when they load
});

// Enhanced error handling for initialization
const rootElement = document.getElementById("root");

if (!rootElement) {
  // Show error in the page if root element is missing
  document.body.innerHTML = `
    <div style="min-height: 100vh; background: #ffffff; display: flex; align-items: center; justify-content: center; padding: 20px; color: #171717; font-family: system-ui, -apple-system, sans-serif;">
      <div style="max-width: 600px; text-align: center;">
        <h1 style="font-size: 24px; margin-bottom: 16px; color: #F2C94C;">Configuration Error</h1>
        <p style="color: #737373; margin-bottom: 24px;">Root element not found. Please check the HTML structure.</p>
      </div>
    </div>
  `;
  throw new Error("Root element not found. Make sure there's a div with id='root' in index.html");
}

// Clear the loading fallback immediately
const loadingFallback = rootElement.querySelector('div[style*="Loading"]');
if (loadingFallback) {
  rootElement.innerHTML = '';
}

// Set a timeout to detect if app is stuck loading (10 seconds)
const loadingTimeout = setTimeout(() => {
  if (rootElement.innerHTML === '' || rootElement.querySelector('#root-loading-timeout')) {
    console.error("⚠️ [MAIN] App initialization timeout - showing error message");
    rootElement.innerHTML = `
      <div id="root-loading-timeout" style="min-height: 100vh; background: #ffffff; display: flex; align-items: center; justify-content: center; padding: 20px; color: #171717; font-family: system-ui, -apple-system, sans-serif;">
        <div style="max-width: 600px; text-align: center;">
          <h1 style="font-size: 24px; margin-bottom: 16px; color: #F2C94C;">Loading Timeout</h1>
          <p style="color: #737373; margin-bottom: 24px;">The application is taking longer than expected to load. Please check your connection and try refreshing.</p>
          <button 
            onclick="window.location.reload()" 
            style="background: #F2C94C; color: #171717; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-weight: 600;"
          >
            Reload Page
          </button>
        </div>
      </div>
    `;
  }
}, 10000);

// Wrap app in error boundary to catch any initialization errors
try {
  const root = createRoot(rootElement);
  
  console.log("✅ [MAIN] React root created, rendering app...");
  
  root.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
  
  // Clear timeout once app renders
  clearTimeout(loadingTimeout);
  console.log("✅ [MAIN] App rendered successfully");
} catch (error) {
  clearTimeout(loadingTimeout);
  console.error("❌ [MAIN] Failed to initialize React app:", error);
  console.error("❌ [MAIN] Error details:", {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    name: error instanceof Error ? error.name : undefined,
  });
  
  // Fallback UI if React fails to initialize
  rootElement.innerHTML = `
    <div style="min-height: 100vh; background: #ffffff; display: flex; align-items: center; justify-content: center; padding: 20px; color: #171717; font-family: system-ui, -apple-system, sans-serif;">
      <div style="max-width: 600px; text-align: center;">
        <h1 style="font-size: 24px; margin-bottom: 16px; color: #F2C94C;">Application Error</h1>
        <p style="color: #737373; margin-bottom: 24px;">Failed to initialize the application. Please refresh the page.</p>
        <button 
          onclick="window.location.reload()" 
          style="background: #F2C94C; color: #171717; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-weight: 600;"
        >
          Reload Page
        </button>
        <div style="margin-top: 24px; padding: 16px; background: #f5f5f5; border: 1px solid #e5e5e5; border-radius: 6px; text-align: left; font-size: 12px; color: #525252;">
          <p><strong>Error:</strong> ${error instanceof Error ? error.message : String(error)}</p>
          <p style="margin-top: 8px;"><strong>User Agent:</strong> ${navigator.userAgent}</p>
          ${error instanceof Error && error.stack ? `<p style="margin-top: 8px;"><strong>Stack:</strong><br><pre style="font-size: 10px; overflow: auto; max-height: 200px;">${error.stack}</pre></p>` : ''}
        </div>
      </div>
    </div>
  `;
}
