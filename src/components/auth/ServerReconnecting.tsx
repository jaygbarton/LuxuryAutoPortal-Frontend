import { useEffect, useRef } from "react";

/**
 * Shown when the very first /api/auth/me check failed with something other
 * than "not signed in" (a 502 while the backend redeploys, Render waking up, a
 * network flap). The session is fine, so this retries by itself with backoff
 * and the page carries on as soon as the server answers.
 *
 * It used to be a bare "could not be checked / Retry" message that waited for
 * a click. Staff read that as being logged out — most often right after the
 * app reloaded itself onto a new frontend build while the backend was
 * redeploying from the same push.
 */
export function ServerReconnecting({
  error,
  isFetching,
  errorUpdateCount,
  onRetry,
}: {
  error: unknown;
  isFetching: boolean;
  /** React Query's errorUpdateCount: drives the backoff (2s, 4s, 8s, then every 15s). */
  errorUpdateCount: number;
  onRetry: () => void;
}) {
  // Callers pass an inline callback; a ref keeps each render from restarting the timer.
  const retryRef = useRef(onRetry);
  retryRef.current = onRetry;
  useEffect(() => {
    if (isFetching) return;
    const delay = Math.min(15_000, 2_000 * 2 ** Math.max(0, errorUpdateCount - 1));
    const timer = setTimeout(() => retryRef.current(), delay);
    return () => clearTimeout(timer);
  }, [isFetching, errorUpdateCount]);

  return (
    <div className="min-h-screen bg-card flex items-center justify-center px-6">
      <div className="flex flex-col items-center gap-4 text-center" role="status">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-foreground font-medium">Reconnecting to the server…</p>
        <p className="text-muted-foreground text-sm max-w-sm">
          You're still signed in. The server is briefly unavailable (usually an update being installed), and
          this page will continue by itself in a moment.
        </p>
        <p className="text-muted-foreground text-xs">
          {error instanceof Error ? error.message : "Server temporarily unavailable"}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Try again now
        </button>
      </div>
    </div>
  );
}
