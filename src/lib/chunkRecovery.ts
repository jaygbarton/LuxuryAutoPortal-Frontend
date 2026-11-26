const RECOVERY_SESSION_KEY = "gla:chunk-recovery-attempt";
const RECOVERY_COUNT_KEY = "gla:chunk-recovery-count";

const CHUNK_ERROR_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /loading chunk \d+ failed/i,
  /error loading dynamically imported module/i,
];

export function isChunkLoadError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : String((error as any)?.message || "");

  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export function recoverFromStaleChunk(error: unknown): boolean {
  if (typeof window === "undefined" || !isChunkLoadError(error)) {
    return false;
  }

  const now = Date.now();
  const lastAttempt = Number(window.sessionStorage.getItem(RECOVERY_SESSION_KEY) || "0");
  const attemptCount = Number(window.sessionStorage.getItem(RECOVERY_COUNT_KEY) || "0");

  if (Number.isFinite(lastAttempt) && now - lastAttempt < 5_000 && attemptCount > 2) {
    return false;
  }

  window.sessionStorage.setItem(RECOVERY_SESSION_KEY, String(now));
  window.sessionStorage.setItem(RECOVERY_COUNT_KEY, String(attemptCount + 1));

  if ("caches" in window) {
    window.caches.keys()
      .then((keys) => Promise.all(keys.map((key) => window.caches.delete(key))))
      .catch(() => undefined);
  }

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("appRefresh", String(now));
  window.location.replace(nextUrl.toString());
  return true;
}

export function attachStaleChunkRecoveryHandler(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.addEventListener("unhandledrejection", (event) => {
    if (recoverFromStaleChunk(event.reason)) {
      event.preventDefault();
    }
  });

  window.addEventListener("error", (event) => {
    if (recoverFromStaleChunk(event.error || event.message)) {
      event.preventDefault();
    }
  });
}
