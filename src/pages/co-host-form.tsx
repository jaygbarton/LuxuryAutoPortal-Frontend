import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Loader2, X, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

const schema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  middleName: z.string().optional().default(""),
  email: z.string().email("Invalid email").min(1, "Required"),
  birthday: z.string().min(1, "Required"),
  maritalStatus: z.string().min(1, "Required"),
  street: z.string().min(1, "Required"),
  city: z.string().min(1, "Required"),
  state: z.string().min(1, "Required"),
  country: z.string().min(1, "Required"),
  zipCode: z.string().min(1, "Required"),
  telephone: z.string().optional().default(""),
  mobileNumber: z.string().min(1, "Required"),
  motherName: z.string().min(1, "Required"),
  fatherName: z.string().min(1, "Required"),
  homeContact: z.string().min(1, "Required"),
  homeAddress: z.string().min(1, "Required"),
  emergencyContactPerson: z.string().min(1, "Required"),
  emergencyRelationship: z.string().min(1, "Required"),
  emergencyAddress: z.string().min(1, "Required"),
  emergencyNumber: z.string().min(1, "Required"),
  ssnEin: z.string().min(1, "Required"),
  shirtSize: z.string().min(1, "Required"),
  // Vehicle fields — only required when ownsVehicle = true
  vehicleMake: z.string().optional().default(""),
  vehicleModel: z.string().optional().default(""),
  vehicleYear: z.string().optional().default(""),
  vehicleTrim: z.string().optional().default(""),
  vehicleMiles: z.string().optional().default(""),
  exteriorColor: z.string().optional().default(""),
  interiorColor: z.string().optional().default(""),
  titleType: z.string().optional().default(""),
  vehicleVin: z.string().optional().default(""),
  vehicleLicensePlate: z.string().optional().default(""),
  registrationExpiration: z.string().optional().default(""),
  vehicleRecall: z.string().optional().default(""),
  numberOfSeats: z.string().optional().default(""),
  numberOfDoors: z.string().optional().default(""),
  skiRacks: z.string().optional().default(""),
  skiCrossBars: z.string().optional().default(""),
  roofRails: z.string().optional().default(""),
  lastOilChange: z.string().optional().default(""),
  oilType: z.string().optional().default(""),
  freeDealershipOilChanges: z.string().optional().default(""),
  oilPackageDetails: z.string().optional().default(""),
  dealershipAddress: z.string().optional().default(""),
  fuelType: z.string().optional().default(""),
  tireSize: z.string().optional().default(""),
  vehicleFeatures: z.array(z.string()).optional().default([]),
  turoProfileUrl: z.string().optional().default(""),
  // Insurance
  insuranceProvider: z.string().optional().default(""),
  insurancePhone: z.string().optional().default(""),
  policyNumber: z.string().optional().default(""),
  insuranceExpiration: z.string().optional().default(""),
  // Purchase
  purchasePrice: z.string().optional().default(""),
  interestRate: z.string().optional().default(""),
  monthlyPayment: z.string().optional().default(""),
  downPayment: z.string().optional().default(""),
  transportCityToCity: z.string().optional().default(""),
  ultimateGoal: z.string().optional().default(""),
  // ACH
  bankName: z.string().optional().default(""),
  taxClassification: z.string().optional().default(""),
  routingNumber: z.string().optional().default(""),
  accountNumber: z.string().optional().default(""),
  businessName: z.string().optional().default(""),
  ein: z.string().optional().default(""),
  bankAccountInfo: z.string().optional().default(""),
  // Car login
  carManufacturerWebsite: z.string().optional().default(""),
  carManufacturerUsername: z.string().optional().default(""),
  carPassword: z.string().optional().default(""),
});

type FormData = z.infer<typeof schema>;

const ACCEPTED_DOC_TYPES = "image/jpeg,image/jpg,image/png,image/gif,image/webp,application/pdf";
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const VEHICLE_FEATURES_LIST = [
  "All-wheel drive", "AUX input", "Blind Spot Warning", "Convertible",
  "Keyless Entry", "Snow Tires or Chains", "USB Charger", "Android Auto",
  "Back Up Camera", "Bluetooth", "GPS", "Pet Friendly",
  "Sunroof", "USB Input", "Apple CarPlay", "Bike Rack",
  "Toll Pass", "Wheelchair Accessible",
];

export default function CoHostFormPage() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [ownsVehicle, setOwnsVehicle] = useState(false);
  const [driverLicenseFile, setDriverLicenseFile] = useState<File | null>(null);
  const [carInsuranceFile, setCarInsuranceFile] = useState<File | null>(null);
  const [vehicleRegistrationFile, setVehicleRegistrationFile] = useState<File | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: "", lastName: "", middleName: "", email: "",
      birthday: "", maritalStatus: "",
      street: "", city: "", state: "", country: "", zipCode: "",
      telephone: "", mobileNumber: "",
      motherName: "", fatherName: "", homeContact: "", homeAddress: "",
      emergencyContactPerson: "", emergencyRelationship: "", emergencyAddress: "", emergencyNumber: "",
      ssnEin: "", shirtSize: "",
      vehicleMake: "", vehicleModel: "", vehicleYear: "", vehicleTrim: "",
      vehicleMiles: "", exteriorColor: "", interiorColor: "", titleType: "",
      vehicleVin: "", vehicleLicensePlate: "", registrationExpiration: "",
      vehicleRecall: "", numberOfSeats: "", numberOfDoors: "",
      skiRacks: "", skiCrossBars: "", roofRails: "",
      lastOilChange: "", oilType: "", freeDealershipOilChanges: "",
      oilPackageDetails: "", dealershipAddress: "", fuelType: "", tireSize: "",
      vehicleFeatures: [], turoProfileUrl: "",
      insuranceProvider: "", insurancePhone: "", policyNumber: "", insuranceExpiration: "",
      purchasePrice: "", interestRate: "", monthlyPayment: "", downPayment: "",
      transportCityToCity: "", ultimateGoal: "",
      bankName: "", taxClassification: "", routingNumber: "", accountNumber: "",
      businessName: "", ein: "", bankAccountInfo: "",
      carManufacturerWebsite: "", carManufacturerUsername: "", carPassword: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormData) => {
      if (ownsVehicle) {
        const requiredVehicleFields: (keyof FormData)[] = [
          "vehicleMake", "vehicleModel", "vehicleYear", "vehicleTrim", "vehicleMiles",
          "exteriorColor", "interiorColor", "titleType", "vehicleVin", "vehicleLicensePlate",
          "registrationExpiration", "vehicleRecall", "numberOfSeats", "numberOfDoors",
          "skiRacks", "skiCrossBars", "roofRails", "lastOilChange", "oilType",
          "freeDealershipOilChanges", "fuelType", "tireSize",
          "insuranceProvider", "insurancePhone", "policyNumber", "insuranceExpiration",
          "purchasePrice", "interestRate", "monthlyPayment", "downPayment",
          "transportCityToCity", "ultimateGoal",
          "bankName", "taxClassification", "routingNumber", "accountNumber",
          "carManufacturerWebsite", "carManufacturerUsername", "carPassword",
        ];
        const missing = requiredVehicleFields.filter((f) => !values[f]);
        if (missing.length > 0) throw new Error("Please fill in all required vehicle fields.");
        if (!values.vehicleFeatures || values.vehicleFeatures.length === 0)
          throw new Error("Please select at least one vehicle feature.");
      }

      if (driverLicenseFile && driverLicenseFile.size > MAX_FILE_SIZE_BYTES)
        throw new Error(`Driver's license must be under ${MAX_FILE_SIZE_MB}MB`);
      if (carInsuranceFile && carInsuranceFile.size > MAX_FILE_SIZE_BYTES)
        throw new Error(`Car insurance must be under ${MAX_FILE_SIZE_MB}MB`);
      if (vehicleRegistrationFile && vehicleRegistrationFile.size > MAX_FILE_SIZE_BYTES)
        throw new Error(`Vehicle registration must be under ${MAX_FILE_SIZE_MB}MB`);

      const payload = { ...values, ownsVehicle, link: window.location.origin };
      const formData = new FormData();
      formData.append("data", JSON.stringify(payload));
      if (driverLicenseFile) formData.append("driver_license", driverLicenseFile, driverLicenseFile.name);
      if (carInsuranceFile) formData.append("car_insurance", carInsuranceFile, carInsuranceFile.name);
      if (vehicleRegistrationFile) formData.append("vehicle_registration", vehicleRegistrationFile, vehicleRegistrationFile.name);

      const response = await fetch(buildApiUrl("/api/co-hosts/onboarding/submit"), {
        method: "POST",
        body: formData,
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.error || json?.message || "Failed to submit form");
      return json;
    },
    onSuccess: () => {
      setDriverLicenseFile(null);
      setCarInsuranceFile(null);
      setVehicleRegistrationFile(null);
      setSubmitted(true);
    },
    onError: (e: any) => {
      toast({
        title: "Submission Failed",
        description: e.message || "Please check the form and try again.",
        variant: "destructive",
      });
    },
  });

  const [, setLocation] = useLocation();
  const { register, handleSubmit, formState, setValue, watch } = form;
  const { errors } = formState;

  const freeOilChanges = watch("freeDealershipOilChanges");
  const vehicleFeatures = watch("vehicleFeatures") || [];

  if (submitted) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <Card className="bg-card border-border max-w-md w-full">
          <CardContent className="p-6 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <h1 className="text-xl font-semibold text-primary">Success!</h1>
            <p className="text-muted-foreground text-sm">
              Your co-host onboarding form has been submitted. We will review your information and reach out soon.
            </p>
            <Button type="button" variant="outline" className="mt-2" onClick={() => setLocation("/")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-start justify-center p-4">
      <div className="w-full max-w-3xl space-y-6">
        <div className="text-center">
          <img src="/logo.png" alt="Golden Luxury Auto" className="h-10 mx-auto mb-3" />
          <h1 className="text-2xl sm:text-3xl font-serif text-primary italic">Co-Host Onboarding</h1>
          <p className="text-muted-foreground text-sm mt-1">Please complete your personal and vehicle information.</p>
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-6 space-y-8">
            <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="space-y-8">

              {/* Basic Information */}
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-primary border-b border-primary/30 pb-2">Basic Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">First Name *</Label>
                    <Input {...register("firstName")} className="bg-card border-border text-foreground" />
                    {errors.firstName && <p className="text-red-700 text-xs">{errors.firstName.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Last Name *</Label>
                    <Input {...register("lastName")} className="bg-card border-border text-foreground" />
                    {errors.lastName && <p className="text-red-700 text-xs">{errors.lastName.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Middle Name</Label>
                    <Input {...register("middleName")} className="bg-card border-border text-foreground" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Email *</Label>
                    <Input {...register("email")} type="email" className="bg-card border-border text-foreground" />
                    {errors.email && <p className="text-red-700 text-xs">{errors.email.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Birthday *</Label>
                    <Input
                      {...register("birthday")}
                      type="date"
                      className="bg-card border-border text-foreground [&::-webkit-calendar-picker-indicator]:invert [&::-moz-calendar-picker-indicator]:invert"
                    />
                    {errors.birthday && <p className="text-red-700 text-xs">{errors.birthday.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Marital Status *</Label>
                    <Select
                      value={watch("maritalStatus")}
                      onValueChange={(v) => setValue("maritalStatus", v, { shouldValidate: true })}
                    >
                      <SelectTrigger className="bg-card border-border text-foreground">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border text-foreground">
                        <SelectItem value="single">Single</SelectItem>
                        <SelectItem value="married">Married</SelectItem>
                        <SelectItem value="divorced">Divorced</SelectItem>
                        <SelectItem value="annulled">Annulled</SelectItem>
                        <SelectItem value="legally separated">Legally Separated</SelectItem>
                        <SelectItem value="widowed">Widowed</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.maritalStatus && <p className="text-red-700 text-xs">{errors.maritalStatus.message}</p>}
                  </div>
                </div>
              </section>

              {/* Address & Contact */}
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-primary border-b border-primary/30 pb-2">Address & Contact</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-muted-foreground">Street *</Label>
                    <Input {...register("street")} className="bg-card border-border text-foreground" />
                    {errors.street && <p className="text-red-700 text-xs">{errors.street.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">City *</Label>
                    <Input {...register("city")} className="bg-card border-border text-foreground" />
                    {errors.city && <p className="text-red-700 text-xs">{errors.city.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">State *</Label>
                    <Input {...register("state")} className="bg-card border-border text-foreground" />
                    {errors.state && <p className="text-red-700 text-xs">{errors.state.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Country *</Label>
                    <Input {...register("country")} className="bg-card border-border text-foreground" />
                    {errors.country && <p className="text-red-700 text-xs">{errors.country.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">ZIP *</Label>
                    <Input {...register("zipCode")} className="bg-card border-border text-foreground" />
                    {errors.zipCode && <p className="text-red-700 text-xs">{errors.zipCode.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Mobile # *</Label>
                    <Input {...register("mobileNumber")} className="bg-card border-border text-foreground" />
                    {errors.mobileNumber && <p className="text-red-700 text-xs">{errors.mobileNumber.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Telephone #</Label>
                    <Input {...register("telephone")} className="bg-card border-border text-foreground" />
                  </div>
                </div>
              </section>

              {/* Family Information */}
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-primary border-b border-primary/30 pb-2">Family Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Mother's Name *</Label>
                    <Input {...register("motherName")} className="bg-card border-border text-foreground" />
                    {errors.motherName && <p className="text-red-700 text-xs">{errors.motherName.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Father's Name *</Label>
                    <Input {...register("fatherName")} className="bg-card border-border text-foreground" />
                    {errors.fatherName && <p className="text-red-700 text-xs">{errors.fatherName.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Home Contact # *</Label>
                    <Input {...register("homeContact")} className="bg-card border-border text-foreground" />
                    {errors.homeContact && <p className="text-red-700 text-xs">{errors.homeContact.message}</p>}
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-muted-foreground">Home Address *</Label>
                    <Textarea {...register("homeAddress")} className="bg-card border-border text-foreground min-h-[80px]" />
                    {errors.homeAddress && <p className="text-red-700 text-xs">{errors.homeAddress.message}</p>}
                  </div>
                </div>
              </section>

              {/* Emergency Contact */}
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-primary border-b border-primary/30 pb-2">Emergency Contact</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Emergency Contact Person *</Label>
                    <Input {...register("emergencyContactPerson")} className="bg-card border-border text-foreground" />
                    {errors.emergencyContactPerson && <p className="text-red-700 text-xs">{errors.emergencyContactPerson.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Relationship *</Label>
                    <Input {...register("emergencyRelationship")} className="bg-card border-border text-foreground" />
                    {errors.emergencyRelationship && <p className="text-red-700 text-xs">{errors.emergencyRelationship.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Contact # *</Label>
                    <Input {...register("emergencyNumber")} className="bg-card border-border text-foreground" />
                    {errors.emergencyNumber && <p className="text-red-700 text-xs">{errors.emergencyNumber.message}</p>}
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-muted-foreground">Address *</Label>
                    <Textarea {...register("emergencyAddress")} className="bg-card border-border text-foreground min-h-[80px]" />
                    {errors.emergencyAddress && <p className="text-red-700 text-xs">{errors.emergencyAddress.message}</p>}
                  </div>
                </div>
              </section>

              {/* Owns Vehicle Checkbox */}
              <div className="flex items-center gap-3 p-4 border border-primary/30 rounded-lg bg-primary/5">
                <Checkbox
                  id="owns-vehicle"
                  checked={ownsVehicle}
                  onCheckedChange={(checked) => setOwnsVehicle(!!checked)}
                  className="border-primary"
                />
                <Label htmlFor="owns-vehicle" className="text-foreground font-medium cursor-pointer">
                  I own a vehicle and would like to include it in the program
                </Label>
              </div>

              {ownsVehicle && (
                <>
                  {/* Vehicle Information */}
                  <section className="space-y-4">
                    <h2 className="text-lg font-semibold text-primary border-b border-primary/30 pb-2">Vehicle Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Vehicle Year *</Label>
                        <Input {...register("vehicleYear")} className="bg-card border-border text-foreground" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Vehicle Make *</Label>
                        <Input {...register("vehicleMake")} placeholder="e.g. Mercedes-Benz" className="bg-card border-border text-foreground" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Vehicle Model *</Label>
                        <Input {...register("vehicleModel")} className="bg-card border-border text-foreground" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Vehicle Trim *</Label>
                        <Input {...register("vehicleTrim")} className="bg-card border-border text-foreground" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Vehicle Miles *</Label>
                        <Input {...register("vehicleMiles")} className="bg-card border-border text-foreground" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Exterior Color *</Label>
                        <Input {...register("exteriorColor")} className="bg-card border-border text-foreground" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Interior Color *</Label>
                        <Input {...register("interiorColor")} className="bg-card border-border text-foreground" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Title Type *</Label>
                        <Select
                          value={watch("titleType")}
                          onValueChange={(v) => setValue("titleType", v, { shouldValidate: true })}
                        >
                          <SelectTrigger className="bg-card border-border text-foreground">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border text-foreground">
                            {["Clean", "Salvage", "Rebuilt", "Branded", "Other"].map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">VIN # *</Label>
                        <Input {...register("vehicleVin")} className="bg-card border-border text-foreground" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">License Plate *</Label>
                        <Input {...register("vehicleLicensePlate")} className="bg-card border-border text-foreground" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Registration Expiration *</Label>
                        <Input
                          {...register("registrationExpiration")}
                          type="date"
                          className="bg-card border-border text-foreground [&::-webkit-calendar-picker-indicator]:invert"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Vehicle Recall *</Label>
                        <Select
                          value={watch("vehicleRecall")}
                          onValueChange={(v) => setValue("vehicleRecall", v, { shouldValidate: true })}
                        >
                          <SelectTrigger className="bg-card border-border text-foreground">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border text-foreground">
                            <SelectItem value="Yes">Yes</SelectItem>
                            <SelectItem value="No">No</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="mt-2 mb-2 text-center">
                      <p className="text-sm text-muted-foreground mb-1">
                        If You're Not Sure If Your Vehicle May Have a Recall You Can Check Here:
                      </p>
                      <a
                        href="https://www.nhtsa.gov/recalls"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80 underline font-medium"
                      >
                        National Highway Traffic Safety Administration (NHTSA)
                      </a>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Number of Seats *</Label>
                        <Input {...register("numberOfSeats")} type="number" min="1" placeholder="e.g. 5" className="bg-card border-border text-foreground" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Number of Doors *</Label>
                        <Input {...register("numberOfDoors")} type="number" min="1" placeholder="e.g. 4" className="bg-card border-border text-foreground" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Ski Racks *</Label>
                        <Select
                          value={watch("skiRacks")}
                          onValueChange={(v) => setValue("skiRacks", v)}
                        >
                          <SelectTrigger className="bg-card border-border text-foreground">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border text-foreground">
                            <SelectItem value="Yes">Yes</SelectItem>
                            <SelectItem value="No">No</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Ski Cross Bars *</Label>
                        <Select
                          value={watch("skiCrossBars")}
                          onValueChange={(v) => setValue("skiCrossBars", v)}
                        >
                          <SelectTrigger className="bg-card border-border text-foreground">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border text-foreground">
                            <SelectItem value="Yes">Yes</SelectItem>
                            <SelectItem value="No">No</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Roof Rails *</Label>
                        <Select
                          value={watch("roofRails")}
                          onValueChange={(v) => setValue("roofRails", v)}
                        >
                          <SelectTrigger className="bg-card border-border text-foreground">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border text-foreground">
                            <SelectItem value="Yes">Yes</SelectItem>
                            <SelectItem value="No">No</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Last Oil Change *</Label>
                        <Input
                          {...register("lastOilChange")}
                          type="date"
                          className="bg-card border-border text-foreground [&::-webkit-calendar-picker-indicator]:invert"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Oil Type *</Label>
                        <Input {...register("oilType")} placeholder="e.g. 5W-30" className="bg-card border-border text-foreground" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Does Your Vehicle Have Free Dealership Oil Changes? *</Label>
                        <Select
                          value={watch("freeDealershipOilChanges")}
                          onValueChange={(v) => setValue("freeDealershipOilChanges", v)}
                        >
                          <SelectTrigger className="bg-card border-border text-foreground">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border text-foreground">
                            <SelectItem value="Yes">Yes</SelectItem>
                            <SelectItem value="No">No</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-muted-foreground">
                        If Yes, For How Many Years of Oil Changes OR What Oil Package
                        {freeOilChanges === "Yes" ? " *" : ""}
                      </Label>
                      <Input
                        {...register("oilPackageDetails")}
                        placeholder={freeOilChanges === "Yes" ? "e.g. 2 years / Premium oil package" : "Select \"Yes\" above to enable"}
                        disabled={freeOilChanges !== "Yes"}
                        className="bg-card border-border text-foreground disabled:opacity-60"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Address of Dealership (If Applicable)</Label>
                      <Input {...register("dealershipAddress")} placeholder="Dealership address (optional)" className="bg-card border-border text-foreground" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Fuel Type *</Label>
                        <Select
                          value={watch("fuelType")}
                          onValueChange={(v) => setValue("fuelType", v)}
                        >
                          <SelectTrigger className="bg-card border-border text-foreground">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border text-foreground">
                            {["Regular", "Premium", "Premium 91 Unleaded", "Regular Unleaded", "91 Unleaded", "Gasoline", "Electric", "Diesel", "Others"].map((f) => (
                              <SelectItem key={f} value={f}>{f}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Tire Size *</Label>
                        <Input {...register("tireSize")} placeholder="e.g. 225/45R17" className="bg-card border-border text-foreground" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Turo Profile URL</Label>
                      <Input {...register("turoProfileUrl")} placeholder="https://turo.com/..." className="bg-card border-border text-foreground" />
                    </div>

                    {/* Vehicle Features */}
                    <div className="space-y-2">
                      <Label className="text-muted-foreground font-semibold">
                        Features (check all that apply) <span className="text-red-500">* Required</span>
                      </Label>
                      <div className="border border-primary/30 rounded-lg p-4 grid grid-cols-2 gap-3">
                        {VEHICLE_FEATURES_LIST.map((feature) => (
                          <div key={feature} className="flex items-center gap-2">
                            <Checkbox
                              id={`feature-${feature}`}
                              checked={vehicleFeatures.includes(feature)}
                              onCheckedChange={(checked) => {
                                const current = vehicleFeatures;
                                setValue(
                                  "vehicleFeatures",
                                  checked ? [...current, feature] : current.filter((f) => f !== feature)
                                );
                              }}
                            />
                            <Label htmlFor={`feature-${feature}`} className="text-muted-foreground text-sm font-normal cursor-pointer">
                              {feature}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>

                  {/* Vehicle Insurance Info */}
                  <section className="space-y-4">
                    <h2 className="text-lg font-semibold text-primary border-b border-primary/30 pb-2">Vehicle Insurance Info</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Insurance Provider *</Label>
                        <Input {...register("insuranceProvider")} className="bg-card border-border text-foreground" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Insurance Phone *</Label>
                        <Input {...register("insurancePhone")} className="bg-card border-border text-foreground" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Policy # *</Label>
                        <Input {...register("policyNumber")} className="bg-card border-border text-foreground" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Expiration *</Label>
                        <Input
                          {...register("insuranceExpiration")}
                          type="date"
                          className="bg-card border-border text-foreground [&::-webkit-calendar-picker-indicator]:invert"
                        />
                      </div>
                    </div>
                  </section>

                  {/* Vehicle Purchase Info */}
                  <section className="space-y-4">
                    <h2 className="text-lg font-semibold text-primary border-b border-primary/30 pb-2">Vehicle Purchase Info</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Purchase Price *</Label>
                        <Input {...register("purchasePrice")} placeholder="e.g. 50000" className="bg-card border-border text-foreground" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Interest Rate *</Label>
                        <Input {...register("interestRate")} placeholder="e.g. 3.5" className="bg-card border-border text-foreground" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Monthly Payment *</Label>
                        <Input {...register("monthlyPayment")} placeholder="e.g. 750" className="bg-card border-border text-foreground" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Down Payment *</Label>
                        <Input {...register("downPayment")} placeholder="e.g. 10000" className="bg-card border-border text-foreground" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">
                        To maximize profits, would you like us to transport the vehicle from city to city if necessary? (US only) *
                      </Label>
                      <Select
                        value={watch("transportCityToCity")}
                        onValueChange={(v) => setValue("transportCityToCity", v)}
                      >
                        <SelectTrigger className="bg-card border-border text-foreground">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground">
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">What is your ultimate goal we can help you achieve with our program *</Label>
                      <Textarea
                        {...register("ultimateGoal")}
                        placeholder="Tell us about your goals..."
                        className="bg-card border-border text-foreground min-h-[100px]"
                      />
                    </div>
                  </section>

                  {/* ACH Direct Deposit */}
                  <section className="space-y-4">
                    <h2 className="text-lg font-semibold text-primary border-b border-primary/30 pb-2">ACH Direct Deposit Payment Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Bank Name *</Label>
                        <Input {...register("bankName")} className="bg-card border-border text-foreground" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Tax Classification *</Label>
                        <Select
                          value={watch("taxClassification")}
                          onValueChange={(v) => setValue("taxClassification", v)}
                        >
                          <SelectTrigger className="bg-card border-border text-foreground">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border text-foreground">
                            <SelectItem value="Individual">Individual</SelectItem>
                            <SelectItem value="Business">Business</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Routing Number *</Label>
                        <Input {...register("routingNumber")} placeholder="9 digits" maxLength={9} className="bg-card border-border text-foreground" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Account Number *</Label>
                        <Input {...register("accountNumber")} className="bg-card border-border text-foreground" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Business Name</Label>
                        <Input {...register("businessName")} className="bg-card border-border text-foreground" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">EIN</Label>
                        <Input {...register("ein")} placeholder="XX-XXXXXXX" className="bg-card border-border text-foreground" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-muted-foreground">Additional Bank Account Info (optional)</Label>
                      <Input {...register("bankAccountInfo")} placeholder="Bank name, account #, routing #" className="bg-card border-border text-foreground" />
                    </div>
                  </section>

                  {/* Car Login Information */}
                  <section className="space-y-4">
                    <h2 className="text-lg font-semibold text-primary border-b border-primary/30 pb-2">Car Login Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Car Manufacturer Website *</Label>
                        <Input {...register("carManufacturerWebsite")} placeholder="https://..." className="bg-card border-border text-foreground" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Car Manufacturer Username *</Label>
                        <Input {...register("carManufacturerUsername")} className="bg-card border-border text-foreground" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-muted-foreground">Password *</Label>
                        <Input {...register("carPassword")} type="password" className="bg-card border-border text-foreground" />
                      </div>
                    </div>
                  </section>
                </>
              )}

              {/* Other / Documents */}
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-primary border-b border-primary/30 pb-2">Other</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">SSN / EIN *</Label>
                    <Input {...register("ssnEin")} className="bg-card border-border text-foreground" />
                    {errors.ssnEin && <p className="text-red-700 text-xs">{errors.ssnEin.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Shirt Size *</Label>
                    <Select
                      value={watch("shirtSize")}
                      onValueChange={(v) => setValue("shirtSize", v, { shouldValidate: true })}
                    >
                      <SelectTrigger className="bg-card border-border text-foreground">
                        <SelectValue placeholder="Select size" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border text-foreground">
                        {["Small", "Medium", "Large", "XLarge", "XXLarge"].map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.shirtSize && <p className="text-red-700 text-xs">{errors.shirtSize.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <FileUploadField
                    label="Driver's License (optional)"
                    accept={ACCEPTED_DOC_TYPES}
                    maxMB={MAX_FILE_SIZE_MB}
                    file={driverLicenseFile}
                    onFile={setDriverLicenseFile}
                    inputId="dl-upload"
                  />
                  <FileUploadField
                    label="Car Insurance (optional)"
                    accept={ACCEPTED_DOC_TYPES}
                    maxMB={MAX_FILE_SIZE_MB}
                    file={carInsuranceFile}
                    onFile={setCarInsuranceFile}
                    inputId="ci-upload"
                  />
                  <FileUploadField
                    label="Vehicle Registration (optional)"
                    accept={ACCEPTED_DOC_TYPES}
                    maxMB={MAX_FILE_SIZE_MB}
                    file={vehicleRegistrationFile}
                    onFile={setVehicleRegistrationFile}
                    inputId="vr-upload"
                  />
                </div>
              </section>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  className="bg-primary text-primary-foreground hover:bg-primary/80 font-medium"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FileUploadField({
  label,
  accept,
  maxMB,
  file,
  onFile,
  inputId,
}: {
  label: string;
  accept: string;
  maxMB: number;
  file: File | null;
  onFile: (f: File | null) => void;
  inputId: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-muted-foreground">{label}</Label>
      <p className="text-xs text-muted-foreground">JPEG, PNG, GIF, WebP or PDF, max {maxMB}MB</p>
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          id={inputId}
          type="file"
          accept={accept}
          className="bg-card border-border text-foreground file:mr-2 file:rounded file:border-0 file:bg-primary file:text-primary-foreground file:text-sm"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
        {file && (
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            {file.name}
            <button
              type="button"
              onClick={() => onFile(null)}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground"
              aria-label="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
