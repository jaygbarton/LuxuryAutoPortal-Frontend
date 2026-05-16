import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { SectionHeader, DashboardTable } from "@/components/admin/dashboard";
import { formatCurrency, MONTH_LABELS } from "./utils";
import type {
  IncomeExpenseData,
  DirectDeliveryMonth,
  ParkingAirportQBMonth,
  ParkingFeeLaborMonth,
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
      month: label,
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
      <SectionHeader title="AIRPORT PARKING & TRIPS" />

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
        const directDelivery: DirectDeliveryMonth[] = d.directDelivery ?? [];
        const parkingFeeLabor: ParkingFeeLaborMonth[] = d.parkingFeeLabor ?? [];
        const parkingAirportQB: ParkingAirportQBMonth[] = d.parkingAirportQB ?? [];
        const history: HistoryMonth[] = d.history ?? [];

        // System parking = parkingFeeLabor (glaParkingFee + laborCleaning) + directDelivery.parkingAirport
        const system = buildRows(
          (m) => {
            const pfl = getMonthEntry(parkingFeeLabor, m);
            const dd = getMonthEntry(directDelivery, m);
            return (pfl?.glaParkingFee ?? 0) + (pfl?.laborCleaning ?? 0) + (dd?.parkingAirport ?? 0);
          },
          history,
        );
        const qb = buildRows(
          (m) => getMonthEntry(parkingAirportQB, m)?.totalParkingAirport ?? 0,
          history,
        );

        return (
          <div className="mt-2 flex flex-wrap gap-4">
            {/* System Data Table */}
            <div className="min-w-[300px] flex-1">
              <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                <div className="bg-black px-4 py-2">
                  <p className="text-sm font-bold uppercase text-[#FFCC00]">
                    System Parking Airport Expenses and Trips Taken
                  </p>
                </div>
                <DashboardTable
                  columns={TABLE_COLUMNS}
                  rows={system.rows}
                  totalsRow={system.totalsRow}
                />
              </div>
            </div>

            {/* QuickBooks Data Table */}
            <div className="min-w-[300px] flex-1">
              <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                <div className="bg-black px-4 py-2">
                  <p className="text-sm font-bold uppercase text-[#FFCC00]">
                    QuickBooks Parking Airport Expenses and Trips Taken
                  </p>
                </div>
                <DashboardTable
                  columns={TABLE_COLUMNS}
                  rows={qb.rows}
                  totalsRow={qb.totalsRow}
                />
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
