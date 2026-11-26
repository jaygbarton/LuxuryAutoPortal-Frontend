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

/** Reloads allowed inside one window before we stop, so a truly broken build can't loop. */
const MAX_RELOADS_PER_WINDOW = 2;
const RELOAD_WINDOW_MS = 30_000;

/** One stale-chunk error can reach several handlers (error boundaries + window). */
let reloadInFlight = false;

export function shouldAttemptChunkReload(
  now: number,
  windowStart: number,
  attemptsInWindow: number,
): { allowed: boolean; windowStart: number; attempts: number } {
  const windowActive =
    Number.isFinite(windowStart) && windowStart > 0 && now - windowStart < RELOAD_WINDOW_MS;
  if (!windowActive) {
    // A fresh window: earlier reloads (e.g. from deploys hours ago) no longer count.
    return { allowed: true, windowStart: now, attempts: 1 };
  }
  const attempts = Number.isFinite(attemptsInWindow) ? attemptsInWindow : 0;
  if (attempts >= MAX_RELOADS_PER_WINDOW) {
    return { allowed: false, windowStart, attempts };
  }
  return { allowed: true, windowStart, attempts: attempts + 1 };
}

export function recoverFromStaleChunk(error: unknown): boolean {
  if (typeof window === "undefined" || !isChunkLoadError(error)) {
    return false;
  }

  if (reloadInFlight) {
    return true;
  }

  const now = Date.now();
  let decision: ReturnType<typeof shouldAttemptChunkReload>;
  try {
    decision = shouldAttemptChunkReload(
      now,
      Number(window.sessionStorage.getItem(RECOVERY_SESSION_KEY) || "0"),
      Number(window.sessionStorage.getItem(RECOVERY_COUNT_KEY) || "0"),
    );
    if (!decision.allowed) {
      return false;
    }
    window.sessionStorage.setItem(RECOVERY_SESSION_KEY, String(decision.windowStart));
    window.sessionStorage.setItem(RECOVERY_COUNT_KEY, String(decision.attempts));
  } catch {
    // Storage unavailable: still reload once per page load.
  }

  reloadInFlight = true;

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
