import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { formatCurrency } from "@/components/admin/dashboard/utils";

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
  "Electric/Gas/Uber - Reimbursed",
  "Ski Rack's",
  "New Car 1%",
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

function getMonthRange(offset: number): {
  label: string;
  dateFrom: string;
  dateTo: string;
} {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const year = d.getFullYear();
  const month = d.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const pad = (n: number) => String(n).padStart(2, "0");
  const label = `${firstDay.toLocaleString("en-US", { month: "long" })} ${year}`;
  const dateFrom = `${year}-${pad(month + 1)}-${pad(firstDay.getDate())}`;
  const dateTo = `${year}-${pad(month + 1)}-${pad(lastDay.getDate())}`;

  return { label, dateFrom, dateTo };
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
  "new car 1%":                      "New Car 1%",
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

function buildMatrix(
  data: CommissionRow[],
  employeeNames: string[],
): { matrix: Record<string, Record<string, number>>; totals: Record<string, number> } {
  const matrix: Record<string, Record<string, number>> = {};
  const totals: Record<string, number> = {};

  for (const type of EXPENSE_TYPES) {
    matrix[type] = {};
    for (const name of employeeNames) {
      matrix[type][name] = 0;
    }
  }

  for (const name of employeeNames) {
    totals[name] = 0;
  }

  for (const row of data) {
    const type = normalizeType(row.commissions_type || "");
    const name = row.fullname || row.commissions_account_owner_name || "";
    const amount = parseFloat(row.commissions_amount) || 0;

    if (!matrix[type]) continue; // unknown type — skip

    // Exact match first, then case-insensitive
    if (employeeNames.includes(name)) {
      matrix[type][name] += amount;
      totals[name] += amount;
    } else {
      const matched = employeeNames.find(
        (n) => n.toLowerCase() === name.toLowerCase() ||
               name.toLowerCase().startsWith(n.toLowerCase()),
      );
      if (matched) {
        matrix[type][matched] += amount;
        totals[matched] += amount;
      }
    }
  }

  return { matrix, totals };
}

// ── Loading skeleton ─────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="flex flex-wrap gap-4">
      {[0, 1].map((i) => (
        <div key={i} className="flex-1 min-w-[300px]">
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

function MatrixTable({
  monthLabel,
  data,
  employeeNames,
}: {
  monthLabel: string;
  data: CommissionRow[] | undefined;
  employeeNames: string[];
}) {
  const rows = data ?? [];
  const { matrix, totals } = buildMatrix(rows, employeeNames);

  return (
    <div className="flex-1 min-w-[300px]">
      <h3 className="text-lg font-bold uppercase tracking-wide text-black mb-3">
        COMMISSIONS {monthLabel}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full border-y border-[#D3BC8D] border-collapse">
          <thead>
            <tr className="bg-black border-y border-[#D3BC8D]">
              <th className="px-3 py-2 text-center text-xs font-bold uppercase text-white">
                Type
              </th>
              {employeeNames.map((name) => (
                <th
                  key={name}
                  className="px-3 py-2 text-center text-xs font-bold uppercase text-white"
                >
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EXPENSE_TYPES.map((type) => {
              return (
                <tr
                  key={type}
                  className="bg-white border-y border-[#D3BC8D]"
                >
                  <td className="whitespace-nowrap px-3 py-2 text-center text-sm text-gray-900">
                    {type}
                  </td>
                  {employeeNames.map((name) => (
                    <td
                      key={name}
                      className="px-3 py-2 text-center text-sm text-gray-900"
                    >
                      {matrix[type]?.[name]
                        ? formatCurrency(matrix[type][name])
                        : "—"}
                    </td>
                  ))}
                </tr>
              );
            })}
            <tr className="bg-[#D3BC8D] font-bold border-y border-[#D3BC8D]">
              <td className="px-3 py-2 text-center text-sm text-black">TOTAL</td>
              {employeeNames.map((name) => (
                <td
                  key={name}
                  className="px-3 py-2 text-center text-sm text-black"
                >
                  {totals[name] > 0 ? formatCurrency(totals[name]) : "—"}
                </td>
              ))}
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
 * Falls back to the full curated list only while the request is in flight or
 * if it fails, so the table never renders with zero columns.
 */
function useActiveEmployeeNames(): string[] {
  const { data } = useQuery<{ success?: boolean; data?: EmployeeApiRow[] }>({
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

  if (!data?.data) return PREFERRED_ORDER;

  const activeFirstNames = data.data
    .filter((e) => (e.employee_is_active ?? 1) === 1)
    .map((e) => (e.employee_first_name || "").trim())
    .filter(Boolean);

  if (activeFirstNames.length === 0) return PREFERRED_ORDER;

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
  const current = getMonthRange(0);
  const prev = getMonthRange(-1);
  const employeeNames = useActiveEmployeeNames();

  const currentQuery = useQuery<CommissionsApiResponse>({
    queryKey: ["/api/payroll/commissions", "current-month", current.dateFrom, current.dateTo],
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl(
          `/api/payroll/commissions?dateFrom=${current.dateFrom}&dateTo=${current.dateTo}&limit=500`,
        ),
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(`Failed to fetch commissions: ${res.status}`);
      return res.json();
    },
  });

  const prevQuery = useQuery<CommissionsApiResponse>({
    queryKey: ["/api/payroll/commissions", "prev-month", prev.dateFrom, prev.dateTo],
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl(
          `/api/payroll/commissions?dateFrom=${prev.dateFrom}&dateTo=${prev.dateTo}&limit=500`,
        ),
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(`Failed to fetch commissions: ${res.status}`);
      return res.json();
    },
  });

  const isLoading = currentQuery.isLoading || prevQuery.isLoading;

  return (
    <div className="mb-8">
      <div className="mt-2">
        {isLoading ? (
          <LoadingSkeleton />
        ) : (
          <div className="flex flex-wrap gap-4">
            <MatrixTable
              monthLabel={prev.label}
              data={prevQuery.data?.data}
              employeeNames={employeeNames}
            />
            <MatrixTable
              monthLabel={current.label}
              data={currentQuery.data?.data}
              employeeNames={employeeNames}
            />
          </div>
        )}
      </div>
    </div>
  );
}
