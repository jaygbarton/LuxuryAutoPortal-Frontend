import { CAR_ISSUE_TYPES } from "./types";

/** Renders the categorized car issues as small chips. Fixed CAR_ISSUE_TYPES
 *  get a neutral chip; free-text "Others" values get an amber chip so custom
 *  issues stand out. Shared across the Turo Messages, Car Issues, and
 *  Maintenance tabs so the column looks identical everywhere. */
export function CarIssueTypesCell({
  types,
}: {
  types: string[] | null | undefined;
}) {
  if (!types || types.length === 0) {
    return <span className="text-muted-foreground text-sm">--</span>;
  }
  const fixedSet = new Set<string>(CAR_ISSUE_TYPES);
  return (
    <div className="flex flex-wrap gap-1 max-w-[220px]">
      {types.map((t) => {
        const isOther = !fixedSet.has(t);
        return (
          <span
            key={t}
            className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${
              isOther
                ? "bg-amber-50 text-amber-800 border-amber-200"
                : "bg-gray-100 text-gray-700 border-gray-200"
            }`}
          >
            {t}
          </span>
        );
      })}
    </div>
  );
}
