import type { FuelLevelReturned } from "./types";

/** Fuel-returned chip. Red = empty/quarter (high priority charge-back),
 *  amber = half/three_quarters, green = full, gray = unknown / not recorded.
 *  Shared so the Maintenance tab matches the Car Issues / Turo Messages tabs. */
export function FuelReturnedCell({
  level,
}: {
  level: FuelLevelReturned | null | undefined;
}) {
  const lvl = level ?? "unknown";
  const style =
    lvl === "empty"
      ? "bg-red-100 text-red-800 border-red-200"
      : lvl === "quarter"
        ? "bg-red-50 text-red-700 border-red-200"
        : lvl === "half"
          ? "bg-amber-100 text-amber-800 border-amber-200"
          : lvl === "three_quarters"
            ? "bg-amber-50 text-amber-700 border-amber-200"
            : lvl === "full"
              ? "bg-green-100 text-green-800 border-green-200"
              : "bg-gray-100 text-gray-600 border-gray-200";
  const label =
    lvl === "empty"
      ? "Empty"
      : lvl === "quarter"
        ? "1/4"
        : lvl === "half"
          ? "1/2"
          : lvl === "three_quarters"
            ? "3/4"
            : lvl === "full"
              ? "Full"
              : "—";
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${style}`}
    >
      {label}
    </span>
  );
}
