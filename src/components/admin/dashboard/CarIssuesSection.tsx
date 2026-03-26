import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { SectionHeader, SummaryCard, DashboardTable } from "@/components/admin/dashboard";

interface CarOwner {
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
}

interface Car {
  id: number;
  vin: string;
  makeModel: string;
  year: number;
  status: string;
  owner: CarOwner;
}

interface CarsResponse {
  success: boolean;
  cars: Car[];
}

const TABLE_COLUMNS = [
  { key: "vehicle", label: "Vehicle", align: "left" as const },
  { key: "vin", label: "VIN", align: "left" as const },
  { key: "year", label: "Year", align: "center" as const },
  { key: "owner", label: "Owner", align: "left" as const },
  { key: "contact", label: "Contact", align: "left" as const },
  { key: "status", label: "Status", align: "left" as const },
];

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase().replace(/\s+/g, "_");
  let colorClass = "bg-gray-100 text-gray-700";
  let label = status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");

  if (normalized === "available" || normalized === "active") {
    colorClass = "bg-green-100 text-green-700";
    label = "Available";
  } else if (normalized === "in_use") {
    colorClass = "bg-blue-100 text-blue-700";
    label = "In Use";
  } else if (normalized === "maintenance") {
    colorClass = "bg-yellow-100 text-yellow-700";
    label = "Maintenance";
  }

  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${colorClass}`}>
      {label}
    </span>
  );
}

export default function CarIssuesSection() {
  const { data, isLoading } = useQuery<CarsResponse>({
    queryKey: ["/api/cars"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/cars"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch cars");
      return res.json();
    },
  });

  const cars = data?.cars ?? [];
  const totalFleet = cars.length;
  const activeCars = cars.filter(
    (c) => ["available", "in_use", "active"].includes(c.status?.toLowerCase()),
  ).length;
  const maintenanceCars = cars.filter(
    (c) => c.status?.toLowerCase() === "maintenance",
  ).length;

  const rows = cars.slice(0, 20).map((car) => ({
    vehicle: car.makeModel,
    vin: <span className="font-mono text-xs">...{car.vin.slice(-6)}</span>,
    year: String(car.year),
    owner: `${car.owner.firstName} ${car.owner.lastName}`,
    contact: car.owner.phone || "—",
    status: <StatusBadge status={car.status} />,
  }));

  return (
    <div className="mb-8">
      <SectionHeader title="CAR ISSUES / INSPECTIONS" />

      {isLoading ? (
        <div className="mt-4 space-y-4 px-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-gray-200" />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-lg bg-gray-200" />
        </div>
      ) : (
        <div className="mt-4 space-y-4 px-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard label="Total Fleet" value={String(totalFleet)} variant="gold" />
            <SummaryCard label="Active" value={String(activeCars)} variant="dark" />
            <SummaryCard label="In Maintenance" value={String(maintenanceCars)} variant="dark" />
          </div>

          {rows.length > 0 ? (
            <DashboardTable columns={TABLE_COLUMNS} rows={rows} />
          ) : (
            <div className="rounded-md border border-gray-200 bg-white px-6 py-8 text-center">
              <p className="text-sm text-gray-400">No cars found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
