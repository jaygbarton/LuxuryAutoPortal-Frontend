/** Search the identifying fields of an option without changing its saved value. */
export function optionKeywords(option: unknown): string[] {
  if (typeof option === "string" || typeof option === "number") return [String(option)];
  if (!option || typeof option !== "object") return [];
  return Object.entries(option).flatMap(([key, value]) => {
    const field = key.replace(/[_\s-]/g, "").toLowerCase();
    if (!/(name|make|model|year|plate|vin|email|phone|department|title|label|code|description|address|city|state|status|^id$|aid$|^value$)/.test(field)) return [];
    return typeof value === "string" || typeof value === "number" ? [String(value)] : [];
  });
}

export function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/** All words must match; order, capitalization, accents and plate/VIN punctuation do not matter. */
export function matchesOption(query: string, ...fields: string[]): boolean {
  if (!query.trim()) return true;
  const text = normalizeSearch(fields.join(" "));
  const compact = text.replace(/[^a-z0-9]/g, "");
  return normalizeSearch(query).split(/\s+/).filter(Boolean).every(
    (word) => text.includes(word) || compact.includes(word.replace(/[^a-z0-9]/g, "")),
  );
}
