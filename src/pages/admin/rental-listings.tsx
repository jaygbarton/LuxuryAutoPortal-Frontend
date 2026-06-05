import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { buildApiUrl, apiRequest } from "@/lib/queryClient";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Car, ArrowLeft, Search, ExternalLink } from "lucide-react";

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

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value === null || value === undefined || value === "" ? "—" : String(value)}</span>
    </div>
  );
}

/** Per-car listing detail with tabs. */
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
  const [details, setDetails] = useState<Record<string, any> | null>(null);
  const [guest, setGuest] = useState<Record<string, any> | null>(null);

  const d = details ?? listing?.details ?? {};
  const g = guest ?? listing?.guestInstructions ?? {};

  const saveDetails = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/rental-listings/${car.car_id}/details`, {
        price: d.price != null ? Number(d.price) : undefined,
        number_seats: d.number_seats != null ? Number(d.number_seats) : undefined,
        number_doors: d.number_doors != null ? Number(d.number_doors) : undefined,
        fuel_type: d.fuel_type,
        city_mpg: d.city_mpg != null ? Number(d.city_mpg) : undefined,
        hwy_mpg: d.hwy_mpg != null ? Number(d.hwy_mpg) : undefined,
        description: d.description,
        guidelines: d.guidelines,
        city: d.city, state: d.state, zip: d.zip, country: d.country,
      });
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Listing details updated." });
      qc.invalidateQueries({ queryKey: ["/api/rental-listings", car.car_id] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const saveGuest = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/rental-listings/${car.car_id}/guest-instructions`, {
        pickup_instruction: g.pickup_instruction,
        welcome_message: g.welcome_message,
        car_guide: g.car_guide,
      });
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Guest instructions updated." });
      qc.invalidateQueries({ queryKey: ["/api/rental-listings", car.car_id] });
    },
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
            <TabsTrigger value="guest">Guest Instructions</TabsTrigger>
            <TabsTrigger value="features">Features ({listing?.features?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="faq">FAQ ({listing?.faq?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="extras">Extras ({listing?.extras?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="locations">Locations ({listing?.locations?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="protection">Protection ({listing?.protection?.length ?? 0})</TabsTrigger>
          </TabsList>

          {/* Details (editable) */}
          <TabsContent value="details" className="space-y-3 pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <LabeledInput label="Daily Price ($)" value={d.price ?? ""} onChange={(v) => setDetails({ ...d, price: v })} type="number" />
              <LabeledInput label="Seats" value={d.number_seats ?? ""} onChange={(v) => setDetails({ ...d, number_seats: v })} type="number" />
              <LabeledInput label="Doors" value={d.number_doors ?? ""} onChange={(v) => setDetails({ ...d, number_doors: v })} type="number" />
              <LabeledInput label="Fuel Type" value={d.fuel_type ?? ""} onChange={(v) => setDetails({ ...d, fuel_type: v })} />
              <LabeledInput label="City MPG" value={d.city_mpg ?? ""} onChange={(v) => setDetails({ ...d, city_mpg: v })} type="number" />
              <LabeledInput label="Hwy MPG" value={d.hwy_mpg ?? ""} onChange={(v) => setDetails({ ...d, hwy_mpg: v })} type="number" />
              <LabeledInput label="City" value={d.city ?? ""} onChange={(v) => setDetails({ ...d, city: v })} />
              <LabeledInput label="State" value={d.state ?? ""} onChange={(v) => setDetails({ ...d, state: v })} />
            </div>
            <LabeledTextarea label="Description" value={d.description ?? ""} onChange={(v) => setDetails({ ...d, description: v })} />
            <LabeledTextarea label="Guidelines" value={d.guidelines ?? ""} onChange={(v) => setDetails({ ...d, guidelines: v })} />
            <Button onClick={() => saveDetails.mutate()} disabled={saveDetails.isPending}>
              {saveDetails.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save Details
            </Button>
          </TabsContent>

          {/* Price & Discount (read view of migrated data) */}
          <TabsContent value="pricing" className="pt-4">
            {listing?.priceAndDiscount ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Field label="Base Price" value={listing.priceAndDiscount.price} />
                <Field label="3 Day %" value={listing.priceAndDiscount.three_day} />
                <Field label="1 Week %" value={listing.priceAndDiscount.one_week} />
                <Field label="1 Month %" value={listing.priceAndDiscount.one_month} />
                <Field label="Last Minute %" value={listing.priceAndDiscount.last_minute} />
                <Field label="Early Bird %" value={listing.priceAndDiscount.early_bird} />
              </div>
            ) : <Empty />}
          </TabsContent>

          {/* Guest Instructions (editable) */}
          <TabsContent value="guest" className="space-y-3 pt-4">
            <LabeledTextarea label="Pickup Instruction" value={g.pickup_instruction ?? ""} onChange={(v) => setGuest({ ...g, pickup_instruction: v })} />
            <LabeledTextarea label="Welcome Message" value={g.welcome_message ?? ""} onChange={(v) => setGuest({ ...g, welcome_message: v })} />
            <LabeledTextarea label="Car Guide" value={g.car_guide ?? ""} onChange={(v) => setGuest({ ...g, car_guide: v })} />
            <Button onClick={() => saveGuest.mutate()} disabled={saveGuest.isPending}>
              {saveGuest.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save Guest Instructions
            </Button>
          </TabsContent>

          {/* Features */}
          <TabsContent value="features" className="pt-4">
            {listing?.features?.length ? (
              <div className="flex flex-wrap gap-2">
                {listing.features.map((f: any) => (
                  <span key={f.id} className="px-2.5 py-1 rounded-full bg-muted text-sm">{f.name}</span>
                ))}
              </div>
            ) : <Empty />}
          </TabsContent>

          {/* FAQ */}
          <TabsContent value="faq" className="space-y-3 pt-4">
            {listing?.faq?.length ? listing.faq.map((f: any) => (
              <div key={f.id} className="border-b border-border pb-2">
                <p className="font-medium text-sm">{f.question}</p>
                <p className="text-sm text-muted-foreground">{f.answer}</p>
              </div>
            )) : <Empty />}
          </TabsContent>

          {/* Extras */}
          <TabsContent value="extras" className="pt-4">
            {listing?.extras?.length ? (
              <div className="grid gap-2">
                {listing.extras.map((x: any) => (
                  <div key={x.id} className="flex items-center justify-between border border-border rounded-md px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{x.type}</p>
                      <p className="text-xs text-muted-foreground">{x.description}</p>
                    </div>
                    <span className="text-sm">${x.price}{x.is_per_day ? "/day" : x.is_per_trip ? "/trip" : ""}</span>
                  </div>
                ))}
              </div>
            ) : <Empty />}
          </TabsContent>

          {/* Locations */}
          <TabsContent value="locations" className="pt-4">
            {listing?.locations?.length ? (
              <div className="grid gap-2">
                {listing.locations.map((l: any) => (
                  <div key={l.id} className="border border-border rounded-md px-3 py-2">
                    <p className="text-sm font-medium">
                      {l.is_home ? "🏠 Home" : l.is_custom ? "Custom" : "Delivery"}
                      {l.landmark ? ` · ${l.landmark}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[l.street, l.city, l.state, l.zip].filter(Boolean).join(", ")}
                      {l.fee ? ` · fee $${l.fee}` : ""}{l.method ? ` · ${l.method}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            ) : <Empty />}
          </TabsContent>

          {/* Protection */}
          <TabsContent value="protection" className="pt-4">
            {listing?.protection?.length ? (
              <div className="grid gap-2">
                {listing.protection.map((p: any) => (
                  <div key={p.id} className="border border-border rounded-md px-3 py-2">
                    <p className="text-sm font-medium">{p.name} {p.price ? `· $${p.price}` : ""}</p>
                    <p className="text-xs text-muted-foreground">{p.description}</p>
                  </div>
                ))}
              </div>
            ) : <Empty />}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-muted-foreground py-6 text-center">No data for this section.</p>;
}

function LabeledInput({ label, value, onChange, type = "text" }: { label: string; value: any; onChange: (v: any) => void; type?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function LabeledTextarea({ label, value, onChange }: { label: string; value: any; onChange: (v: any) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} />
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
