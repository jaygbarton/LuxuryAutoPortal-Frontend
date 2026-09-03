/** 17-char VIN (excludes I, O, Q). */
const VIN_RE = /\b[A-HJ-NPR-Z0-9]{17}\b/gi;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * One label for operations cards: "Make Model Year - Plate".
 * Stored inspection names sometimes already include plate/VIN suffixes, and
 * the card header also appends plate — that produced mismatched titles.
 */
export function formatUniformCarLabel(
  rawName: string | null | undefined,
  plate?: string | null,
): string {
  const plateNorm = (plate ?? "").trim();
  let name = (rawName ?? "").replace(/\s+/g, " ").trim();
  if (!name && !plateNorm) return "--";

  name = name.replace(VIN_RE, " ").replace(/\s+/g, " ").trim();
  if (plateNorm) {
    name = name
      .replace(
        new RegExp(`(?:^|[\\s\\-·,]+)${escapeRegExp(plateNorm)}(?=$|[\\s\\-·,])`, "ig"),
        " ",
      )
      .replace(/\s+/g, " ")
      .trim();
  }
  name = name.replace(/[\s]*[-·,]+[\s]*/g, " ").replace(/\s+/g, " ").trim();

  const throughYear = name.match(/^(.*?\b(?:19|20)\d{2}\b)/);
  if (throughYear) name = throughYear[1].trim();

  if (name && plateNorm) {
    if (name.toUpperCase().includes(plateNorm.toUpperCase())) return name;
    return `${name} - ${plateNorm}`;
  }
  return name || plateNorm || "--";
}
