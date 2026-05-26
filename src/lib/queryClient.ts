import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * Compute the API base URL for the frontend.
 *
 * - Dev:  default to relative URLs so the Vite proxy can forward `/api/*` to the backend.
 * - Prod: ALWAYS default to relative URLs so the Vercel rewrites in vercel.json
 *         proxy `/api/*` to the Render backend on the SAME origin as the page.
 *         This keeps the session cookie first-party and avoids Chrome's
 *         third-party-cookie blocking. Only fall back to a direct cross-origin
 *         URL when `VITE_API_URL` is explicitly set (e.g. for staging/preview
 *         deploys that aren't behind the same rewrites).
 *
 * Previously this only used relative URLs when the page origin contained
 * "vercel.app". After a custom domain (app.goldenluxuryauto.com) was added,
 * that check failed and the code fell through to a hard-coded cross-origin
 * backend URL — which made every API call cross-site, turned the session
 * cookie into a third-party cookie, and broke login in Chrome.
 */
const computeApiBaseUrl = () => {
  // Explicit override wins everywhere (staging, ad-hoc testing, etc).
  if (import.meta.env.VITE_API_URL) {
    const url = import.meta.env.VITE_API_URL.replace(/\/$/, "");
    console.log(`[API] Using VITE_API_URL: ${url}`);
    return url;
  }

  // Default: relative URLs. In prod, vercel.json rewrites `/api/*` to the
  // Render backend so the call appears same-origin to the browser. In dev,
  // vite.config.ts proxy does the same thing locally.
  return "";
};

const API_BASE_URL = computeApiBaseUrl();

export const getApiBaseUrl = () => API_BASE_URL;

/**
 * Build a full API URL from a path.
 * - If `API_BASE_URL` is empty, returns a relative path to trigger Vite proxy in dev.
 */
export function buildApiUrl(path: string): string {
  if (!path) {
    return API_BASE_URL;
  }

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  // In development mode, check if VITE_API_URL is incorrectly set to localhost:5000
  // This would break the Vite proxy - warn and use relative URL instead
  if (import.meta.env.DEV && API_BASE_URL === "http://localhost:5000") {
    console.warn(
      "⚠️ [API] VITE_API_URL is set to http://localhost:5000 which bypasses Vite proxy.\n" +
      "   Using relative URL to enable proxy. Set VITE_API_URL to http://localhost:3000 or unset it."
    );
    return normalizedPath; // Use relative URL to trigger Vite proxy
  }

  // If API_BASE_URL is empty, return just the path (relative URL for Vite proxy)
  // Otherwise, prepend the base URL
  return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
}

/**
 * Build URL for file upload endpoints (multipart/form-data).
 * In dev with Vite proxy, the proxy does not forward multipart bodies correctly.
 * This uses the direct backend URL to bypass the proxy for uploads.
 * Use VITE_BACKEND_URL to override (default: http://localhost:3000 in dev).
 */
export function buildUploadApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  // When API_BASE_URL is set, all requests go directly - use normal buildApiUrl
  if (API_BASE_URL) {
    return buildApiUrl(path);
  }
  // In dev with proxy: use direct backend URL for uploads (proxy strips multipart body)
  if (import.meta.env.DEV) {
    // Use IPv4 explicitly on Windows to avoid dual-stack localhost issues.
    // Default port matches backend's dev script (PORT=3000) and Vite proxy target.
    const backendUrl = (import.meta.env.VITE_BACKEND_URL || "http://localhost:3000").replace(/\/$/, "");
    return `${backendUrl}${normalizedPath}`;
  }
  return normalizedPath;
}

/**
 * Convert a Google Cloud Storage URL to a proxy URL to avoid CORS issues.
 * If the URL is not a GCS URL, returns it as-is.
 * 
 * @param url - The GCS URL or any other URL
 * @returns The proxy URL for GCS URLs, or the original URL for non-GCS URLs
 */
export function getProxiedImageUrl(url: string): string {
  if (!url) {
    return url;
  }

  // Normalize GCS URLs: Convert http:// to https:// (GCS only supports https)
  let normalizedUrl = url;
  if (url.startsWith("http://storage.googleapis.com/")) {
    normalizedUrl = url.replace("http://", "https://");
    console.warn(`[IMAGE PROXY] Normalized GCS URL from http to https: ${normalizedUrl.substring(0, 100)}...`);
  }

  // If it's a GCS URL (storage.googleapis.com), proxy it through the backend
  if (normalizedUrl.startsWith("https://storage.googleapis.com/")) {
    const encodedUrl = encodeURIComponent(normalizedUrl);
    const proxyUrl = buildApiUrl(`/api/gcs-image-proxy?url=${encodedUrl}`);
    
    // Debug logging in both dev and production to help diagnose issues
    console.log(`[IMAGE PROXY] Converting GCS URL to proxy:`, {
      original: normalizedUrl.substring(0, 150) + (normalizedUrl.length > 150 ? '...' : ''),
      proxy: proxyUrl.substring(0, 150) + (proxyUrl.length > 150 ? '...' : ''),
      apiBaseUrl: API_BASE_URL || 'relative',
      isProduction: import.meta.env.PROD
    });
    
    return proxyUrl;
  }

  // For other URLs (http/https), return as-is
  // For local paths, use buildApiUrl to proxy through backend
  if (normalizedUrl.startsWith("http://") || normalizedUrl.startsWith("https://")) {
    return normalizedUrl;
  }

  // Local path - use buildApiUrl to proxy through backend
  return buildApiUrl(normalizedUrl.startsWith("/") ? normalizedUrl : `/${normalizedUrl}`);
}

/**
 * Get display URL for an employee document (photo, driver license, car insurance).
 * Handles: Google Drive file ID, direct URL, or JSON array format.
 */
export function getEmployeeDocumentUrl(value: string | null | undefined): string | null {
  if (!value || !value.trim()) return null;
  const trimmed = value.trim();
  // Direct URL
  if (trimmed.startsWith("http")) return trimmed;
  // JSON array format
  try {
    const parsed = JSON.parse(trimmed);
    const arr = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
    const first = arr[0];
    if (first?.url) return first.url;
    if (typeof first?.id === "string") {
      if (first.id.startsWith("http")) return first.id;
      return buildApiUrl(`/api/employees/drive-file?fileId=${encodeURIComponent(first.id)}`);
    }
  } catch {
    // Not JSON, treat as Drive file ID
  }
  // Plain Drive file ID (alphanumeric, no slashes)
  if (trimmed.length > 10 && !trimmed.includes("/")) {
    return buildApiUrl(`/api/employees/drive-file?fileId=${encodeURIComponent(trimmed)}`);
  }
  return null;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/*
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(buildApiUrl(url), {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}
*/


export async function apiRequest(
  method: string,
  path: string,  // Changed from 'url' to 'path' for clarity
  data?: unknown | undefined,
): Promise<Response> {
  // Use buildApiUrl to ensure proper URL construction (respects Vite proxy in dev)
  const fullUrl = buildApiUrl(path);
  console.log('API call to:', fullUrl);  // Debug log (remove later if not needed)

  const res = await fetch(fullUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}


type UnauthorizedBehavior = "returnNull" | "throw";

/**
 * Create a typed React Query `queryFn` that fetches JSON from an API path.
 * Supports optional 401 handling behavior for unauthenticated states.
 */
export const getQueryFn = <T,>({ on401: unauthorizedBehavior }: {
  on401: UnauthorizedBehavior;
}): QueryFunction<T> =>
  async ({ queryKey }) => {
    const [path] = queryKey;
    if (typeof path !== "string") {
      throw new Error("Query keys must include the API path as the first element");
    }

      const fullUrl = buildApiUrl(path);

      // Enhanced logging for mobile and production debugging
      if (typeof window !== 'undefined') {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isProduction = import.meta.env.PROD;

        // Always log in production or on mobile for debugging
        if (isProduction || isMobile) {
          console.log(`[API] Fetching: ${fullUrl}`);
          console.log(`[API] Current origin: ${window.location.origin}`);
          console.log(`[API] API base URL: ${API_BASE_URL || 'relative'}`);
          console.log(`[API] VITE_API_URL env: ${import.meta.env.VITE_API_URL || 'Not set'}`);
          if (isMobile) {
            console.log(`[API] Mobile device detected`);
          }
        }
      }

    // In browsers, `setTimeout` returns a number; in Node it returns a Timeout object.
    // `ReturnType<typeof setTimeout>` works correctly in both environments.
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      // Add timeout to prevent hanging requests (especially on mobile/slow connections)
      const controller = new AbortController();
      timeoutId = setTimeout(() => {
        controller.abort();
      }, 10000); // 10 second timeout

        const res = await fetch(fullUrl, {
          credentials: "include",
          signal: controller.signal,
        });

        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        // Handle 401 for /api/auth/me gracefully (expected when not authenticated)
        if (res.status === 401 && path === "/api/auth/me") {
          // Return undefined user without throwing - this is expected when not authenticated
          return { user: undefined } as T;
        }

        if (unauthorizedBehavior === "returnNull" && res.status === 401) {
          return null as T;
        }

        // Only throw if response is not ok (and not a handled 401)
        if (!res.ok) {
          await throwIfResNotOk(res);
        }

        return await res.json();
      } catch (error) {
        // Clear timeout if error occurs
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        // Enhanced error logging for mobile and production
        if (error instanceof Error && error.name === 'AbortError') {
          console.error(`[API] Request timeout (10s) for ${fullUrl}`);
        }

        // Enhanced error logging for mobile and production
        if (typeof window !== 'undefined') {
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          const isProduction = import.meta.env.PROD;

          if (isMobile || isProduction) {
            console.error(`[API] Fetch error for ${fullUrl}:`, error);
            console.error(`[API] Error details:`, {
              message: error instanceof Error ? error.message : String(error),
              name: error instanceof Error ? error.name : 'Unknown',
              url: fullUrl,
              origin: window.location.origin,
              apiBaseUrl: API_BASE_URL || 'relative',
              viteApiUrl: import.meta.env.VITE_API_URL || 'Not set',
              isMobile,
              isProduction
            });

            // Show user-friendly error message in console for debugging
            if (isProduction) {
              console.error(`\n❌ [API CONNECTION ERROR]`);
              console.error(`   The app cannot connect to the backend API.`);
              console.error(`   Current API URL: ${fullUrl}`);
              console.error(`   Expected: Backend should be accessible at this URL`);
              console.error(`   Solution: Set VITE_API_URL environment variable in Vercel`);
              console.error(`   Expected value: https://luxuryautoportal-replit-1.onrender.com\n`);
            }
          }
        }
        throw error;
      }
    };

/**
 * Retry failed queries only for transient network errors (e.g. ERR_NETWORK_CHANGED).
 * Do not retry on 4xx/5xx or other application errors.
 */
function shouldRetryOnError(failureCount: number, error: unknown): boolean {
  if (failureCount >= 3) return false;
  // Retry on network errors: Failed to fetch, ERR_NETWORK_CHANGED, connection reset, etc.
  if (error instanceof TypeError && error.message === "Failed to fetch") return true;
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("network") || msg.includes("connection") || msg.includes("load failed")) return true;
  }
  return false;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: shouldRetryOnError,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      // Don't throw errors by default - let components handle them
      throwOnError: false,
      // Add timeout to prevent queries from hanging indefinitely
      gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
    },
    mutations: {
      retry: false,
      // Don't throw errors by default
      throwOnError: false,
    },
  },
});
