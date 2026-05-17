import { useEffect, useState } from "react";
import type { ItemsPerPage } from "@/components/ui/table-pagination";

const VALID: readonly ItemsPerPage[] = [10, 20, 50] as const;
const STORAGE_PREFIX = "gla:pageSize:";

function readStored(key: string, fallback: ItemsPerPage): ItemsPerPage {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return fallback;
    const parsed = Number(raw);
    return (VALID as readonly number[]).includes(parsed)
      ? (parsed as ItemsPerPage)
      : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Per-table page-size state that survives navigation, tab switches, and reloads.
 *
 * Every table that wants persistence picks its own storage key (e.g.
 * "operations.tripsOverview") so two tables don't fight over the same value.
 */
export function usePersistentPageSize(
  key: string,
  fallback: ItemsPerPage = 20,
): [ItemsPerPage, (next: ItemsPerPage) => void] {
  const [pageSize, setPageSize] = useState<ItemsPerPage>(() =>
    readStored(key, fallback),
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, String(pageSize));
    } catch {
      /* localStorage unavailable — fall back to in-memory state */
    }
  }, [key, pageSize]);

  return [pageSize, setPageSize];
}
