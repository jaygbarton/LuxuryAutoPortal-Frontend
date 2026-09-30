const DOM_RECOVERY_WINDOW_MS = 60_000;

interface DomRecoveryMarker {
  url: string;
  attemptedAt: number;
}

export const DOM_RECOVERY_STORAGE_KEY = "gla:external-dom-recovery";

export function isExternalDomMutationError(error: Error | null): boolean {
  const message = String(error?.message ?? "");
  return (
    message.includes("removeChild") ||
    message.includes("insertBefore") ||
    message.includes("The node to be removed is not a child of this node") ||
    message.includes("The node before which the new node is to be inserted is not a child")
  );
}

export function shouldReloadAfterDomMutation(
  storedMarker: string | null,
  currentUrl: string,
  now = Date.now(),
): boolean {
  if (!storedMarker) return true;

  try {
    const marker = JSON.parse(storedMarker) as Partial<DomRecoveryMarker>;
    return (
      marker.url !== currentUrl ||
      typeof marker.attemptedAt !== "number" ||
      now - marker.attemptedAt > DOM_RECOVERY_WINDOW_MS
    );
  } catch {
    return true;
  }
}

export function createDomRecoveryMarker(currentUrl: string, now = Date.now()): string {
  return JSON.stringify({ url: currentUrl, attemptedAt: now } satisfies DomRecoveryMarker);
}
