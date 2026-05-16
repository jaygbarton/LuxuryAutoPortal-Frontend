import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { SectionHeader } from "@/components/admin/dashboard/SectionHeader";
import { formatCurrency } from "@/components/admin/dashboard/utils";
import React from "react";

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

interface Employee {
  id: number;
  fullname?: string;
  first_name?: string;
  last_name?: string;
  emp_first_name?: string;
  emp_last_name?: string;
}

interface EmployeesApiResponse {
  success: boolean;
  data: Employee[];
}

// ── Expense types from PDF ──────────────────────────────────────────────

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

function getEmployeeName(emp: Employee): string {
  if (emp.fullname) return emp.fullname;
  const first = emp.first_name || emp.emp_first_name || "";
  const last = emp.last_name || emp.emp_last_name || "";
  return `${first} ${last}`.trim() || `Employee ${emp.id}`;
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
    const type = row.commissions_type || "";
    const name = row.fullname || row.commissions_account_owner_name || "";
    const amount = parseFloat(row.commissions_amount) || 0;

    if (matrix[type] && employeeNames.includes(name)) {
      matrix[type][name] += amount;
      totals[name] += amount;
    } else if (matrix[type]) {
      // Try partial match
      const matched = employeeNames.find(
        (n) => n.toLowerCase() === name.toLowerCase(),
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
  const isEmpty = rows.length === 0;

  if (isEmpty) {
    return (
      <div className="flex-1 min-w-[300px]">
        <div className="rounded-t-lg bg-black px-4 py-2">
          <p className="text-sm font-bold uppercase text-[#FFCC00]">
            Commissions &mdash; {monthLabel}
          </p>
        </div>
        <div className="rounded-b-lg border border-t-0 border-gray-200 bg-white px-6 py-8 text-center">
          <p className="text-sm text-gray-400">
            No commissions found for this period
          </p>
        </div>
      </div>
    );
  }

  const { matrix, totals } = buildMatrix(rows, employeeNames);

  return (
    <div className="flex-1 min-w-[300px]">
      <div className="rounded-t-lg bg-black px-4 py-2">
        <p className="text-sm font-bold uppercase text-[#FFCC00]">
          Commissions &mdash; {monthLabel}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border border-gray-200">
          <thead>
            <tr className="bg-black">
              <th className="px-3 py-2 text-left text-xs font-bold uppercase text-white">
                Type
              </th>
              {employeeNames.map((name) => (
                <th
                  key={name}
                  className="px-3 py-2 text-right text-xs font-bold uppercase text-white"
                >
                  {name}
                </th>
              ))}
              <th className="px-3 py-2 text-right text-xs font-bold uppercase text-[#FFCC00]">
                TOTAL
              </th>
            </tr>
          </thead>
          <tbody>
            {EXPENSE_TYPES.map((type, idx) => {
              const rowTotal = employeeNames.reduce(
                (sum, name) => sum + (matrix[type]?.[name] ?? 0),
                0,
              );
              return (
                <tr
                  key={type}
                  className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-900">
                    {type}
                  </td>
                  {employeeNames.map((name) => (
                    <td
                      key={name}
                      className="px-3 py-2 text-right text-sm text-gray-900"
                    >
                      {matrix[type]?.[name]
                        ? formatCurrency(matrix[type][name])
                        : "—"}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right text-sm font-semibold text-gray-900">
                    {rowTotal > 0 ? formatCurrency(rowTotal) : "—"}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-gray-100 font-bold">
              <td className="px-3 py-2 text-sm text-gray-900">TOTAL</td>
              {employeeNames.map((name) => (
                <td
                  key={name}
                  className="px-3 py-2 text-right text-sm text-gray-900"
                >
                  {totals[name] > 0 ? formatCurrency(totals[name]) : "—"}
                </td>
              ))}
              <td className="px-3 py-2 text-right text-sm font-bold text-gray-900">
                {formatCurrency(
                  employeeNames.reduce((sum, name) => sum + (totals[name] ?? 0), 0),
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────

export default function CommissionsSection() {
  const current = getMonthRange(0);
  const prev = getMonthRange(-1);

  const employeesQuery = useQuery<EmployeesApiResponse>({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/employees"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Failed to fetch employees: ${res.status}`);
      return res.json();
    },
  });

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

  const isLoading = currentQuery.isLoading || prevQuery.isLoading || employeesQuery.isLoading;

  // Derive employee names from employees API or fall back to commission data
  const employeeNames: string[] = React.useMemo(() => {
    const empData = employeesQuery.data?.data ?? [];
    if (empData.length > 0) {
      return empData.map(getEmployeeName).filter(Boolean);
    }
    // Fallback: extract unique names from commission data
    const allCommissions = [
      ...(currentQuery.data?.data ?? []),
      ...(prevQuery.data?.data ?? []),
    ];
    const names = new Set<string>();
    for (const row of allCommissions) {
      const name = row.fullname || row.commissions_account_owner_name;
      if (name) names.add(name);
    }
    return Array.from(names).sort();
  }, [employeesQuery.data, currentQuery.data, prevQuery.data]);

  return (
    <div className="mb-8">
      <SectionHeader title="COMMISSIONS" />
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
