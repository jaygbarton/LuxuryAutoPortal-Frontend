/**
 * The vehicle a client has picked, shared across the client pages: choosing a
 * car on the Dashboard preselects it in "View Stats" (the quick links at the
 * bottom of the Dashboard and Cars pages, and Cars → View Stats), and the
 * other way round.
 *
 * Held in memory and mirrored to localStorage so it survives a reload. It is a
 * convenience, never authorization — every page still checks the id against
 * the client's own cars and falls back when it isn't one of them (e.g. after
 * "View as Client" for someone else).
 */
import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "gla.client.selectedCarId";

const listeners = new Set<() => void>();
let current: number | null | undefined; // undefined = not loaded yet

function parse(raw: string | null): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function read(): number | null {
  if (current === undefined) {
    try {
      current = parse(window.localStorage.getItem(STORAGE_KEY));
    } catch {
      current = null;
    }
  }
  return current;
}

function onStorage(e: StorageEvent) {
  if (e.key !== STORAGE_KEY) return;
  current = parse(e.newValue); // picked in another tab
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void): () => void {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

export function useSelectedClientCarId(): [number | null, (carId: number) => void] {
  const carId = useSyncExternalStore(subscribe, read, () => null);
  const setCarId = useCallback((next: number) => {
    current = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // Storage blocked (private mode): remembered for this visit only.
    }
    listeners.forEach((l) => l());
  }, []);
  return [carId, setCarId];
}
