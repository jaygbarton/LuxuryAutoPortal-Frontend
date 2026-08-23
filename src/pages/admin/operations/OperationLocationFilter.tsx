import { createContext, useContext } from "react";

export type OperationLocationFilter = "all" | "slc" | "wilmington";

export const OPERATION_LOCATION_OPTIONS: { value: OperationLocationFilter; label: string }[] = [
  { value: "all", label: "All locations" },
  { value: "slc", label: "SLC" },
  { value: "wilmington", label: "Wilmington" },
];

const OperationLocationFilterContext = createContext<OperationLocationFilter>("all");

export const OperationLocationFilterProvider = OperationLocationFilterContext.Provider;

export function useOperationLocationFilter() {
  return useContext(OperationLocationFilterContext);
}

export function operationLocationMatches(
  filter: OperationLocationFilter,
  values: Array<string | null | undefined>,
) {
  if (filter === "all") return true;

  const haystack = values
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();

  if (!haystack) return false;
  if (filter === "slc") {
    return /\bslc\b/.test(haystack) || haystack.includes("salt lake") || /\but\b/.test(haystack);
  }
  return haystack.includes("wilmington") || haystack.includes("leland") || /\bnc\b/.test(haystack);
}
