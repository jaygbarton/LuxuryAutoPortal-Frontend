import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { buildApiUrl, apiRequest } from "@/lib/queryClient";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Car, ArrowLeft, Search, ExternalLink, Plus, Trash2, Save } from "lucide-react";

interface RentalCar {
  car_id: number;
  vin: string;
  year: number | null;
  make: string | null;
  specs: string | null;
  plate: string | null;
  photo: string | null;
  turo_link: string | null;
  price: number | null;
  city: string | null;
  state: string | null;
  is_listed: number;
}

const fmtCar = (c: RentalCar) =>
  [c.year, c.make, c.specs].filter(Boolean).join(" ") || c.vin;

function LabeledInput({ label, value, onChange, type = "text" }: { label: string; value: any; onChange: (v: any) => void; type?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function LabeledTextarea({ label, value, onChange }: { label: string; value: any; onChange: (v: any) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <Textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={3} />
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-muted-foreground py-4 text-center">No items yet.</p>;
}

/**
 * Generic editor for a child-list tab (features/faq/extras/locations/protection).
 * `fields` describes the editable columns; rows are created/updated/deleted via
 * /api/rental-listings/:carId/:kind[/:id].
 */
function ListEditor({
  carId, kind, rows, fields, onChanged,
}: {
  carId: number;
  kind: string;
  rows: any[];
  fields: { key: string; label: string; type?: string; full?: boolean }[];
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [editing, setEditing] = useState<Record<number, Record<string, any>>>({});

  const create = useMutation({
    mutationFn: async () => { await apiRequest("POST", `/api/rental-listings/${carId}/${kind}`, draft); },
    onSuccess: () => { setDraft({}); onChanged(); toast({ title: "Added" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const update = useMutation({
    mutationFn: async (id: number) => { await apiRequest("PUT", `/api/rental-listings/${carId}/${kind}/${id}`, editing[id]); },
    onSuccess: (_d, id) => { setEditing((p) => { const n = { ...p }; delete n[id]; return n; }); onChanged(); toast({ title: "Saved" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const remove = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/rental-listings/${carId}/${kind}/${id}`); },
    onSuccess: () => { onChanged(); toast({ title: "Deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      {/* Existing rows */}
      {rows.length === 0 ? <Empty /> : (
        <div className="space-y-2">
          {rows.map((row) => {
            const ed = editing[row.id];
            return (
              <div key={row.id} className="border border-border rounded-md p-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {fields.map((f) => {
                    const val = ed ? ed[f.key] : row[f.key];
                    return (
                      <div key={f.key} className={f.full ? "md:col-span-2" : ""}>
                        {f.full ? (
                          <LabeledTextarea label={f.label} value={val}
                            onChange={(v) => setEditing((p) => ({ ...p, [row.id]: { ...(p[row.id] ?? row), [f.key]: v } }))} />
                        ) : (
                          <LabeledInput label={f.label} value={val} type={f.type}
                            onChange={(v) => setEditing((p) => ({ ...p, [row.id]: { ...(p[row.id] ?? row), [f.key]: v } }))} />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2 mt-2">
                  {ed && (
                    <Button size="sm" onClick={() => update.mutate(row.id)} disabled={update.isPending}>
                      <Save className="w-3.5 h-3.5 mr-1" /> Save
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" onClick={() => { if (confirm("Delete this item?")) remove.mutate(row.id); }}>
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add new */}
      <div className="border border-dashed border-border rounded-md p-3">
        <p className="text-xs font-medium text-muted-foreground mb-2">Add new</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {fields.map((f) => (
            <div key={f.key} className={f.full ? "md:col-span-2" : ""}>
              {f.full ? (
                <LabeledTextarea label={f.label} value={draft[f.key]} onChange={(v) => setDraft({ ...draft, [f.key]: v })} />
              ) : (
                <LabeledInput label={f.label} value={draft[f.key]} type={f.type} onChange={(v) => setDraft({ ...draft, [f.key]: v })} />
              )}
            </div>
          ))}
        </div>
        <Button size="sm" className="mt-2" onClick={() => create.mutate()} disabled={create.isPending}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add
        </Button>
      </div>
    </div>
  );
}

/** Format an API date value (ISO string or Date) to YYYY-MM-DD without TZ drift. */
function fmtDate(v: any): string {
  if (!v) return "";
  const s = String(v);
  // ISO-ish strings start with YYYY-MM-DD; take that prefix directly.
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
}

/** Daily prices: list by year + set a date's price. */
function DailyPricesTab({ carId }: { carId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");

  const { data, isLoading } = useQuery<{ success: boolean; list: any[] }>({
    queryKey: ["/api/rental-listings", carId, "daily-prices", year],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/rental-listings/${carId}/daily-prices?year=${year}`), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load daily prices");
      return res.json();
    },
  });

  const setPrice = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/rental-listings/${carId}/daily-price`, { price_date: date, amount: Number(amount) });
    },
    onSuccess: () => {
      setDate(""); setAmount("");
      qc.invalidateQueries({ queryKey: ["/api/rental-listings", carId, "daily-prices", year] });
      toast({ title: "Price set" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const rows = data?.list ?? [];
  const yearOpts = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Year</label>
          <select className="border border-border rounded-md h-9 px-2 text-sm bg-background" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {yearOpts.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Set date</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Amount ($)</label>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-28" />
        </div>
        <Button size="sm" disabled={!date || !amount || setPrice.isPending} onClick={() => setPrice.mutate()}>
          {setPrice.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Set Price
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No daily prices for {year}.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5 max-h-80 overflow-y-auto">
          {rows.map((r) => (
            <div key={r.id} className="flex justify-between border border-border rounded px-2 py-1 text-xs">
              <span>{fmtDate(r.price_date)}</span>
              <span className="font-medium">${r.amount}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ListingDetail({ car, onBack }: { car: RentalCar; onBack: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ success: boolean; data: any }>({
    queryKey: ["/api/rental-listings", car.car_id],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/rental-listings/${car.car_id}`), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load listing");
      return res.json();
    },
  });
  const listing = data?.data;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/rental-listings", car.car_id] });

  const [details, setDetails] = useState<Record<string, any> | null>(null);
  const [guest, setGuest] = useState<Record<string, any> | null>(null);
  const [pricing, setPricing] = useState<Record<string, any> | null>(null);
  const [trip, setTrip] = useState<Record<string, any> | null>(null);

  // Reset local drafts when the loaded listing changes.
  useEffect(() => { setDetails(null); setGuest(null); setPricing(null); setTrip(null); }, [listing]);

  const d = details ?? listing?.details ?? {};
  const g = guest ?? listing?.guestInstructions ?? {};
  const p = pricing ?? listing?.priceAndDiscount ?? {};
  const t = trip ?? listing?.tripPreferences ?? {};

  const num = (v: any) => (v === "" || v == null ? undefined : Number(v));

  const saveDetails = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/rental-listings/${car.car_id}/details`, {
        price: num(d.price), number_seats: num(d.number_seats), number_doors: num(d.number_doors),
        fuel_type: d.fuel_type, city_mpg: num(d.city_mpg), hwy_mpg: num(d.hwy_mpg),
        description: d.description, guidelines: d.guidelines, city: d.city, state: d.state, zip: d.zip, country: d.country,
      });
    },
    onSuccess: () => { toast({ title: "Saved" }); invalidate(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const saveGuest = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/rental-listings/${car.car_id}/guest-instructions`, {
        pickup_instruction: g.pickup_instruction, welcome_message: g.welcome_message, car_guide: g.car_guide,
      });
    },
    onSuccess: () => { toast({ title: "Saved" }); invalidate(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const savePricing = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/rental-listings/${car.car_id}/price-and-discount`, {
        price: num(p.price), last_minute: num(p.last_minute), non_refundable: num(p.non_refundable),
        three_day: num(p.three_day), one_week: num(p.one_week), two_week: num(p.two_week), three_week: num(p.three_week),
        one_month: num(p.one_month), two_month: num(p.two_month), three_month: num(p.three_month), early_bird: num(p.early_bird),
      });
    },
    onSuccess: () => { toast({ title: "Saved" }); invalidate(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const saveTrip = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/rental-listings/${car.car_id}/trip-preferences`, {
        home_advance: t.home_advance, home_buffer: t.home_buffer, home_shortest: t.home_shortest, home_longest: t.home_longest,
        delivery_advance: t.delivery_advance, delivery_buffer: t.delivery_buffer, delivery_shortest: t.delivery_shortest, delivery_longest: t.delivery_longest,
        custom_advance: t.custom_advance, custom_buffer: t.custom_buffer, custom_shortest: t.custom_shortest, custom_longest: t.custom_longest,
        is_two_days_minimum: t.is_two_days_minimum ? 1 : 0,
      });
    },
    onSuccess: () => { toast({ title: "Saved" }); invalidate(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        <div>
          <h2 className="text-lg font-semibold">{fmtCar(car)}</h2>
          <p className="text-xs text-muted-foreground">{car.vin}{car.plate ? ` · ${car.plate}` : ""}</p>
        </div>
        {car.turo_link && (
          <a href={car.turo_link} target="_blank" rel="noreferrer" className="ml-auto text-sm text-primary inline-flex items-center gap-1">
            Turo listing <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <Tabs defaultValue="details">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="pricing">Price &amp; Discount</TabsTrigger>
            <TabsTrigger value="daily">Daily Prices</TabsTrigger>
            <TabsTrigger value="guest">Guest Instructions</TabsTrigger>
            <TabsTrigger value="trip">Trip Preferences</TabsTrigger>
            <TabsTrigger value="features">Features ({listing?.features?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="faq">FAQ ({listing?.faq?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="extras">Extras ({listing?.extras?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="locations">Locations ({listing?.locations?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="protection">Protection ({listing?.protection?.length ?? 0})</TabsTrigger>
          </TabsList>

          {/* Details */}
          <TabsContent value="details" className="space-y-3 pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <LabeledInput label="Daily Price ($)" value={d.price} type="number" onChange={(v) => setDetails({ ...d, price: v })} />
              <LabeledInput label="Seats" value={d.number_seats} type="number" onChange={(v) => setDetails({ ...d, number_seats: v })} />
              <LabeledInput label="Doors" value={d.number_doors} type="number" onChange={(v) => setDetails({ ...d, number_doors: v })} />
              <LabeledInput label="Fuel Type" value={d.fuel_type} onChange={(v) => setDetails({ ...d, fuel_type: v })} />
              <LabeledInput label="City MPG" value={d.city_mpg} type="number" onChange={(v) => setDetails({ ...d, city_mpg: v })} />
              <LabeledInput label="Hwy MPG" value={d.hwy_mpg} type="number" onChange={(v) => setDetails({ ...d, hwy_mpg: v })} />
              <LabeledInput label="City" value={d.city} onChange={(v) => setDetails({ ...d, city: v })} />
              <LabeledInput label="State" value={d.state} onChange={(v) => setDetails({ ...d, state: v })} />
            </div>
            <LabeledTextarea label="Description" value={d.description} onChange={(v) => setDetails({ ...d, description: v })} />
            <LabeledTextarea label="Guidelines" value={d.guidelines} onChange={(v) => setDetails({ ...d, guidelines: v })} />
            <Button onClick={() => saveDetails.mutate()} disabled={saveDetails.isPending}>
              {saveDetails.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save Details
            </Button>
          </TabsContent>

          {/* Price & Discount (editable) */}
          <TabsContent value="pricing" className="space-y-3 pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <LabeledInput label="Base Price ($)" value={p.price} type="number" onChange={(v) => setPricing({ ...p, price: v })} />
              <LabeledInput label="Last Minute %" value={p.last_minute} type="number" onChange={(v) => setPricing({ ...p, last_minute: v })} />
              <LabeledInput label="Non-Refundable %" value={p.non_refundable} type="number" onChange={(v) => setPricing({ ...p, non_refundable: v })} />
              <LabeledInput label="3-Day %" value={p.three_day} type="number" onChange={(v) => setPricing({ ...p, three_day: v })} />
              <LabeledInput label="1-Week %" value={p.one_week} type="number" onChange={(v) => setPricing({ ...p, one_week: v })} />
              <LabeledInput label="2-Week %" value={p.two_week} type="number" onChange={(v) => setPricing({ ...p, two_week: v })} />
              <LabeledInput label="3-Week %" value={p.three_week} type="number" onChange={(v) => setPricing({ ...p, three_week: v })} />
              <LabeledInput label="1-Month %" value={p.one_month} type="number" onChange={(v) => setPricing({ ...p, one_month: v })} />
              <LabeledInput label="2-Month %" value={p.two_month} type="number" onChange={(v) => setPricing({ ...p, two_month: v })} />
              <LabeledInput label="3-Month %" value={p.three_month} type="number" onChange={(v) => setPricing({ ...p, three_month: v })} />
              <LabeledInput label="Early Bird %" value={p.early_bird} type="number" onChange={(v) => setPricing({ ...p, early_bird: v })} />
            </div>
            <Button onClick={() => savePricing.mutate()} disabled={savePricing.isPending}>
              {savePricing.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save Price &amp; Discount
            </Button>
          </TabsContent>

          {/* Daily Prices */}
          <TabsContent value="daily" className="pt-4">
            <DailyPricesTab carId={car.car_id} />
          </TabsContent>

          {/* Guest Instructions */}
          <TabsContent value="guest" className="space-y-3 pt-4">
            <LabeledTextarea label="Pickup Instruction" value={g.pickup_instruction} onChange={(v) => setGuest({ ...g, pickup_instruction: v })} />
            <LabeledTextarea label="Welcome Message" value={g.welcome_message} onChange={(v) => setGuest({ ...g, welcome_message: v })} />
            <LabeledTextarea label="Car Guide" value={g.car_guide} onChange={(v) => setGuest({ ...g, car_guide: v })} />
            <Button onClick={() => saveGuest.mutate()} disabled={saveGuest.isPending}>
              {saveGuest.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save Guest Instructions
            </Button>
          </TabsContent>

          {/* Trip Preferences (editable) */}
          <TabsContent value="trip" className="space-y-3 pt-4">
            {(["home", "delivery", "custom"] as const).map((scope) => (
              <div key={scope}>
                <p className="text-xs font-medium uppercase text-muted-foreground mb-1">{scope}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <LabeledInput label="Advance notice" value={t[`${scope}_advance`]} onChange={(v) => setTrip({ ...t, [`${scope}_advance`]: v })} />
                  <LabeledInput label="Buffer" value={t[`${scope}_buffer`]} onChange={(v) => setTrip({ ...t, [`${scope}_buffer`]: v })} />
                  <LabeledInput label="Shortest trip" value={t[`${scope}_shortest`]} onChange={(v) => setTrip({ ...t, [`${scope}_shortest`]: v })} />
                  <LabeledInput label="Longest trip" value={t[`${scope}_longest`]} onChange={(v) => setTrip({ ...t, [`${scope}_longest`]: v })} />
                </div>
              </div>
            ))}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!Number(t.is_two_days_minimum)} onChange={(e) => setTrip({ ...t, is_two_days_minimum: e.target.checked ? 1 : 0 })} />
              Require 2-day minimum
            </label>
            <Button onClick={() => saveTrip.mutate()} disabled={saveTrip.isPending}>
              {saveTrip.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save Trip Preferences
            </Button>
          </TabsContent>

          {/* Child-list tabs */}
          <TabsContent value="features" className="pt-4">
            <ListEditor carId={car.car_id} kind="features" rows={listing?.features ?? []} onChanged={invalidate}
              fields={[{ key: "name", label: "Feature name" }]} />
          </TabsContent>
          <TabsContent value="faq" className="pt-4">
            <ListEditor carId={car.car_id} kind="faq" rows={listing?.faq ?? []} onChanged={invalidate}
              fields={[{ key: "question", label: "Question" }, { key: "answer", label: "Answer", full: true }]} />
          </TabsContent>
          <TabsContent value="extras" className="pt-4">
            <ListEditor carId={car.car_id} kind="extras" rows={listing?.extras ?? []} onChanged={invalidate}
              fields={[
                { key: "type", label: "Type" }, { key: "price", label: "Price ($)", type: "number" },
                { key: "quantity", label: "Quantity", type: "number" }, { key: "description", label: "Description", full: true },
              ]} />
          </TabsContent>
          <TabsContent value="locations" className="pt-4">
            <ListEditor carId={car.car_id} kind="locations" rows={listing?.locations ?? []} onChanged={invalidate}
              fields={[
                { key: "landmark", label: "Landmark" }, { key: "street", label: "Street" },
                { key: "city", label: "City" }, { key: "state", label: "State" }, { key: "zip", label: "Zip" },
                { key: "fee", label: "Fee ($)" }, { key: "method", label: "Check-in method" },
                { key: "instruction", label: "Instruction", full: true },
              ]} />
          </TabsContent>
          <TabsContent value="protection" className="pt-4">
            <ListEditor carId={car.car_id} kind="protection" rows={listing?.protection ?? []} onChanged={invalidate}
              fields={[
                { key: "name", label: "Name" }, { key: "price", label: "Price ($)", type: "number" },
                { key: "description", label: "Description", full: true },
              ]} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

export default function RentalListingsPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<RentalCar | null>(null);

  const { data, isLoading } = useQuery<{ success: boolean; list: RentalCar[] }>({
    queryKey: ["/api/rental-listings/cars", search],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/rental-listings/cars?search=${encodeURIComponent(search)}`), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load rental cars");
      return res.json();
    },
  });

  const cars = data?.list ?? [];

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary flex items-center gap-2">
            <Car className="w-6 h-6" /> Rental Listings
          </h1>
          <p className="text-muted-foreground">Turo listing configuration per car (migrated from the previous system).</p>
        </div>

        {selected ? (
          <ListingDetail car={selected} onBack={() => setSelected(null)} />
        ) : (
          <>
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search make, year, VIN…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            {isLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : cars.length === 0 ? (
              <p className="text-sm text-muted-foreground py-16 text-center">No rental listings found.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {cars.map((c) => (
                  <button
                    key={c.car_id}
                    onClick={() => setSelected(c)}
                    className="flex gap-3 items-center text-left border border-border rounded-lg p-3 bg-card hover:shadow-md transition-shadow"
                  >
                    <div className="w-20 h-16 rounded-md bg-muted overflow-hidden flex-shrink-0">
                      {c.photo ? <img src={c.photo} alt="" className="w-full h-full object-cover" /> : <Car className="w-6 h-6 m-auto mt-5 text-muted-foreground/40" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{fmtCar(c)}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.vin}</p>
                      <p className="text-xs mt-0.5">
                        {c.price != null ? `$${c.price}/day` : "no price"}
                        {c.city ? ` · ${c.city}, ${c.state ?? ""}` : ""}
                        <span className={`ml-1 ${c.is_listed ? "text-green-600" : "text-muted-foreground"}`}>
                          {c.is_listed ? "Listed" : "Unlisted"}
                        </span>
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
