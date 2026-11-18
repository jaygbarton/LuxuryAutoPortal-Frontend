/** Vehicle grouping and filter helpers shared by Our Fleet and the booking page. */
export type SeatFilterOption = "-5" | "5" | "7" | "8" | "10+";
export const SEAT_OPTIONS: SeatFilterOption[] = ["-5", "5", "7", "8", "10+"];

export const PLACEHOLDER_IMG =
  "https://images.unsplash.com/photo-1544636331-e26879cd4d9b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80";

/** Treat placeholder/junk values ("No Data", "N/A", "--", "") as empty so the
 *  card sub-line is hidden instead of showing "No Data · No Data". */
export function cleanVal(v: string | null | undefined): string {
  const s = (v ?? "").trim();
  if (!s) return "";
  return /^(no data|n\/a|na|--|-|none|null|undefined)$/i.test(s) ? "" : s;
}

export function vehicleType(car: { make?: string | null; model?: string | null; makeModel?: string | null; name?: string | null }): string {
  const label = `${car.make ?? ""} ${car.model ?? ""} ${car.makeModel ?? car.name ?? ""}`.toLowerCase();
  if (/\b(tacoma|f-150|f150|silverado|sierra|ram|gladiator|truck)\b/.test(label)) return "Truck";
  if (/\b(sprinter|odyssey|voyager|sienna|carnival|pacifica|van)\b/.test(label)) return "Van";
  if (/\b(accord|camry|sonata|malibu|passat|altima|charger|sedan)\b/.test(label)) return "Sedan";
  if (/\b(mdx|q5|x2|x5|x6|enclave|escalade|yukon|tahoe|suburban|acadia|equinox|trax|telluride|grand cherokee|defender|range rover|outback|rav4|sequoia|expedition|navigator|bronco|wrangler|hummer|terrain|santa fe|suv)\b/.test(label)) return "SUV";
  return "Other";
}

export function toggleValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

export function seatBucket(seats: number | null | undefined): SeatFilterOption | null {
  if (seats == null) return null;
  if (seats < 5) return "-5";
  if (seats >= 10) return "10+";
  if (seats === 5 || seats === 7 || seats === 8) return String(seats) as SeatFilterOption;
  return null;
}
