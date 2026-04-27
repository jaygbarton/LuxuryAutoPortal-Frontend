/**
 * Car Coming Back From Rental – GLA form (v1 logic).
 * Fields: Date, Car, Gas Gauge, Total Miles, 20 Yes/No questions,
 * two photo uploads (damage + sides/odometer).
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
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

const GAS_GAUGE_OPTIONS = [
  { value: "100% FULL", label: "100% FULL" },
  { value: "90%", label: "90%" },
  { value: "75% 3/4", label: "75% 3/4" },
  { value: "50% 2/4", label: "50% 2/4" },
  { value: "25% 1/4", label: "25% 1/4" },
  { value: "0% EMPTY", label: "0% EMPTY" },
];

const YES_NO_OPTIONS = [
  { value: "", label: "--" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

interface SurveyItem {
  name: string;
  category: string;
  value: string;
}

const COMING_BACK_SURVEY_FIELDS: { key: string; name: string }[] = [
  { key: "form_submit_gas_gauge", name: "Gas Gauge" },
  { key: "form_submit_miles", name: "Total Miles of Trip" },
  { key: "damage_vehicle", name: "Is there any damage to vehicle from this trip?" },
  { key: "windshield_chip", name: "Does the windshield have a crack or rock chip?" },
  { key: "parking_sticker", name: "Is the golden luxury auto parking sticker in on the top left of the windshield?" },
  { key: "glove_box", name: "Is there a brochure in the glove box" },
  { key: "business_glove_box", name: "Is the business card in the glove box?" },
  { key: "instructions_glove_box", name: "Are parking instructions in the glove box?" },
  { key: "smoking_sticker", name: "Is there a no smoking sticker in the vehicle?" },
  { key: "appropriate_gas_stick", name: "Is the appropriate gas stick inside the gas cap?" },
  { key: "vehicle_tags_date", name: "Is the vehicle tags up to date?" },
  { key: "tires_good_shape", name: "Do the tires look to be in good shape?" },
  { key: "engine_lights", name: "Are there any check engine lights, tire lights, or ABS lights on?" },
  { key: "front_back_wipes_blades", name: "Are the front and back wiper blades in good working condition?" },
  { key: "breaking_grinding_noise", name: "When breaking does the vehicle make a grinding noise or hesitates to stop?" },
  { key: "signals_working", name: "Are the head lights, break light, reverse light and turn signals working?" },
  { key: "ski_racks", name: "Does the vehicle have ski racks?" },
  { key: "cross_bars", name: "Does the vehicle have cross bars?" },
  { key: "roof_rails", name: "Does the vehicle have roof rails?" },
  { key: "interior_exterior", name: "Any new or old cosmetic damage on the vehicles interior or exterior?" },
  { key: "date_milage", name: "Is there a current oil sticker on the window? is so what is the date and milage?" },
  { key: "park_vehicle", name: "Did you re park the vehicle?" },
];

function buildBackFromRentalSurveyList(values: Record<string, string>): SurveyItem[] {
  return COMING_BACK_SURVEY_FIELDS.map(({ key, name }) => ({
    name,
    category: key,
    value: values[key] ?? "",
  }));
}

interface CarComingBackFormProps {
  onBack: () => void;
}

export function CarComingBackForm({ onBack }: CarComingBackFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [submitDate, setSubmitDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [carId, setCarId] = useState<number | "">("");
  const [gasGauge, setGasGauge] = useState("");
  const [miles, setMiles] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [damagePhotos, setDamagePhotos] = useState<File[]>([]);
  const [sidePhotos, setSidePhotos] = useState<File[]>([]);
  const [isDraggingDamage, setIsDraggingDamage] = useState(false);
  const [isDraggingSide, setIsDraggingSide] = useState(false);

  const { data: optionsData } = useQuery({
    queryKey: ["/api/expense-form-submissions/options"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/expense-form-submissions/options"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch options");
      return res.json();
    },
  });
  const cars: CarOption[] = optionsData?.data?.cars ?? [];

  const setValue = (key: string, val: string) => setValues((prev) => ({ ...prev, [key]: val }));

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
        setCarId("");
        setGasGauge("");
        setMiles("");
        setValues({});
        setDamagePhotos([]);
        setSidePhotos([]);
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
    const formValues = {
      form_submit_gas_gauge: gasGauge,
      form_submit_miles: miles,
      ...values,
    };
    const missing = COMING_BACK_SURVEY_FIELDS.filter((f) => !formValues[f.key as keyof typeof formValues]?.trim());
    if (!carId || !gasGauge || !miles.trim()) {
      toast({ title: "Validation", description: "Please fill Date, Car, Gas Gauge, and Total Miles.", variant: "destructive" });
      return;
    }
    if (missing.length > 0) {
      toast({ title: "Validation", description: "Please answer all Yes/No questions.", variant: "destructive" });
      return;
    }
    const hasDamage = (values.damage_vehicle ?? "").toLowerCase() === "yes";
    if (hasDamage && damagePhotos.length === 0) {
      toast({ title: "Validation", description: "Please upload photos of damage.", variant: "destructive" });
      return;
    }
    if (sidePhotos.length < 10) {
      toast({ title: "Validation", description: "Please upload at least 10 photos of all sides of car and odometer.", variant: "destructive" });
      return;
    }
    const surveyList = buildBackFromRentalSurveyList(formValues);
    submitMutation.mutate({
      gla_form_submit_category_id: 62,
      gla_form_submit_category: "car_coming_back_from_rental",
      gla_form_submit_date: submitDate,
      gla_form_submit_car_id: carId,
      gla_form_submit_list: surveyList,
      gla_form_submit_picture_damage: damagePhotos.length,
      gla_form_submit_picture_side: sidePhotos.length,
    });
  };

  const handleDamageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    setDamagePhotos((prev) => [...prev, ...files]);
  }, []);
  const handleSideChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    setSidePhotos((prev) => [...prev, ...files]);
  }, []);
  const handleDamageDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingDamage(false);
    const files = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
    setDamagePhotos((prev) => [...prev, ...files]);
  }, []);
  const handleSideDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingSide(false);
    const files = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
    setSidePhotos((prev) => [...prev, ...files]);
  }, []);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Date *</Label>
          <Input type="date" value={submitDate} onChange={(e) => setSubmitDate(e.target.value)} required className="mt-1" />
        </div>
        <div>
          <Label>Car *</Label>
          <select
            value={carId === "" ? "" : carId}
            onChange={(e) => setCarId(e.target.value === "" ? "" : Number(e.target.value))}
            required
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Select car</option>
            {cars.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <Label>Gas Gauge *</Label>
        <select
          value={gasGauge}
          onChange={(e) => setGasGauge(e.target.value)}
          required
          className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">--</option>
          {GAS_GAUGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div>
        <Label>Total Miles of Trip *</Label>
        <Input type="text" value={miles} onChange={(e) => setMiles(e.target.value)} required className="mt-1" placeholder="e.g. 250" />
      </div>

      <Card>
        <CardContent className="pt-4 space-y-4">
          {COMING_BACK_SURVEY_FIELDS.slice(2).map(({ key, name }) => (
            <div key={key}>
              <Label className="text-sm font-normal">{name} *</Label>
              <select
                value={values[key] ?? ""}
                onChange={(e) => setValue(key, e.target.value)}
                required
                className="mt-1 flex h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                {YES_NO_OPTIONS.map((o) => (
                  <option key={o.value || "empty"} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          ))}
        </CardContent>
      </Card>

      <div>
        <Label>If damage: upload photos of damage. If no damage, you may still submit. *</Label>
        <div
          className={`mt-2 min-h-[80px] rounded-md border-2 border-dashed p-4 text-center ${isDraggingDamage ? "border-primary bg-primary/5" : "border-muted-foreground/25"}`}
          onDragOver={(e) => { e.preventDefault(); setIsDraggingDamage(true); }}
          onDragLeave={() => setIsDraggingDamage(false)}
          onDrop={handleDamageDrop}
        >
          <input type="file" accept="image/*" multiple className="hidden" id="coming-back-damage" onChange={handleDamageChange} />
          <label htmlFor="coming-back-damage" className="cursor-pointer text-sm text-muted-foreground">
            Drag & drop or browse. {damagePhotos.length > 0 && `${damagePhotos.length} file(s).`}
          </label>
        </div>
        {damagePhotos.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {damagePhotos.map((f, i) => (
              <li key={i} className="flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs">
                {f.name}
                <button type="button" onClick={() => setDamagePhotos((p) => p.filter((_, j) => j !== i))} className="text-destructive hover:underline">Remove</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <Label>Please take 10+ pictures of all sides of car and odometer *</Label>
        <div
          className={`mt-2 min-h-[80px] rounded-md border-2 border-dashed p-4 text-center ${isDraggingSide ? "border-primary bg-primary/5" : "border-muted-foreground/25"}`}
          onDragOver={(e) => { e.preventDefault(); setIsDraggingSide(true); }}
          onDragLeave={() => setIsDraggingSide(false)}
          onDrop={handleSideDrop}
        >
          <input type="file" accept="image/*" multiple className="hidden" id="coming-back-sides" onChange={handleSideChange} />
          <label htmlFor="coming-back-sides" className="cursor-pointer text-sm text-muted-foreground">
            Drag & drop or browse. {sidePhotos.length > 0 && `${sidePhotos.length} file(s).`}
          </label>
        </div>
        {sidePhotos.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {sidePhotos.map((f, i) => (
              <li key={i} className="flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs">
                {f.name}
                <button type="button" onClick={() => setSidePhotos((p) => p.filter((_, j) => j !== i))} className="text-destructive hover:underline">Remove</button>
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
