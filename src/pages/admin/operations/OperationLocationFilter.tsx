import { createContext, useContext, type ReactNode } from "react";

export type OperationLocationFilter = "all" | "slc" | "wilmington";

export const OPERATION_LOCATION_OPTIONS: { value: OperationLocationFilter; label: string }[] = [
  { value: "all", label: "All locations" },
  { value: "slc", label: "SLC" },
  { value: "wilmington", label: "Wilmington" },
];

const OperationLocationFilterContext = createContext<OperationLocationFilter>("all");

const ResetLocationContext=createContext<(()=>void)|null>(null);
export function OperationLocationFilterProvider({value,onReset,children}:{value:OperationLocationFilter;onReset?:()=>void;children:ReactNode}) {
  return <OperationLocationFilterContext.Provider value={value}><ResetLocationContext.Provider value={onReset??null}>{children}</ResetLocationContext.Provider></OperationLocationFilterContext.Provider>;
}
export const useResetOperationLocationFilter=()=>useContext(ResetLocationContext);

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
    return haystack.includes("utah") || /\bslc\b/.test(haystack) || haystack.includes("salt lake") || /\but\b/.test(haystack);
  }
  return haystack.includes("wilmington") || haystack.includes("leland") || /\bnc\b/.test(haystack);
}
