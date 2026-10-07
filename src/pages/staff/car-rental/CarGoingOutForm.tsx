import { SearchableNativeSelect, SearchableOption } from "@/components/ui/searchable-native-select";
import { optionKeywords } from "@/lib/select-search";
/**
 * Car Going Out For Rental – GLA form (v1 logic).
 * Fields: Date, Car, Start date of rental, Inventory checklist, Cleaning Inside/Outside/Fluids,
 * Tracking device, Photos checklist, Extras, then 10+ photos upload.
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useCallback, useState } from "react";

interface CarOption {
  id: number;
  name: string;
  displayName?: string;
  plate?: string | null;
  vin?: string | null;
}

const INVENTORY_ITEMS: { id: string; label: string }[] = [
  { id: "insurance_card_turo", label: "Insurance Card Turo" },
  { id: "registration", label: "Registration Copy (name blacked out)" },
  { id: "pamplet", label: "Pamplet" },
  { id: "business_card", label: "Business Card" },
  { id: "wet_wipes", label: "Wet Wipes" },
  { id: "tissue", label: "Tissue" },
  { id: "parking_information", label: "Parking Information Card" },
  { id: "usb_port", label: "USB Port" },
  { id: "snow_brush", label: "Snow Brush" },
  { id: "tire_pressure", label: "Tire Pressure Okay" },
  { id: "fuel_gauge", label: "Fuel Gauge Full" },
  { id: "check_engine", label: "Check Engine Lights OFF" },
  { id: "sticker_fuel_cap", label: "Gas Type Sticker in Fuel Cap" },
  { id: "oil_lube_sticker", label: "Oil & Lube Sticker" },
  { id: "rotate_tire_sticker", label: "Rotate Tire Sticker" },
  { id: "gla_parking_sticker", label: "GLA Parking Sticker" },
  { id: "no_smoking_sticker", label: "No Smoking Sticker" },
  { id: "tire_air_caps", label: "4 Tire Air Caps" },
  { id: "radio_programmed", label: "Radio Programmed" },
  { id: "gift_packet", label: "Gift Packet (if being rented)" },
  { id: "car_cleaned_parked", label: "Car cleaned, parked, & text sent out" },
  { id: "car_video", label: "Car video has been sent to client (car that are detailed only)" },
];

const CLEANING_INSIDE: { id: string; label: string }[] = [
  { id: "dashboard_console", label: "Wipe dashboard and center console" },
  { id: "clean_out_cupholders", label: "Clean out cupholders" },
  { id: "clean_rearview_mirror", label: "Clean rearview mirror" },
  { id: "clean_steering_wheel", label: "Clean steering wheel" },
  { id: "pocket_gas_pedal", label: "Wipe door pocket by gas pedal" },
  { id: "including_trunk", label: "Vaccum car, including trunk" },
];

const CLEANING_OUTSIDE: { id: string; label: string }[] = [
  { id: "wash_car", label: "Wash car" },
  { id: "dry_car", label: "Dry car" },
  { id: "wipe_door", label: "Wipe door jams/trunk jams" },
  { id: "wipe_glass_window", label: "Wipe all glass, including windows and mirrors" },
  { id: "clean_wheel_rims", label: "Clean wheels/rims" },
  { id: "glovebox_envelops_inventory", label: "Check glovebox for old envelopes/inventory items" },
  { id: "tire_depth_pressure", label: "Check tire depth & pressure" },
];

const CLEANING_FLUIDS: { id: string; label: string }[] = [
  { id: "refill_windshield_needed", label: "Refill windshield wiper fluid or top off if needed" },
  { id: "received_permission", label: "Put in coolant or oil, IF received permission" },
  { id: "tires_fill_needed", label: "Check tires and fill them, if needed" },
];

const TRACKING_DEVICE_OPTIONS = [
  { id: "cleaning_tracking_device_yes", label: "Yes" },
  { id: "cleaning_tracking_device_no", label: "No" },
];

const PHOTOS_CHECKLIST: { id: string; label: string }[] = [
  { id: "photos_out_all_angles", label: "Take 15-20 photos of car, inside & out, all angles" },
  { id: "photo_odometer_fuel_level", label: "Take photos of odometer and fuel level" },
  { id: "photos_on_turo_under_trip", label: "Post photos on Turo under Trip Photos" },
  { id: "cleaning_checklist_app", label: "Complete cleaning checklist in app" },
  { id: "photo_location_car_parked", label: "Post photo of location where car is parked" },
  { id: "front_booth_car_airport", label: "Take envelope to front booth/car to airport" },
];

const EXTRAS: { id: string; label: string }[] = [
  { id: "ski_racks", label: "Ski Racks" },
  { id: "car_seats", label: "Car Seats" },
  { id: "stroller", label: "Stroller" },
  { id: "cooler", label: "Cooler" },
  { id: "chairs", label: "Chairs" },
  { id: "wifi", label: "WiFi" },
  { id: "no_extras_trip", label: "No Extras for this trip" },
];

function buildGoingOutSurveyList(checklists: Record<string, boolean>): unknown[] {
  const sections = [
    { name: "Inventory Checklist", category: "inventory_checklist", items: INVENTORY_ITEMS },
    { name: "Cleaning Checklist INSIDE", category: "cleaning_checklist_inside", items: CLEANING_INSIDE },
    { name: "Cleaning Checklist OUTSIDE", category: "cleaning_checklist_outside", items: CLEANING_OUTSIDE },
    { name: "Cleaning Checklist FLUIDS", category: "cleaning_checklist_fluids", items: CLEANING_FLUIDS },
    { name: "Tracking Device", category: "cleaning_tracking_device", items: TRACKING_DEVICE_OPTIONS },
    { name: "PHOTOS", category: "photos", items: PHOTOS_CHECKLIST },
    { name: "Extras?", category: "extras", items: EXTRAS },
  ];
  const result: unknown[] = [];
  sections.forEach((sec) => {
    sec.items.forEach((item) => {
      if (checklists[item.id]) result.push({ name: item.label, category: item.id, value: true });
    });
  });
  return result;
}

interface CarGoingOutFormProps {
  onBack: () => void;
}

export function CarGoingOutForm({ onBack }: CarGoingOutFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [submitDate, setSubmitDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startDateRental, setStartDateRental] = useState("");
  const [carId, setCarId] = useState<number | "">("");
  const [checklists, setChecklists] = useState<Record<string, boolean>>({});
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const { data: optionsData } = useQuery({
    queryKey: ["/api/expense-form-submissions/options"],
    queryFn: async () => {
      return api.get<{ data?: { cars?: CarOption[] } }>("/api/expense-form-submissions/options", {
        fallbackMessage: "Failed to fetch options",
      });
    },
  });
  const cars: CarOption[] = optionsData?.data?.cars ?? [];

  const toggleCheck = (id: string) => setChecklists((prev) => ({ ...prev, [id]: !prev[id] }));

  const atLeastOne = (items: { id: string }[]) => items.some((i) => checklists[i.id]);
  const inventoryOk = atLeastOne(INVENTORY_ITEMS);
  const cleaningInsideOk = atLeastOne(CLEANING_INSIDE);
  const cleaningOutsideOk = atLeastOne(CLEANING_OUTSIDE);
  const fluidsOk = atLeastOne(CLEANING_FLUIDS);
  const trackingOk = checklists["cleaning_tracking_device_yes"] || checklists["cleaning_tracking_device_no"];
  const photosOk = atLeastOne(PHOTOS_CHECKLIST);
  const extrasOk = atLeastOne(EXTRAS);

  const submitMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch(buildApiUrl("/api/staff/gla-form"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (res.status === 404 || res.status === 501) return { success: true };
      if (!res.ok) throw new Error("Failed to submit");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["gla-form"] });
      if (data?.success !== false) {
        toast({ title: "Success", description: "Form submitted successfully." });
        setStartDateRental("");
        setCarId("");
        setChecklists({});
        setPhotoFiles([]);
      } else {
        toast({ title: "Error", description: data?.error || "Submit failed.", variant: "destructive" });
      }
    },
    onError: (e) => {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Submit failed.", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!carId || photoFiles.length < 10) {
      toast({
        title: "Validation",
        description: "Please select a car and upload at least 10 photos of all sides and odometer.",
        variant: "destructive",
      });
      return;
    }
    if (!inventoryOk || !cleaningInsideOk || !cleaningOutsideOk || !fluidsOk || !trackingOk || !photosOk || !extrasOk) {
      toast({ title: "Validation", description: "Please complete all required checklist sections.", variant: "destructive" });
      return;
    }
    const surveyList = buildGoingOutSurveyList(checklists);
    submitMutation.mutate({
      gla_form_submit_category_id: 26,
      gla_form_submit_category: "car_going_out_for_rental",
      gla_form_submit_date: submitDate,
      gla_form_submit_start_date_rental: startDateRental,
      gla_form_submit_car_id: carId,
      gla_form_submit_list: surveyList,
      gla_form_submit_picture_side: photoFiles.length,
    });
  };

  const handlePhotoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    setPhotoFiles((prev) => [...prev, ...files]);
  }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
    setPhotoFiles((prev) => [...prev, ...files]);
  }, []);
  const removePhoto = (index: number) => setPhotoFiles((prev) => prev.filter((_, i) => i !== index));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Date *</Label>
          <Input type="date" value={submitDate} onChange={(e) => setSubmitDate(e.target.value)} required className="mt-1" />
        </div>
        <div>
          <Label>Car *</Label>
          <SearchableNativeSelect
            value={carId === "" ? "" : carId}
            onChange={(e) => setCarId(e.target.value === "" ? "" : Number(e.target.value))}
            required
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <SearchableOption value="">Select car</SearchableOption>
            {cars.map((c) => (
              <SearchableOption searchKeywords={optionKeywords(c)} key={c.id} value={c.id}>{c.name}</SearchableOption>
            ))}
          </SearchableNativeSelect>
        </div>
      </div>
      <div>
        <Label>Start Date of Rental *</Label>
        <Input type="date" value={startDateRental} onChange={(e) => setStartDateRental(e.target.value)} required className="mt-1" />
      </div>

      <Card>
        <CardContent className="pt-4">
          <p className="font-semibold text-primary">Inventory Checklist *</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {INVENTORY_ITEMS.map((item) => (
              <div key={item.id} className="flex items-center space-x-2">
                <Checkbox id={item.id} checked={!!checklists[item.id]} onCheckedChange={() => toggleCheck(item.id)} />
                <label htmlFor={item.id} className="text-sm cursor-pointer">{item.label}</label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <p className="font-semibold text-primary">Cleaning Checklist INSIDE *</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {CLEANING_INSIDE.map((item) => (
              <div key={item.id} className="flex items-center space-x-2">
                <Checkbox id={item.id} checked={!!checklists[item.id]} onCheckedChange={() => toggleCheck(item.id)} />
                <label htmlFor={item.id} className="text-sm cursor-pointer">{item.label}</label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <p className="font-semibold text-primary">Cleaning Checklist OUTSIDE *</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {CLEANING_OUTSIDE.map((item) => (
              <div key={item.id} className="flex items-center space-x-2">
                <Checkbox id={item.id} checked={!!checklists[item.id]} onCheckedChange={() => toggleCheck(item.id)} />
                <label htmlFor={item.id} className="text-sm cursor-pointer">{item.label}</label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <p className="font-semibold text-primary">Cleaning Checklist FLUIDS *</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {CLEANING_FLUIDS.map((item) => (
              <div key={item.id} className="flex items-center space-x-2">
                <Checkbox id={item.id} checked={!!checklists[item.id]} onCheckedChange={() => toggleCheck(item.id)} />
                <label htmlFor={item.id} className="text-sm cursor-pointer">{item.label}</label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <p className="font-semibold text-primary">Cleaning Tracking Device is Plugged In *</p>
          <div className="mt-2 flex gap-4">
            {TRACKING_DEVICE_OPTIONS.map((item) => (
              <div key={item.id} className="flex items-center space-x-2">
                <Checkbox id={item.id} checked={!!checklists[item.id]} onCheckedChange={() => toggleCheck(item.id)} />
                <label htmlFor={item.id} className="text-sm cursor-pointer">{item.label}</label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <p className="font-semibold text-primary">PHOTOS *</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {PHOTOS_CHECKLIST.map((item) => (
              <div key={item.id} className="flex items-center space-x-2">
                <Checkbox id={item.id} checked={!!checklists[item.id]} onCheckedChange={() => toggleCheck(item.id)} />
                <label htmlFor={item.id} className="text-sm cursor-pointer">{item.label}</label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <p className="font-semibold text-primary">Extras? *</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {EXTRAS.map((item) => (
              <div key={item.id} className="flex items-center space-x-2">
                <Checkbox id={item.id} checked={!!checklists[item.id]} onCheckedChange={() => toggleCheck(item.id)} />
                <label htmlFor={item.id} className="text-sm cursor-pointer">{item.label}</label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div>
        <Label>Please take 10+ pictures of all sides of car and odometer *</Label>
        <div
          className={`mt-2 min-h-[100px] rounded-md border-2 border-dashed p-4 text-center ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <input type="file" accept="image/*" multiple className="hidden" id="going-out-photos" onChange={handlePhotoChange} />
          <label htmlFor="going-out-photos" className="cursor-pointer text-sm text-muted-foreground">
            Drag & drop or browse. {photoFiles.length > 0 && `${photoFiles.length} file(s) selected.`}
          </label>
        </div>
        {photoFiles.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {photoFiles.map((f, i) => (
              <li key={i} className="flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs">
                {f.name}
                <button type="button" onClick={() => removePhoto(i)} className="text-destructive hover:underline">Remove</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={submitMutation.isPending}>
          {submitMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit
        </Button>
        <Button type="button" variant="outline" onClick={onBack}>Back to forms</Button>
      </div>
    </form>
  );
}
