import { useState } from "react";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pencil, History } from "lucide-react";
import { OperationEditHistoryList } from "@/components/admin/OperationEditHistory";
import type { CarServiceDue } from "./types";
import { ServiceDueWorkspace } from "./ServiceDueWorkspace";

type ServiceKind = "oil_change" | "tires" | "brakes" | "windshield" | "mechanic" | "license_registration";
const SERVICE_KIND_FIELD: Record<ServiceKind, string> = { oil_change: "oilLube", tires: "tires", brakes: "brakes", windshield: "windshield", mechanic: "mechanic", license_registration: "licenseRegistration" };
const SERVICE_KIND_LAST_LABEL: Record<ServiceKind, string> = { oil_change: "Last Oil Change", tires: "Last Tires", brakes: "Last Brakes", windshield: "Last Windshield", mechanic: "Last Mechanic", license_registration: "Last License & Reg." };

function ServiceCellEditPopover({
  carId,
  date,
  category,
  entityId,
  cellYear,
  cellMonth,
  onSaved,
}: {
  carId: number;
  /** The resolved ISO date this cell currently shows (the receipt / service
   *  date). May fall outside the I&E cell's month — write back using
   *  cellYear/cellMonth, not this date's own month. */
  date: string;
  category: ServiceKind;
  /** income_expense_service_dates.id for this cell, if an explicit override
   *  already exists — needed to look up its edit history. Null when the
   *  report is still falling back to the recorded COGS month (no override
   *  row yet), in which case there's no history to show. */
  entityId: number | null;
  /** I&E cell this date is stored on. */
  cellYear: number | null;
  cellMonth: number | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const d = new Date(date);
  const year = cellYear ?? d.getUTCFullYear();
  const month = cellMonth ?? d.getUTCMonth() + 1;
  const [value, setValue] = useState(date.slice(0, 10));

  const save = async (next: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) return;
    setSaving(true);
    try {
      const res = await fetch(buildApiUrl("/api/income-expense/service-date"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          carId,
          year,
          month,
          category: "cogs",
          field: SERVICE_KIND_FIELD[category],
          serviceDate: next,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Failed to save service date");
      toast({ title: "Service date updated" });
      setOpen(false);
      onSaved();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to save service date", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-primary"
          title="Edit service date"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="start">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Service date</label>
          <Input
            type="date"
            value={value}
            disabled={saving}
            onChange={(e) => setValue(e.target.value)}
            className="h-8"
          />
          <p className="text-[11px] text-muted-foreground">
            Date printed on the receipt. This is {SERVICE_KIND_LAST_LABEL[category]} and the date used to calculate Service Due.
          </p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button size="sm" disabled={saving || value === date.slice(0, 10)} onClick={() => save(value)}>
            {saving ? "Saving…" : "Save"}
          </Button>
          {entityId != null && (
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground" title="Edit history">
                  <History className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 max-h-80 overflow-y-auto">
                <OperationEditHistoryList entityType="service_date" entityId={entityId} />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function RegistrationEditPopover({
  carId,
  date,
  onSaved,
}: {
  carId: number;
  date: string | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [value, setValue] = useState(date ? date.slice(0, 10) : "");

  const save = async (next: string) => {
    setSaving(true);
    try {
      const res = await fetch(buildApiUrl(`/api/cars/${carId}/registration-expiration`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ registrationExpiration: next || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Failed to save registration expiration");
      toast({ title: next ? "Registration expiration updated" : "Registration expiration cleared" });
      setOpen(false);
      onSaved();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to save registration expiration", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="text-muted-foreground hover:text-primary" title="Edit registration expiration">
          <Pencil className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="start">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Registration expiration</label>
          <Input
            type="date"
            value={value}
            disabled={saving}
            onChange={(e) => setValue(e.target.value)}
            className="h-8"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button size="sm" disabled={saving || value === (date ? date.slice(0, 10) : "")} onClick={() => save(value)}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="text-muted-foreground hover:text-foreground" title="Edit history">
                <History className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 max-h-80 overflow-y-auto">
              <OperationEditHistoryList entityType="car_registration" entityId={carId} />
            </PopoverContent>
          </Popover>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ServiceDueTab() {
  return <ServiceDueWorkspace editor={(car, service, saved) => {
    if (!service.lastServiced || service.status === "not_applicable") return null;
    if (service.lastServicedSource === "maintenance") return <a className="inline-flex min-h-11 items-center text-xs underline" href={`/admin/operations?tab=maintenance&appointment=${service.maintenanceId}`}>Open maintenance record</a>;
    if (service.lastServicedSource === "record" || service.lastServicedSource === "legacy") return null;
    const kind = service.kind as ServiceKind;
    return <ServiceCellEditPopover carId={car.car_id} date={service.lastServiced} category={kind}
      entityId={car[`${kind}_service_date_id` as keyof CarServiceDue] as number | null}
      cellYear={car[`${kind}_year` as keyof CarServiceDue] as number | null}
      cellMonth={car[`${kind}_month` as keyof CarServiceDue] as number | null} onSaved={saved} />;
  }} registrationEditor={(car, saved) => <RegistrationEditPopover carId={car.car_id} date={car.registration_expiration} onSaved={saved} />} />;
}
