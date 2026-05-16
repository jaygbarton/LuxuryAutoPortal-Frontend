import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { buildApiUrl } from "@/lib/queryClient";
import { SectionHeader, SummaryCard, DashboardTable } from "@/components/admin/dashboard";
import { formatCurrency, MONTH_LABELS } from "./utils";
import type { IncomeExpenseData, CogsMonth } from "@/pages/admin/income-expenses/types";

interface MaintenanceSectionProps {
  year: string;
}

const MECHANICAL_FIELDS: (keyof CogsMonth)[] = [
  "mechanic", "brakes", "alignment", "oilLube", "tires", "parts", "battery",
];

const BODY_OTHER_FIELDS: (keyof CogsMonth)[] = [
  "autoBodyShopWreck", "windshield", "wipers", "towingImpoundFees", "tickets",
];

const TABLE_DISPLAY_FIELDS: (keyof CogsMonth)[] = [
  "mechanic", "brakes", "tires", "oilLube", "autoBodyShopWreck", "parts", "carInsurance",
];

const ALL_COGS_FIELDS: (keyof CogsMonth)[] = [
  "autoBodyShopWreck", "alignment", "battery", "brakes", "carPayment", "carInsurance",
  "carSeats", "cleaningSuppliesTools", "emissions", "gpsSystem", "keyFob", "laborCleaning",
  "licenseRegistration", "mechanic", "oilLube", "parts", "skiRacks", "tickets",
  "tiredAirStation", "tires", "towingImpoundFees", "uberLyftLime", "windshield", "wipers",
];

function sumCogsFields(m: CogsMonth, fields: (keyof CogsMonth)[]): number {
  return fields.reduce((sum, f) => sum + ((m[f] as number) || 0), 0);
}

function sumAllCogs(m: CogsMonth): number {
  return sumCogsFields(m, ALL_COGS_FIELDS);
}

const TABLE_COLUMNS = [
  { key: "month", label: "Month", align: "left" as const },
  { key: "mechanic", label: "Mechanic", align: "right" as const },
  { key: "brakes", label: "Brakes", align: "right" as const },
  { key: "tires", label: "Tires", align: "right" as const },
  { key: "oilLube", label: "Oil & Lube", align: "right" as const },
  { key: "bodyShop", label: "Body Shop", align: "right" as const },
  { key: "parts", label: "Parts", align: "right" as const },
  { key: "insurance", label: "Insurance", align: "right" as const },
  { key: "other", label: "Other", align: "right" as const },
  { key: "total", label: "Total", align: "right" as const },
];

interface ApiResponse {
  success: boolean;
  data: IncomeExpenseData;
}

export default function MaintenanceSection({ year }: MaintenanceSectionProps) {
  const { data, isLoading } = useQuery<ApiResponse>({
    queryKey: ["/api/income-expense/all-cars", year],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/income-expense/all-cars/${year}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch income-expense data");
      return res.json();
    },
  });

  const cogs: CogsMonth[] = data?.data?.cogs ?? [];

  // Build a lookup by month (1-12)
  const cogsByMonth = new Map<number, CogsMonth>();
  for (const c of cogs) cogsByMonth.set(c.month, c);

  // Summary totals
  let totalMaintenance = 0;
  let totalMechanical = 0;
  let totalBodyOther = 0;
  for (const c of cogs) {
    totalMaintenance += sumAllCogs(c);
    totalMechanical += sumCogsFields(c, MECHANICAL_FIELDS);
    totalBodyOther += sumCogsFields(c, BODY_OTHER_FIELDS);
  }

  // Table rows & chart data
  const colTotals: Record<string, number> = {};
  const rows = MONTH_LABELS.map((label, i) => {
    const m = cogsByMonth.get(i + 1);
    const mechanic = m?.mechanic ?? 0;
    const brakes = m?.brakes ?? 0;
    const tires = m?.tires ?? 0;
    const oilLube = m?.oilLube ?? 0;
    const bodyShop = m?.autoBodyShopWreck ?? 0;
    const parts = m?.parts ?? 0;
    const insurance = m?.carInsurance ?? 0;
    const total = m ? sumAllCogs(m) : 0;
    const displayedSum = mechanic + brakes + tires + oilLube + bodyShop + parts + insurance;
    const other = total - displayedSum;

    const vals: Record<string, number> = {
      mechanic, brakes, tires, oilLube, bodyShop, parts, insurance, other, total,
    };
    for (const [k, v] of Object.entries(vals)) {
      colTotals[k] = (colTotals[k] ?? 0) + v;
    }

    return {
      month: label,
      mechanic: formatCurrency(mechanic),
      brakes: formatCurrency(brakes),
      tires: formatCurrency(tires),
      oilLube: formatCurrency(oilLube),
      bodyShop: formatCurrency(bodyShop),
      parts: formatCurrency(parts),
      insurance: formatCurrency(insurance),
      other: formatCurrency(other),
      total: <span className="font-bold">{formatCurrency(total)}</span>,
    };
  });

  const totalsRow = {
    month: <span className="font-bold">TOTALS</span>,
    mechanic: formatCurrency(colTotals.mechanic ?? 0),
    brakes: formatCurrency(colTotals.brakes ?? 0),
    tires: formatCurrency(colTotals.tires ?? 0),
    oilLube: formatCurrency(colTotals.oilLube ?? 0),
    bodyShop: formatCurrency(colTotals.bodyShop ?? 0),
    parts: formatCurrency(colTotals.parts ?? 0),
    insurance: formatCurrency(colTotals.insurance ?? 0),
    other: formatCurrency(colTotals.other ?? 0),
    total: <span className="font-bold">{formatCurrency(colTotals.total ?? 0)}</span>,
  };

  const chartData = MONTH_LABELS.map((label, i) => {
    const m = cogsByMonth.get(i + 1);
    return {
      month: label,
      Mechanical: m ? sumCogsFields(m, MECHANICAL_FIELDS) : 0,
      "Body & Other": m ? sumCogsFields(m, BODY_OTHER_FIELDS) : 0,
    };
  });

  return (
    <div className="mb-8">
      <SectionHeader title="MAINTENANCE" />

      {isLoading ? (
        <div className="mt-4 space-y-4 px-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-gray-200" />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-lg bg-gray-200" />
          <div className="h-80 animate-pulse rounded-lg bg-gray-200" />
        </div>
      ) : (
        <div className="mt-4 space-y-4 px-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard
              label="Total Maintenance Cost"
              value={formatCurrency(totalMaintenance)}
              variant="gold"
            />
            <SummaryCard
              label="Mechanical"
              value={formatCurrency(totalMechanical)}
              variant="dark"
            />
            <SummaryCard
              label="Body & Other"
              value={formatCurrency(totalBodyOther)}
              variant="dark"
            />
          </div>

          <DashboardTable columns={TABLE_COLUMNS} rows={rows} totalsRow={totalsRow} />

          {/* Monthly Maintenance Cost Bar Chart */}
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-700">
              MONTHLY MAINTENANCE COSTS
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="Mechanical" fill="#FFCC00" />
                <Bar dataKey="Body & Other" fill="#6B7280" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
