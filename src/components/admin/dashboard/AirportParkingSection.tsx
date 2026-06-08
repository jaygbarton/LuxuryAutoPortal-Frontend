import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { DashboardTable } from "@/components/admin/dashboard";
import { formatCurrency, MONTH_LABELS } from "./utils";
import { useCoHost } from "@/hooks/use-co-host";
import type {
  IncomeExpenseData,
  ParkingAirportQBMonth,
  ReimbursedBillsMonth,
  HistoryMonth,
} from "@/pages/admin/income-expenses/types";

interface AirportParkingSectionProps {
  year: string;
}

interface ApiResponse {
  success: boolean;
  data: IncomeExpenseData;
}

function getMonthEntry<T extends { month: number }>(
  arr: T[],
  month: number,
): T | undefined {
  return arr.find((e) => e.month === month);
}

const TABLE_COLUMNS = [
  { key: "month", label: "Month and Year", align: "left" as const },
  { key: "parkingExpenses", label: "Parking Airport Expenses", align: "right" as const },
  { key: "tripsTaken", label: "Trips Taken", align: "right" as const },
  { key: "avePerTrip", label: "Ave / Trips Taken", align: "right" as const },
];

function buildRows(
  expensesByMonth: (month: number) => number,
  history: HistoryMonth[],
  year: string,
) {
  let totalExpenses = 0;
  let totalTrips = 0;

  const rows = MONTH_LABELS.map((label, idx) => {
    const month = idx + 1;
    const expense = expensesByMonth(month);
    const trips = getMonthEntry(history, month)?.tripsTaken ?? 0;
    totalExpenses += expense;
    totalTrips += trips;

    const avePerTrip = trips > 0 ? expense / trips : 0;

    return {
      month: (
        <span className="inline-block rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
          {label} {year}
        </span>
      ),
      parkingExpenses: formatCurrency(expense),
      tripsTaken: trips.toLocaleString(),
      avePerTrip: formatCurrency(avePerTrip),
    };
  });

  const totalAve = totalTrips > 0 ? totalExpenses / totalTrips : 0;
  const totalsRow = {
    month: "TOTAL",
    parkingExpenses: formatCurrency(totalExpenses),
    tripsTaken: totalTrips.toLocaleString(),
    avePerTrip: formatCurrency(totalAve),
  };

  return { rows, totalsRow };
}

export default function AirportParkingSection({ year }: AirportParkingSectionProps) {
  const { isCoHost } = useCoHost();
  const { data, isLoading, isError } = useQuery<ApiResponse>({
    queryKey: ["/api/income-expense/all-cars", year],
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl(`/api/income-expense/all-cars/${year}`),
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to fetch income-expense data");
      return res.json();
    },
  });

  return (
    <div className="mb-8">
      {isLoading && (
        <div className="mt-2 space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-md bg-[#111111]" />
          ))}
        </div>
      )}

      {isError && (
        <div className="mt-2 rounded-md bg-[#111111] px-6 py-8 text-center">
          <p className="text-sm text-red-400">Failed to load airport parking data.</p>
        </div>
      )}

      {data && (() => {
        const d = data.data;
        // Reconciled with /admin/income-expenses: the GLA table on this
        // dashboard now mirrors the I&E page's
        //   "PARKING AIRPORT AVERAGE PER TRIP - GLA"
        // section, which reads reimbursedBills.parkingAirport. Previously
        // this dashboard summed parkingFeeLabor.glaParkingFee +
        // parkingFeeLabor.laborCleaning + directDelivery.parkingAirport,
        // producing a number that didn't match the I&E page (~$5,320 vs
        // ~$2,274) and confused operators.
        const reimbursedBills: ReimbursedBillsMonth[] = d.reimbursedBills ?? [];
        const parkingAirportQB: ParkingAirportQBMonth[] = d.parkingAirportQB ?? [];
        const history: HistoryMonth[] = d.history ?? [];

        const gla = buildRows(
          (m) => Number(getMonthEntry(reimbursedBills, m)?.parkingAirport ?? 0),
          history,
          year,
        );
        const qb = buildRows(
          (m) => Number(getMonthEntry(parkingAirportQB, m)?.totalParkingAirport ?? 0),
          history,
          year,
        );

        return (
          <div className="mt-2 flex flex-wrap gap-4">
            {/* GLA — sourced from the same column as the I&E page's
                "PARKING AIRPORT AVERAGE PER TRIP - GLA" section. */}
            <div className="min-w-[300px] flex-1">
              <h3 className="text-sm font-bold uppercase tracking-wide text-black mb-2">
                PARKING AIRPORT AVERAGE PER TRIP - GLA
              </h3>
              <DashboardTable
                columns={TABLE_COLUMNS}
                rows={gla.rows}
                totalsRow={gla.totalsRow}
              />
            </div>

            {!isCoHost && (
              <div className="min-w-[300px] flex-1">
                <h3 className="text-sm font-bold uppercase tracking-wide text-black mb-2">
                  PARKING AIRPORT AVERAGE PER TRIP - QB
                </h3>
                <DashboardTable
                  columns={TABLE_COLUMNS}
                  rows={qb.rows}
                  totalsRow={qb.totalsRow}
                />
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
