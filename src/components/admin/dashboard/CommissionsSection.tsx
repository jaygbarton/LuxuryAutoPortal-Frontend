import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { formatCurrency } from "@/components/admin/dashboard/utils";
import { useCoHost } from "@/hooks/use-co-host";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Types ────────────────────────────────────────────────────────────────

interface CommissionRow {
  commissions_aid: number;
  commissions_type: string;
  commissions_amount: string;
  commissions_is_paid: number;
  commissions_remarks: string;
  commissions_employee_id: number;
  commissions_date: string;
  commissions_account_owner_name: string;
  commissions_account_owner_id: string;
  commissions_percentage: string;
  commissions_percentage_amount: string;
  fullname?: string;
}

interface CommissionsApiResponse {
  success: boolean;
  data: CommissionRow[];
  total: number;
}

// ── Expense types from PDF ──────────────────────────────────────────────

// Curated display order from the original PDF. Used only to keep the familiar
// column order for these known names — the actual columns are derived from the
// ACTIVE employee list at runtime, so inactive employees (e.g. Olavo) drop off
// and new hires appear automatically. See `useActiveEmployeeNames`.
const PREFERRED_ORDER = ["Bynn", "Jen", "Armando", "Adam", "Olavo", "Matthew", "Cathy"];

const EXPENSE_TYPES = [
  "Parking Airport",
  "Uber & Lyft",
  "Uber Ride",
  "Electric/Gas/Uber - Reimbursed",
  "Ski Rack's",
  "Car Management Split",
  "New Car - Onboard",
  "Relist Car",
  "Annual Inspections",
  "Insurance",
  "Car Registrations",
  "Car Swap",
  "Zero Parking Fee",
  "Invoice",
  "Bouncie",
  "Maintenance",
  "Exit Parking Ticket",
  "Last Minute Commissions",
];

// ── Helpers ──────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from(
  { length: CURRENT_YEAR + 1 - 2023 + 1 },
  (_, i) => String(2023 + i),
);

function getYearRange(year: number): { dateFrom: string; dateTo: string } {
  return { dateFrom: `${year}-01-01`, dateTo: `${year}-12-31` };
}

// Normalize legacy/variant commission type names to the canonical EXPENSE_TYPES labels.
const TYPE_ALIASES: Record<string, string> = {
  "airport":                         "Parking Airport",
  "parking airport":                 "Parking Airport",
  "uber":                            "Uber & Lyft",
  "uber & lyft":                     "Uber & Lyft",
  "electric, gas, uber - reimbursed":"Electric/Gas/Uber - Reimbursed",
  "electric/gas/uber - reimbursed":  "Electric/Gas/Uber - Reimbursed",
  "electric gas uber reimbursed":    "Electric/Gas/Uber - Reimbursed",
  "ski rack":                        "Ski Rack's",
  "ski racks":                       "Ski Rack's",
  "ski rack's":                      "Ski Rack's",
  "new car 1%":                      "Car Management Split",
  "car management split":            "Car Management Split",
  "new car - onboard":               "New Car - Onboard",
  "new car onboard":                 "New Car - Onboard",
  "relist car":                      "Relist Car",
  "annual inspections":              "Annual Inspections",
  "annual inspection":               "Annual Inspections",
  "insurance":                       "Insurance",
  "car registrations":               "Car Registrations",
  "car registration":                "Car Registrations",
  "car swap":                        "Car Swap",
  "zero parking fee":                "Zero Parking Fee",
  "invoice":                         "Invoice",
  "bouncie":                         "Bouncie",
  "maintenance":                     "Maintenance",
  "exit parking ticket":             "Exit Parking Ticket",
  "last minute commissions":         "Last Minute Commissions",
  "last minute":                     "Last Minute Commissions",
};

function normalizeType(raw: string): string {
  const key = raw.trim().toLowerCase();
  return TYPE_ALIASES[key] ?? raw.trim();
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Bucket commission rows by (employee, type, month) for one year, so each
 * employee's table can show all 12 months of the selected year at once.
 */
function buildEmployeeMatrix(
  data: CommissionRow[],
  employeeName: string,
): { matrix: Record<string, number[]>; totals: number[] } {
  const matrix: Record<string, number[]> = {};
  for (const type of EXPENSE_TYPES) matrix[type] = Array(12).fill(0);
  const totals = Array(12).fill(0);

  for (const row of data) {
    const type = normalizeType(row.commissions_type || "");
    const name = row.fullname || row.commissions_account_owner_name || "";
    const amount = parseFloat(row.commissions_amount) || 0;
    if (!matrix[type]) continue; // unknown type — skip

    const isMatch =
      name === employeeName ||
      name.toLowerCase() === employeeName.toLowerCase() ||
      name.toLowerCase().startsWith(employeeName.toLowerCase());
    if (!isMatch) continue;

    const d = new Date(row.commissions_date);
    if (isNaN(d.getTime())) continue;
    const month = d.getMonth();
    matrix[type][month] += amount;
    totals[month] += amount;
  }

  return { matrix, totals };
}

// ── Loading skeleton ─────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {[0, 1].map((i) => (
        <div key={i}>
          <div className="rounded-t-lg bg-black px-4 py-2">
            <div className="h-4 w-32 animate-pulse rounded bg-gray-700" />
          </div>
          <div className="space-y-2 bg-[#111111] p-4">
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className="h-4 animate-pulse rounded bg-gray-700" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Matrix Table ─────────────────────────────────────────────────────────

/** One employee's commission matrix: type rows × 12 month columns, for the selected year. */
function MatrixTable({
  employeeName,
  year,
  data,
}: {
  employeeName: string;
  year: string;
  data: CommissionRow[] | undefined;
}) {
  const rows = data ?? [];
  const { matrix, totals } = buildEmployeeMatrix(rows, employeeName);
  const grandTotal = totals.reduce((s, v) => s + v, 0);

  return (
    <div>
      <h3 className="text-lg font-bold uppercase tracking-wide text-black mb-3">
        {employeeName} — Commissions {year}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full border-y border-[#D3BC8D] border-collapse">
          <thead>
            <tr className="bg-black border-y border-[#D3BC8D]">
              <th className="px-3 py-2 text-center text-xs font-bold uppercase text-white">
                Type
              </th>
              {MONTH_LABELS.map((m) => (
                <th
                  key={m}
                  className="px-3 py-2 text-center text-xs font-bold uppercase text-white"
                >
                  {m}
                </th>
              ))}
              <th className="px-3 py-2 text-center text-xs font-bold uppercase text-white">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {EXPENSE_TYPES.map((type) => {
              const monthly = matrix[type] ?? Array(12).fill(0);
              const typeTotal = monthly.reduce((s, v) => s + v, 0);
              return (
                <tr key={type} className="bg-white border-y border-[#D3BC8D]">
                  <td className="whitespace-nowrap px-3 py-2 text-center text-sm text-gray-900">
                    {type}
                  </td>
                  {monthly.map((val, i) => (
                    <td
                      key={i}
                      className="px-3 py-2 text-center text-sm text-gray-900"
                    >
                      {val ? formatCurrency(val) : "—"}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center text-sm font-semibold text-gray-900">
                    {typeTotal ? formatCurrency(typeTotal) : "—"}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-[#D3BC8D] font-bold border-y border-[#D3BC8D]">
              <td className="px-3 py-2 text-center text-sm text-black">TOTAL</td>
              {totals.map((val, i) => (
                <td key={i} className="px-3 py-2 text-center text-sm text-black">
                  {val > 0 ? formatCurrency(val) : "—"}
                </td>
              ))}
              <td className="px-3 py-2 text-center text-sm text-black">
                {grandTotal > 0 ? formatCurrency(grandTotal) : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Active employee columns ──────────────────────────────────────────────

interface EmployeeApiRow {
  employee_aid?: number;
  employee_first_name?: string;
  employee_last_name?: string;
  employee_is_active?: number;
}

/**
 * Derive the commission table's column names from ACTIVE employees only.
 * Columns are first names (the commission matrix keys on first name). Known
 * names keep the curated PREFERRED_ORDER; any other active employees are
 * appended alphabetically. Inactive employees are excluded entirely — this is
 * the fix for inactive staff (e.g. Olavo) still showing as a column.
 *
 * For co-host sessions the backend already scopes /api/employees to their team,
 * so PREFERRED_ORDER is only used as a loading placeholder for non-co-host
 * (admin) sessions. A co-host with an empty team sees [] (no columns) rather
 * than the full GLA employee list.
 */
function useActiveEmployeeNames(isCoHost: boolean): string[] {
  const { data, isLoading } = useQuery<{ success?: boolean; data?: EmployeeApiRow[] }>({
    queryKey: ["/api/employees", "commission-columns"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/employees?limit=500"), {
        credentials: "include",
      });
      if (!res.ok) return { success: false, data: [] };
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  // While loading, admins show PREFERRED_ORDER as a skeleton placeholder.
  // Co-hosts show [] to avoid flashing the full GLA employee list.
  if (isLoading || !data?.data) return isCoHost ? [] : PREFERRED_ORDER;

  const activeFirstNames = data.data
    .filter((e) => (e.employee_is_active ?? 1) === 1)
    .map((e) => (e.employee_first_name || "").trim())
    .filter(Boolean);

  // For co-hosts: return exactly what the (already-scoped) API gave us.
  // Never fall back to PREFERRED_ORDER — that would leak GLA employee names.
  if (activeFirstNames.length === 0) return isCoHost ? [] : PREFERRED_ORDER;

  // De-dupe case-insensitively while preserving the first-seen casing.
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const name of activeFirstNames) {
    const key = name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(name);
    }
  }

  // Known names first (curated order), then the rest alphabetically.
  const known = PREFERRED_ORDER.filter((n) =>
    seen.has(n.toLowerCase()),
  );
  const knownKeys = new Set(known.map((n) => n.toLowerCase()));
  const extras = unique
    .filter((n) => !knownKeys.has(n.toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  return [...known, ...extras];
}

// ── Main component ───────────────────────────────────────────────────────

export default function CommissionsSection() {
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const { isCoHost } = useCoHost();
  const employeeNames = useActiveEmployeeNames(isCoHost);
  const { dateFrom, dateTo } = getYearRange(Number(year));

  const yearQuery = useQuery<CommissionsApiResponse>({
    queryKey: ["/api/payroll/commissions", "year", year],
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl(`/api/payroll/commissions?dateFrom=${dateFrom}&dateTo=${dateTo}&limit=2000`),
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(`Failed to fetch commissions: ${res.status}`);
      return res.json();
    },
  });

  const isLoading = yearQuery.isLoading;
  const noTeam = isCoHost && !isLoading && employeeNames.length === 0;

  return (
    <div className="mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-base font-semibold leading-tight">Commissions</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Year</span>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEAR_OPTIONS.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="mt-2">
        {isLoading ? (
          <LoadingSkeleton />
        ) : noTeam ? (
          <p className="text-sm text-muted-foreground">No team members linked to your co-host account.</p>
        ) : (
          <div className="space-y-6">
            {employeeNames.map((name) => (
              <MatrixTable
                key={name}
                employeeName={name}
                year={year}
                data={yearQuery.data?.data}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
