import { mtTodayKey } from "@/lib/mt-datetime";
import { useTimezone } from "@/hooks/use-timezone";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useSearch } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, RefreshCw, Copy, FileText, Cpu } from "lucide-react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { CarPhotoCell } from "@/components/admin/dashboard/CarPhotoCell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  authMeQueryFn,
  buildApiUrl,
  getProxiedImageUrl,
} from "@/lib/queryClient";
import {
  hubMoney,
  hubNarrative,
  type HubCar,
  type HubReport,
  type HubSection,
} from "@/lib/aiHub";
import { serviceDate } from "@/lib/serviceWorkspace";

async function read<T>(path: string): Promise<T> {
  const response = await fetch(buildApiUrl(path), { credentials: "include" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.error || "The report could not be loaded.");
  return data;
}
const selectClass =
  "h-11 w-full min-w-0 rounded-md border bg-white px-3 text-sm";
function Metric({
  label,
  value,
  tone = "",
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border bg-white p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-1 break-words text-xl font-semibold tabular-nums ${tone}`}
      >
        {value}
      </p>
    </div>
  );
}
function Section({
  title,
  section,
  children,
}: {
  title: string;
  section: HubSection<unknown> | undefined;
  children: ReactNode;
}) {
  if (!section) return null;
  return (
    <section
      className="min-w-0 space-y-3 rounded-xl border bg-white p-4"
      aria-label={title}
    >
      <h2 className="text-base font-semibold">{title}</h2>
      {section.status === "unavailable" ? (
        <p role="alert" className="text-sm text-amber-900">
          {section.error}{" "}
          {section.reference && `Reference: ${section.reference}`}
        </p>
      ) : (
        children
      )}
    </section>
  );
}
function Evidence({
  carId,
  params,
  undated,
  onUndated,
}: {
  carId: number;
  params: string;
  undated: boolean;
  onUndated: (value: boolean) => void;
}) {
  const [offset, setOffset] = useState(0);
  const { data, isPending, error } = useQuery({
    queryKey: ["/api/ai-hub/history", carId, params, undated, offset],
    queryFn: () =>
      read<{
        total: number;
        nextOffset: number | null;
        records: {
          id: string;
          label: string;
          date: string | null;
          dateBasis: string;
          status: string;
          amount: number | null;
          notes: string;
          notesTruncated: boolean;
          files: string[];
          filesOmitted: number;
          reportCount: number;
          source: string;
        }[];
      }>(
        `/api/ai-hub/cars/${carId}/history?${params}&offset=${offset}${undated ? "&undated=1" : ""}`,
      ),
    retry: false,
    staleTime: 60_000,
  });
  return (
    <div className="mt-3 space-y-3">
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={undated}
          onChange={(e) => {
            setOffset(0);
            onUndated(e.target.checked);
          }}
        />
        Show undated records instead
      </label>
      <p className="text-xs text-muted-foreground">
        Receipts, expenses, and service entries can refer to the same repair.
        These records are not summed as spending.
      </p>
      {isPending && <p role="status">Loading records…</p>}
      {error && <p role="alert">{error.message}</p>}
      {data && (
        <>
          <p className="text-sm text-muted-foreground">
            {data.total} records ·{" "}
            {undated ? "dates unknown" : "selected period"}
          </p>
          {data.records.map((r) => (
            <article
              key={r.id}
              className="min-w-0 rounded-lg border p-3 text-sm"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <h3 className="break-words font-medium">{r.label}</h3>
                <span>{serviceDate(r.date)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {r.status.replaceAll("_", " ")} ·{" "}
                {r.dateBasis.replaceAll("_", " ")} · {r.reportCount} report(s)
                {r.amount !== null
                  ? ` · Recorded amount ${hubMoney(r.amount)}`
                  : ""}
              </p>
              {r.notes && (
                <p className="mt-2 break-words">
                  {r.notes}
                  {r.notesTruncated ? "…" : ""}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {r.files.map((file, i) => (
                  <a
                    key={file}
                    href={getProxiedImageUrl(file)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center rounded-md border px-3"
                  >
                    Receipt / file {i + 1}
                  </a>
                ))}
                <Link
                  href={`/admin/operations?tab=service-due&car=${carId}`}
                  className="inline-flex min-h-11 items-center px-2 underline"
                >
                  Open original history
                </Link>
              </div>
              {r.filesOmitted > 0 && (
                <p>{r.filesOmitted} more files in the original record.</p>
              )}
            </article>
          ))}
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={!offset}
              onClick={() => setOffset(Math.max(0, offset - 20))}
            >
              Previous records
            </Button>
            <Button
              variant="outline"
              disabled={data.nextOffset === null}
              onClick={() => setOffset(data.nextOffset!)}
            >
              More records
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
export default function AiHubPage() {
  const search = useSearch(),
    initial = new URLSearchParams(search);
  // Report month limits follow the organization's accounting day, as on the API.
  const today = mtTodayKey();
  const viewerTimezone = useTimezone();
  const currentYear = Number(today.slice(0, 4)),
    currentMonth = Number(today.slice(5, 7));
  const [carId, setCarId] = useState(Number(initial.get("car")) || 0),
    [term, setTerm] = useState(""),
    [query, setQuery] = useState(""),
    [carOffset, setCarOffset] = useState(0);
  const [year, setYear] = useState(currentYear),
    [fromMonth, setFromMonth] = useState(1),
    [toMonth, setToMonth] = useState(currentMonth);
  const [topic, setTopic] = useState("overview"),
    [evidenceOpen, setEvidenceOpen] = useState(false),
    [undated, setUndated] = useState(false);
  const fresh = useRef(false),
    queryClient = useQueryClient(),
    { toast } = useToast();
  const auth = useQuery<any>({
    queryKey: ["/api/auth/me"],
    queryFn: authMeQueryFn,
  });
  const user = auth.data?.user;
  const accessKey = JSON.stringify([
    user?.id,
    user?.isAdmin,
    user?.isEmployee,
    user?.viewAsEmployee,
    user?.viewAsClient,
    user?.viewAsCoHost,
  ]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(term);
      setCarOffset(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [term]);
  const cars = useQuery({
    queryKey: ["/api/ai-hub/cars", query, carOffset, accessKey],
    queryFn: () =>
      read<{
        cars: HubCar[];
        nextOffset: number | null;
        canReadFinancials: boolean;
      }>(`/api/ai-hub/cars?q=${encodeURIComponent(query)}&offset=${carOffset}`),
    enabled: !!user,
    retry: false,
    staleTime: 60_000,
  });
  const canFinance = !!cars.data?.canReadFinancials;
  const effectiveTopic =
    topic === "profitability" && !canFinance ? "maintenance" : topic;
  const params = new URLSearchParams({
    year: String(year),
    fromMonth: String(fromMonth),
    toMonth: String(toMonth),
  }).toString();
  const report = useQuery({
    queryKey: [
      "/api/ai-hub/report",
      carId,
      params,
      effectiveTopic,
      accessKey,
      canFinance,
    ],
    queryFn: () => {
      const refresh = fresh.current;
      fresh.current = false;
      return read<HubReport>(
        `/api/ai-hub/cars/${carId}/report?${params}&topic=${effectiveTopic}${refresh ? "&refresh=1" : ""}`,
      );
    },
    enabled: carId > 0 && !!cars.data,
    retry: false,
    staleTime: 60_000,
  });
  const data = report.data,
    m = data?.sections.maintenance?.data,
    f = data?.sections.profitability?.data,
    late = data?.sections.lateReturns?.data;
  const selectedCar = cars.data?.cars.find((c) => Number(c.id) === carId),
    narrative = data ? hubNarrative(data) : [];
  const changeCar = (value: number) => {
    setCarId(value);
    setEvidenceOpen(false);
    setUndated(false);
  };
  const refresh = async () => {
    fresh.current = true;
    await report.refetch();
    await queryClient.invalidateQueries({
      queryKey: ["/api/ai-hub/history", carId],
    });
  };
  const copy = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(
        `${data.vehicle.name} · ${data.period.from} to ${data.period.to}\nPrepared ${data.generatedAt}\n\n${narrative.join("\n")}\n\n${[...(m?.notes ?? []), ...(f?.notes ?? []), ...(late?.notes ?? [])].join("\n")}`,
      );
      toast({ title: "Report summary copied" });
    } catch {
      toast({
        title: "Copy unavailable",
        description: "Use Download report to save a copy.",
      });
    }
  };
  const download = () => {
    if (!data) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `GLA-${carId}-${year}-${fromMonth}-${toMonth}-report.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-6xl space-y-4 p-3 sm:p-6">
        <header className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Cpu className="h-5 w-5" />
            AI Hub
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vehicle reports prepared from your existing records. No AI credits
            used.
          </p>
        </header>
        <section
          className="space-y-3 rounded-xl border bg-white p-4"
          aria-label="Report filters"
        >
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <label className="min-w-0 text-sm">
              Find a vehicle
              <Input
                className="mt-1 h-11"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Name, plate or VIN"
              />
            </label>
            <label className="min-w-0 text-sm">
              Vehicle
              <select
                aria-label="Vehicle"
                className={`mt-1 ${selectClass}`}
                value={carId || ""}
                onChange={(e) => changeCar(Number(e.target.value))}
              >
                <option value="">Select a vehicle</option>
                {carId > 0 && !selectedCar && (
                  <option value={carId}>
                    {data?.vehicle.name || `Selected vehicle #${carId}`}
                  </option>
                )}
                {cars.data?.cars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.plate || "No plate"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {cars.error && (
            <p role="alert" className="text-sm text-red-700">
              {cars.error.message}{" "}
              <button className="underline" onClick={() => cars.refetch()}>
                Retry
              </button>
            </p>
          )}
          {cars.isPending && !cars.error && (
            <p role="status" className="text-sm">
              Loading vehicles…
            </p>
          )}
          {cars.data?.cars.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No active vehicles match this search.
            </p>
          )}
          {(carOffset > 0 || cars.data?.nextOffset != null) && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={!carOffset}
                onClick={() => setCarOffset(Math.max(0, carOffset - 50))}
              >
                Previous vehicles
              </Button>
              <Button
                variant="outline"
                disabled={cars.data?.nextOffset == null}
                onClick={() => setCarOffset(cars.data!.nextOffset!)}
              >
                More vehicles
              </Button>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            {[
              [
                "Year",
                year,
                (v: number) => {
                  setYear(v);
                  if (v === currentYear) {
                    setToMonth(Math.min(toMonth, currentMonth));
                    setFromMonth(Math.min(fromMonth, currentMonth));
                  }
                },
                Array.from(
                  { length: currentYear - 1999 },
                  (_, i) => currentYear - i,
                ),
              ],
              [
                "From month",
                fromMonth,
                (v: number) => {
                  setFromMonth(v);
                  if (v > toMonth) setToMonth(v);
                },
                Array.from(
                  { length: year === currentYear ? currentMonth : 12 },
                  (_, i) => i + 1,
                ),
              ],
              [
                "To month",
                toMonth,
                (v: number) => {
                  setToMonth(v);
                  if (v < fromMonth) setFromMonth(v);
                },
                Array.from(
                  { length: year === currentYear ? currentMonth : 12 },
                  (_, i) => i + 1,
                ),
              ],
            ].map(([label, value, set, options]) => (
              <label className="min-w-0 text-xs" key={String(label)}>
                {String(label)}
                <select
                  aria-label={String(label)}
                  className={`mt-1 ${selectClass}`}
                  value={Number(value)}
                  onChange={(e) =>
                    (set as (v: number) => void)(Number(e.target.value))
                  }
                >
                  {(options as number[]).map((v) => (
                    <option key={v} value={v}>
                      {label === "Year"
                        ? v
                        : new Date(Date.UTC(2020, v - 1, 1)).toLocaleString(
                            "en-US",
                            { month: "short", timeZone: "UTC" },
                          )}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div
            className="grid grid-cols-3 gap-2"
            role="group"
            aria-label="Report type"
          >
            {[
              "overview",
              "maintenance",
              ...(canFinance ? ["profitability"] : []),
            ].map((t) => (
              <Button
                className="min-w-0 px-2 text-xs sm:text-sm"
                key={t}
                aria-pressed={effectiveTopic === t}
                variant={effectiveTopic === t ? "default" : "outline"}
                onClick={() => {
                  setTopic(t);
                  setEvidenceOpen(false);
                }}
              >
                {t[0].toUpperCase() + t.slice(1)}
              </Button>
            ))}
          </div>
        </section>
        {!carId && (
          <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            Select a vehicle to see maintenance, recorded alerts, and available
            financial reports.
          </p>
        )}
        {carId > 0 && report.isPending && cars.data && (
          <p role="status">Preparing vehicle report…</p>
        )}
        {report.error && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm"
          >
            {report.error.message}{" "}
            <button className="underline" onClick={() => report.refetch()}>
              Retry report
            </button>
          </p>
        )}
        {data && (
          <>
            <section className="space-y-3 rounded-xl border bg-white p-4">
              <div className="flex items-center gap-3">
                <CarPhotoCell
                  carPhoto={selectedCar?.photo ?? data.vehicle.photo}
                  carName={data.vehicle.name}
                  className="h-12 w-16"
                />
                <div className="min-w-0">
                  <h2 className="break-words text-lg font-semibold">
                    {data.vehicle.name}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {data.vehicle.plate || "No plate"} ·{" "}
                    {serviceDate(data.period.from)} –{" "}
                    {serviceDate(data.period.to)}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Prepared{" "}
                {new Date(data.generatedAt).toLocaleString("en-US", {
                  timeZone: viewerTimezone,
                })}{" "}
                · {viewerTimezone}. Cached for up to one minute.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={refresh}
                  disabled={report.isFetching}
                >
                  <RefreshCw
                    className={`mr-2 h-4 w-4 ${report.isFetching ? "animate-spin" : ""}`}
                  />
                  Refresh report
                </Button>
                <Button variant="outline" onClick={copy}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy summary
                </Button>
                <Button variant="outline" onClick={download}>
                  <Download className="mr-2 h-4 w-4" />
                  Download report
                </Button>
              </div>
              <ul className="list-disc space-y-2 pl-5 text-sm">
                {narrative.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
            <Section title="Maintenance" section={data.sections.maintenance}>
              {m && (
                <>
                  <p className="text-xs text-muted-foreground">{m.scope}</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Metric
                      label="Open issue groups"
                      value={m.openIssueGroups}
                    />
                    <Metric
                      label="Original reports"
                      value={m.originalOpenReports}
                    />
                    <Metric
                      label="Overdue services"
                      value={m.overdueServices}
                      tone={m.overdueServices ? "text-red-700" : ""}
                    />
                    <Metric label="Due soon" value={m.dueSoonServices} />
                  </div>
                  <p className="text-sm">
                    Last serviced: {serviceDate(m.lastServiced)} ·{" "}
                    {m.scheduledReports} scheduled reports
                  </p>
                  <p className="text-sm">
                    Mileage:{" "}
                    {m.mileage?.miles == null
                      ? "Not verified"
                      : `${m.mileage.miles.toLocaleString()} miles`}{" "}
                    · {m.mileage?.state.replaceAll("_", " ") || "unavailable"}
                  </p>
                  {m.mileage?.warning && (
                    <p className="text-xs text-amber-900">
                      {m.mileage.warning}
                    </p>
                  )}
                  {m.attention.map((s) => (
                    <div
                      key={s.id}
                      className="flex flex-wrap justify-between gap-2 rounded-md border p-3 text-sm"
                    >
                      <span className="font-medium">{s.label}</span>
                      <span>
                        {s.status.replaceAll("_", " ")}
                        {s.dueDate ? ` · ${serviceDate(s.dueDate)}` : ""}
                        {s.milesRemaining !== null
                          ? ` · ${s.milesRemaining.toLocaleString()} miles remaining`
                          : ""}
                      </span>
                    </div>
                  ))}
                  {!!m.repeatedReports.length && (
                    <div>
                      <h3 className="text-sm font-semibold">
                        Repeated reports
                      </h3>
                      {m.repeatedReports.map((r) => (
                        <p key={r.id} className="mt-2 break-words text-sm">
                          {r.issues.join(" · ")} — {r.reports} reports across{" "}
                          {r.trips} linked trips
                        </p>
                      ))}
                    </div>
                  )}
                  {(m.limits.attentionOmitted > 0 ||
                    m.limits.repeatedGroupsOmitted > 0) && (
                    <p className="text-xs">
                      More items are available in the original service records.
                    </p>
                  )}
                  <Link
                    className="inline-flex min-h-11 items-center text-sm underline"
                    href={m.source}
                  >
                    Open Service Due and original records
                  </Link>
                </>
              )}
            </Section>
            <Section
              title="Recorded financial results"
              section={data.sections.profitability}
            >
              {f && (
                <>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <Metric
                      label="Recorded rental income"
                      value={hubMoney(f.recordedIncome)}
                    />
                    <Metric
                      label="Recorded total expenses"
                      value={hubMoney(f.recordedExpenses)}
                    />
                    <Metric
                      label="Recorded car profit"
                      value={hubMoney(f.recordedCarProfit)}
                      tone={
                        f.recordedCarProfit == null
                          ? ""
                          : f.recordedCarProfit < 0
                            ? "text-red-700"
                            : "text-green-700"
                      }
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{f.formula}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Metric
                      label="Management split"
                      value={hubMoney(f.managementSplit)}
                    />
                    <Metric
                      label="Owner split"
                      value={hubMoney(f.ownerSplit)}
                    />
                  </div>
                  {f.notes.map((note) => (
                    <p className="text-xs text-muted-foreground" key={note}>
                      {note}
                    </p>
                  ))}
                  <Link
                    className="inline-flex min-h-11 items-center text-sm underline"
                    href={f.source}
                  >
                    Open source Totals
                  </Link>
                </>
              )}
            </Section>
            <Section
              title="Logged late-return alerts"
              section={data.sections.lateReturns}
            >
              {late && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Metric
                      label="Trips with overdue alerts"
                      value={late.overdueTripsLogged}
                    />
                    <Metric
                      label="Trips with resolution alerts"
                      value={late.resolutionAlertsLogged}
                    />
                  </div>
                  {late.notes.map((n) => (
                    <p key={n} className="text-xs text-muted-foreground">
                      {n}
                    </p>
                  ))}
                </>
              )}
            </Section>
            {data.sections.maintenance && (
              <section className="rounded-xl border bg-white p-4">
                <Button
                  variant="outline"
                  aria-expanded={evidenceOpen}
                  onClick={() => setEvidenceOpen(!evidenceOpen)}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  {evidenceOpen ? "Hide" : "Show"} service history and receipts
                </Button>
                {evidenceOpen && (
                  <Evidence
                    key={`${carId}:${params}`}
                    carId={carId}
                    params={params}
                    undated={undated}
                    onUndated={setUndated}
                  />
                )}
              </section>
            )}
            <details className="rounded-xl border bg-white p-4 text-sm">
              <summary className="cursor-pointer font-medium">
                Prepared for a future AI assistant
              </summary>
              <p className="mt-2">
                Download report contains a compact, structured summary with
                source references and missing-data notes. A future assistant can
                read this first and retrieve individual history pages only when
                needed. No AI assistant is connected yet.
              </p>
            </details>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
