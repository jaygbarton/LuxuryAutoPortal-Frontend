import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "wouter";
import { AdminLayout } from "@/components/admin/admin-layout";
import { ClientPageLinks } from "@/components/client/ClientPageLinks";
import { Button } from "@/components/ui/button";
import { SearchableNativeSelect } from "@/components/ui/searchable-native-select";
import { api } from "@/lib/api";
import { buildApiUrl } from "@/lib/queryClient";
import { formatMonthDayYear } from "@/lib/date-format";

type Vehicle = {
  id: number;
  make: string;
  model: string;
  year: string;
  plate: string;
  status: string;
};
type History = {
  id: string;
  carId: number;
  label: string;
  date: string | null;
  dateBasis: string;
  status: string;
  amount: number | null;
  source: string;
  files: string[];
  unavailableFiles: number;
};
export default function ClientMaintenanceHistory() {
  const search = useSearch(),
    requested = new URLSearchParams(search).get("car");
  const [selected, setSelected] = useState(requested || ""),
    [query, setQuery] = useState("");
  useEffect(() => setSelected(requested || ""), [requested]);
  const cars = useQuery<{ cars: Vehicle[] }>({
    queryKey: ["/api/client/vehicle-history"],
    queryFn: () => api.get("/api/client/vehicle-history"),
    retry: false,
  });
  const carId = selected || String(cars.data?.cars[0]?.id || "");
  const owned = cars.data?.cars.find((car) => String(car.id) === carId);
  const history = useQuery<{ history: History[] }>({
    queryKey: ["/api/client/vehicle-history", carId],
    queryFn: () => api.get(`/api/client/vehicle-history/${carId}`),
    enabled: !!owned,
    retry: false,
  });
  const records =
    history.data?.history.filter((row) =>
      `${row.label} ${row.source} ${row.status}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    ) || [];
  return (
    <AdminLayout>
      <main className="space-y-5">
        <div>
          <h1 className="text-2xl font-semibold text-primary">
            Vehicle service history
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Completed maintenance, recorded services and approved receipts.
            Records describe their source and date; linked entries may refer to
            the same repair.
          </p>
        </div>
        {cars.isError ? (
          <div role="alert" className="rounded-lg border border-red-200 p-4">
            Your vehicles could not be loaded.{" "}
            <Button variant="outline" onClick={() => void cars.refetch()}>
              Retry vehicles
            </Button>
          </div>
        ) : cars.isLoading ? (
          <p role="status">Loading vehicles…</p>
        ) : !cars.data?.cars.length ? (
          <p>No vehicles are linked to this account.</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                Vehicle
                <SearchableNativeSelect
                  aria-label="History vehicle"
                  className="mt-1 w-full"
                  value={carId}
                  onChange={(event) => setSelected(event.target.value)}
                >
                  {cars.data.cars.map((car) => (
                    <option
                      key={car.id}
                      value={car.id}
                    >{`${car.make} ${car.model} ${car.year} · ${car.plate || "No plate"}`}</option>
                  ))}
                </SearchableNativeSelect>
              </label>
              <label className="text-sm">
                Search history
                <input
                  className="mt-1 h-11 w-full rounded-md border bg-background px-3"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Service or record type"
                />
              </label>
            </div>
            {!owned ? (
              <p role="alert">
                This vehicle is not available in your account. Choose one of
                your vehicles.
              </p>
            ) : (
              <>
                <nav
                  className="flex flex-wrap gap-2"
                  aria-label="Vehicle reports"
                >
                  <Button asChild variant="outline">
                    <Link href={`/admin/cars/${carId}/records`}>
                      Records & files
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={`/admin/cars/${carId}/totals`}>Totals</Link>
                  </Button>
                </nav>
                {history.isError ? (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 p-4"
                  >
                    <p>
                      Service history could not be loaded. This does not mean
                      there are no records.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => void history.refetch()}
                    >
                      Retry history
                    </Button>
                  </div>
                ) : history.isLoading ? (
                  <p role="status">Loading service history…</p>
                ) : !records.length ? (
                  <p>
                    {query
                      ? "No records match this search."
                      : "No completed service records or approved receipts are available for this vehicle yet."}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {records.map((row) => (
                      <article key={row.id} className="rounded-xl border p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <h2 className="font-semibold">{row.label}</h2>
                            <p className="text-sm text-muted-foreground">
                              {row.source} · {row.status.replaceAll("_", " ")}
                            </p>
                          </div>
                          {row.amount !== null && (
                            <span className="font-medium">
                              {row.amount.toLocaleString("en-US", {
                                style: "currency",
                                currency: "USD",
                              })}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-sm">
                          {row.date
                            ? row.dateBasis === "month_only"
                              ? `${row.date.slice(0, 7)} · Month recorded; exact service day unknown`
                              : formatMonthDayYear(row.date)
                            : "Service date not recorded"}
                          {row.date && row.dateBasis !== "month_only" && (
                            <span className="text-muted-foreground">
                              {" "}
                              · {row.dateBasis.replaceAll("_", " ")}
                            </span>
                          )}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {row.files.map((file, index) => (
                            <a
                              className="rounded-md border px-3 py-2 text-sm underline"
                              key={file}
                              href={buildApiUrl(file)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Receipt / file {index + 1}
                            </a>
                          ))}
                        </div>
                        {row.unavailableFiles > 0 && (
                          <p className="mt-2 text-sm text-amber-800">
                            {row.unavailableFiles} older file link(s) need
                            review. Open Records & files or contact GLA; the
                            service record is preserved.
                          </p>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
        <ClientPageLinks carId={owned?.id} />
      </main>
    </AdminLayout>
  );
}
