import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Check,
  ArrowRight,
  ChevronUp,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { buildApiUrl, buildUploadApiUrl } from "@/lib/queryClient";

const onboardingSchema = z
  .object({
  date: z.string().min(1, "Date is required"),
  tshirtSize: z.string().min(1, "T-Shirt Size is required"),
  firstNameOwner: z.string().min(2, "First name is required"),
  lastNameOwner: z.string().min(2, "Last name is required"),
  phoneOwner: z.string().min(10, "Phone is required"),
  emailOwner: z.string().email("Valid email is required"),
  representative: z.string().min(1, "Representative is required"),
  heardAboutUs: z.string().min(1, "How you heard about us is required"),
  streetAddress: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zipCode: z.string().min(1, "Zip code is required"),
  birthday: z.string().min(1, "Birthday is required"),
  emergencyContactName: z.string().min(1, "Emergency contact name is required"),
  emergencyContactPhone: z
    .string()
    .min(10, "Emergency contact phone is required"),
  vehicleYear: z.string().min(1, "Vehicle year is required"),
  vehicleMake: z.string().min(1, "Vehicle make is required"),
  vehicleModel: z.string().min(1, "Vehicle model is required"),
  vehicleTrim: z.string().min(1, "Vehicle trim is required"),
  vehicleMiles: z.string().min(1, "Vehicle miles is required"),
  exteriorColor: z.string().min(1, "Exterior color is required"),
  interiorColor: z.string().min(1, "Interior color is required"),
  titleType: z.string().min(1, "Title type is required"),
  vinNumber: z.string().length(17, "VIN number must be exactly 17 characters"),
  licensePlate: z.string().min(1, "License plate is required"),
  registrationExpiration: z
    .string()
    .min(1, "Registration expiration is required"),
  vehicleRecall: z.string().min(1, "Vehicle recall is required"),
  numberOfSeats: z.string().min(1, "Number of seats is required"),
  numberOfDoors: z.string().min(1, "Number of doors is required"),
  skiRacks: z.string().min(1, "Ski racks is required"),
  skiCrossBars: z.string().min(1, "Ski cross bars is required"),
  roofRails: z.string().min(1, "Roof rails is required"),
  lastOilChange: z.string().min(1, "Last oil change is required"),
  oilType: z.string().min(1, "Oil type is required"),
  freeDealershipOilChanges: z.enum(["Yes", "No"], {
    required_error: "Free dealership oil changes is required",
  }),
  oilPackageDetails: z.string().optional(),
  dealershipAddress: z.string().optional(),
  fuelType: z.string().min(1, "Fuel type is required"),
  tireSize: z.string().min(1, "Tire size is required"),
  vehicleFeatures: z.array(z.string()).min(1, "At least one feature must be selected"),
  insuranceProvider: z.string().min(1, "Insurance provider is required"),
  insurancePhone: z.string().min(10, "Insurance phone is required"),
  policyNumber: z.string().min(1, "Policy number is required"),
  insuranceExpiration: z.string().min(1, "Insurance expiration is required"),
  purchasePrice: z.string().min(1, "Purchase price is required"),
  interestRate: z.string().min(1, "Interest rate is required"),
  monthlyPayment: z.string().min(1, "Monthly payment is required"),
  downPayment: z.string().min(1, "Down payment is required"),
  transportCityToCity: z.string().min(1, "Transport option is required"),
  ultimateGoal: z.string().min(1, "Ultimate goal is required"),
  bankName: z.string().min(1, "Bank name is required"),
  taxClassification: z.string().min(1, "Tax classification is required"),
  routingNumber: z.string().min(9, "Routing number is required").max(9, "Routing number must be exactly 9 digits"),
  accountNumber: z.string().min(1, "Account number is required"),
  businessName: z.string().optional(),
  ein: z.string().optional(),
  ssn: z.string().min(1, "SSN is required"),
  carManufacturerWebsite: z.string().url("Valid URL is required"),
  carManufacturerUsername: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  confirmAgreement: z.boolean().refine((val) => val === true, "You must confirm"),
})
  .superRefine((data, ctx) => {
    if (data.freeDealershipOilChanges === "Yes" && !data.oilPackageDetails?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["oilPackageDetails"],
        message:
          "Oil package details is required when free dealership oil changes is Yes",
      });
    }
});

type OnboardingFormData = z.infer<typeof onboardingSchema>;

const steps = [
  { id: 1, title: "GOLDEN LUXURY AUTO'S NEW CLIENT ONBOARDING FORM" },
  { id: 2, title: "OWNER INFORMATION" },
  { id: 3, title: "VEHICLE INFORMATION" },
  { id: 4, title: "VEHICLE INSURANCE INFO" },
  { id: 5, title: "VEHICLE PURCHASE INFO" },
  { id: 6, title: "ACH DIRECT DEPOSIT PAYMENT INFORMATION" },
  { id: 7, title: "CAR LOGIN INFORMATION" },
];

function generateRandomData(): OnboardingFormData {
  const firstNames = ["John", "Sarah", "Michael", "Emma", "David"];
  const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones"];
  const rng = () => Math.floor(Math.random() * 1000000);

  return {
    date: new Date().toISOString().split("T")[0],
    tshirtSize: ["S", "M", "L", "XL"][Math.floor(Math.random() * 4)],
    firstNameOwner: firstNames[Math.floor(Math.random() * firstNames.length)],
    lastNameOwner: lastNames[Math.floor(Math.random() * lastNames.length)],
    phoneOwner: `555-${Math.floor(Math.random() * 9000000) + 1000000}`,
    emailOwner: `user${rng()}@example.com`,
    representative: "John Smith",
    heardAboutUs: "Friend",
    streetAddress: "123 Main Street",
    city: "Los Angeles",
    state: "CA",
    zipCode: "90001",
    birthday: "1990-01-15",
    emergencyContactName: "Jane Doe",
    emergencyContactPhone: "555-9876543",
    vehicleYear: "2023",
    vehicleMake: "Mercedes-Benz",
    vehicleModel: "C-Class",
    vehicleTrim: "Premium",
    vehicleMiles: "15000",
    exteriorColor: "Black",
    interiorColor: "Tan",
    titleType: "Clean",
    vinNumber: "1HGCV41JXMN109186",
    licensePlate: "ABC1234",
    registrationExpiration: "2025-12-31",
    vehicleRecall: "No",
    numberOfSeats: "5",
    numberOfDoors: "4",
    skiRacks: "No",
    skiCrossBars: "No",
    roofRails: "Yes",
    lastOilChange: "2024-01-15",
    oilType: "5W-30",
    freeDealershipOilChanges: "Yes",
    oilPackageDetails: "2 years / Premium oil package",
    dealershipAddress: "456 Oak Street",
    fuelType: "Gasoline",
    tireSize: "225/45R17",
    vehicleFeatures: ["Bluetooth", "GPS", "Back Up Camera"],
    insuranceProvider: "State Farm",
    insurancePhone: "555-9876543",
    policyNumber: "POL123456",
    insuranceExpiration: "2025-12-31",
    purchasePrice: "50000",
    interestRate: "3.5",
    monthlyPayment: "750",
    downPayment: "10000",
    transportCityToCity: "Yes",
    ultimateGoal: "Personal use and potential rental income",
    bankName: "Wells Fargo",
    taxClassification: "Individual",
    routingNumber: "021000021",
    accountNumber: "123456789",
    businessName: "My Business",
    ein: "12-3456789",
    ssn: "123-45-6789",
    carManufacturerWebsite: "https://www.mercedes-benz.com",
    carManufacturerUsername: "testuser",
    password: "TestPassword123",
    confirmAgreement: true,
  };
}

export default function Onboarding() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<number[]>([
    1, 2, 3, 4, 5, 6, 7,
  ]);
  const [insuranceCardFile, setInsuranceCardFile] = useState<File | null>(null);
  const [driversLicenseFile, setDriversLicenseFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingLicense, setIsDraggingLicense] = useState(false);
  const { toast } = useToast();

  const form = useForm<OnboardingFormData, any, OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      date: "",
      tshirtSize: "",
      firstNameOwner: "",
      lastNameOwner: "",
      phoneOwner: "",
      emailOwner: "",
      representative: "",
      heardAboutUs: "",
      streetAddress: "",
      city: "",
      state: "",
      zipCode: "",
      birthday: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      vehicleYear: "",
      vehicleMake: "",
      vehicleModel: "",
      vehicleTrim: "",
      vehicleMiles: "",
      exteriorColor: "",
      interiorColor: "",
      titleType: "",
      vinNumber: "",
      licensePlate: "",
      registrationExpiration: "",
      vehicleRecall: "",
      numberOfSeats: "",
      numberOfDoors: "",
      skiRacks: "",
      skiCrossBars: "",
      roofRails: "",
      lastOilChange: "",
      oilType: "",
      freeDealershipOilChanges: undefined,
      oilPackageDetails: "",
      dealershipAddress: "",
      fuelType: "",
      tireSize: "",
      vehicleFeatures: [],
      insuranceProvider: "",
      insurancePhone: "",
      policyNumber: "",
      insuranceExpiration: "",
      purchasePrice: "",
      interestRate: "",
      monthlyPayment: "",
      downPayment: "",
      transportCityToCity: "",
      ultimateGoal: "",
      bankName: "",
      taxClassification: "",
      routingNumber: "",
      accountNumber: "",
      ssn: "",
      carManufacturerWebsite: "",
      carManufacturerUsername: "",
      password: "",
      confirmAgreement: false,
    },
  });

  const freeOilChanges = form.watch("freeDealershipOilChanges");

  // Keep dependent field clean when "No" is selected
  useEffect(() => {
    if (freeOilChanges !== "Yes") {
      form.setValue("oilPackageDetails", "");
    }
  }, [freeOilChanges, form]);

  const fillWithRandomData = () => {
    form.reset(generateRandomData());
    toast({
      title: "Form Filled",
      description: "All fields filled with random test data.",
    });
  };

  const toggleStep = (stepId: number) => {
    setExpandedSteps((prev) =>
      prev.includes(stepId)
        ? prev.filter((s) => s !== stepId)
        : [...prev, stepId]
    );
  };

  const onSubmit = async (data: OnboardingFormData) => {
    console.log("=".repeat(80));
    console.log("🌐 [FRONTEND] Form submission started");
    console.log("📋 [FRONTEND] Form data keys:", Object.keys(data));
    console.log("📋 [FRONTEND] Sample form data:", {
      firstNameOwner: data.firstNameOwner,
      emailOwner: data.emailOwner,
      vehicleMake: data.vehicleMake,
      vehicleModel: data.vehicleModel,
    });

    setIsSubmitting(true);
    try {
      // Use upload URL when sending FormData so multipart body is forwarded correctly in dev
      const endpoint =
        insuranceCardFile || driversLicenseFile
          ? buildUploadApiUrl("/api/onboarding/submit")
          : buildApiUrl("/api/onboarding/submit");
      
      // Use FormData if there are files, otherwise use JSON
      let requestBody: FormData | string;
      let headers: HeadersInit;
      
      if (insuranceCardFile || driversLicenseFile) {
        const formData = new FormData();
        // Append all form fields
        Object.entries(data).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            if (typeof value === "boolean") {
              formData.append(key, value.toString());
            } else if (Array.isArray(value)) {
              // Stringify arrays (e.g., vehicleFeatures)
              formData.append(key, JSON.stringify(value));
            } else {
              formData.append(key, String(value));
            }
          }
        });
        // Append the insurance card file if present
        if (insuranceCardFile) {
          formData.append("insuranceCard", insuranceCardFile);
        }
        // Append drivers license file
        if (driversLicenseFile) {
          formData.append("driversLicense", driversLicenseFile);
        }
        requestBody = formData;
        // Don't set Content-Type header for FormData - browser will set it with boundary
        headers = {};
      } else {
        requestBody = JSON.stringify(data);
        headers = { "Content-Type": "application/json" };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: headers,
        body: requestBody,
        credentials: "include",
      });

      // console.log("📥 [FRONTEND] Response received");
      // console.log("📊 [FRONTEND] Response status:", response.status);
      // console.log("📊 [FRONTEND] Response statusText:", response.statusText);
      // console.log("📊 [FRONTEND] Response ok:", response.ok);

      if (!response.ok) {
        const error = await response.json();
        // console.error("❌ [FRONTEND] Response error:", error);
        
        // If error has a specific field (like VIN duplicate), set form error
        if (error.field && error.message) {
          form.setError(error.field as keyof OnboardingFormData, {
            type: "manual",
            message: error.message,
          });
        }
        
        throw new Error(error.message || "Submission failed");
      }

      const responseData = await response.json();
      // Log summary only, not full data
      // console.log("✅ [FRONTEND] Submission successful, ID:", responseData.id);
      // console.log("=".repeat(80));

      setIsSubmitted(true);
      // Thank you page is rendered inline below (lines 339-372)
    } catch (error: any) {
      // console.error("❌ [FRONTEND] Submission error:");
      // console.error("Error type:", error?.constructor?.name);
      // console.error("Error message:", error.message);
      // console.error("Error stack:", error.stack);
      // console.log("=".repeat(80));

      toast({
        title: "Submission Failed",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="pt-20 lg:pt-24">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <Card className="bg-card border-border text-center">
              <CardContent className="py-16">
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
                  <Check className="w-10 h-10 text-primary" />
                </div>
                <h2 className="font-serif text-3xl font-medium text-foreground mb-4">
                  Thank You!
                </h2>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                  Your information has been submitted successfully. One of our
                  luxury automotive specialists will contact you within 24
                  hours.
                </p>
                <Button
                  onClick={() => (window.location.href = "/fleet")}
                  data-testid="button-browse-fleet"
                >
                  Browse Our Fleet
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20 lg:pt-24 pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col items-center">
            <img
              src="/logo.png"
              alt="Golden Luxury Auto"
              className="h-[120px] md:h-[150px] w-auto object-contain mb-4 drop-shadow-[0_0_12px_rgba(234,235,128,0.4)]"
            />
            <p className="text-muted-foreground text-center">Client Onboarding Form</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {steps.map((step) => (
                <Card
                  key={step.id}
                  className="bg-card border-primary/20 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleStep(step.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-card transition-colors"
                  >
                    <span className="text-base font-semibold text-primary">
                      {step.id}. {step.title}
                    </span>
                    {expandedSteps.includes(step.id) ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>

                  {expandedSteps.includes(step.id) && (
                    <CardContent className="p-4 space-y-4 border-t border-primary/20">
                      {step.id === 1 && (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="date"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Date *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      type="date"
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="tshirtSize"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    T-Shirt Size *
                                  </FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="bg-background border-border">
                                        <SelectValue placeholder="Select" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {["XS", "S", "M", "L", "XL", "XXL"].map(
                                        (s) => (
                                          <SelectItem key={s} value={s}>
                                            {s}
                                          </SelectItem>
                                        )
                                      )}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="firstNameOwner"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Vehicle Owner First Name *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="lastNameOwner"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Vehicle Owner Last Name *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="phoneOwner"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Vehicle Owner Phone Number *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="emailOwner"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Vehicle Owner Email Address *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      type="email"
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="representative"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Golden Luxury Auto Representative *
                                  </FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="bg-background border-border">
                                        <SelectValue placeholder="Select" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="Jay Barton">
                                        Jay Barton
                                      </SelectItem>
                                      <SelectItem value="Jenn Mason">
                                        Jenn Mason
                                      </SelectItem>
                                      <SelectItem value="Brynn Lunn">
                                        Brynn Lunn
                                      </SelectItem>
                                      <SelectItem value="Other">
                                        Other
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="heardAboutUs"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    How did you hear about us? *
                                  </FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="bg-background border-border">
                                        <SelectValue placeholder="Select" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="Friend">
                                        Friend
                                      </SelectItem>
                                      <SelectItem value="Google">
                                        Google
                                      </SelectItem>
                                      <SelectItem value="Social Media">
                                        Social Media
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </>
                      )}
                      {step.id === 2 && (
                        <>
                          <FormField
                            control={form.control}
                            name="streetAddress"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-muted-foreground">
                                  Street Address *
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    className="bg-background border-border"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="city"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    City *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="state"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    State *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="zipCode"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Zip Code *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="birthday"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Birthday *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      type="date"
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="emergencyContactName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Emergency Contact Name *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="emergencyContactPhone"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Emergency Contact Phone *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </>
                      )}
                      {step.id === 3 && (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="vehicleYear"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Vehicle Year *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="vehicleMake"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Vehicle Make *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="e.g., Mercedes-Benz"
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="vehicleModel"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Vehicle Model *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="vehicleTrim"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Vehicle Trim *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="vehicleMiles"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Vehicle Miles *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="exteriorColor"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Exterior Color *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="interiorColor"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Interior Color *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="titleType"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Title Type *
                                  </FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="bg-background border-border">
                                        <SelectValue placeholder="Select" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="Clean">
                                        Clean
                                      </SelectItem>
                                      <SelectItem value="Salvage">
                                        Salvage
                                      </SelectItem>
                                      <SelectItem value="Rebuilt">
                                        Rebuilt
                                      </SelectItem>
                                      <SelectItem value="Branded">
                                        Branded
                                      </SelectItem>
                                      <SelectItem value="Other">
                                        Other
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="vinNumber"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    VIN Number *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="licensePlate"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    License Plate *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="registrationExpiration"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Registration Expiration *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      type="date"
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="vehicleRecall"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Vehicle Recall *
                                  </FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="bg-background border-border">
                                        <SelectValue placeholder="Select" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="Yes">Yes</SelectItem>
                                      <SelectItem value="No">No</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          {/* NHTSA Recall Check Link */}
                          <div className="mt-2 mb-2 text-center">
                            <p className="text-sm text-muted-foreground mb-1">
                              If Your Not Sure If Your Vehicle May Have a Recall You Can Check Here:
                            </p>
                            <a
                              href="https://www.nhtsa.gov/recalls"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:text-[#d4d570] underline font-medium"
                              style={{ fontSize: '1.3em' }}
                            >
                              National Highway Traffic Safety Administration (NHTSA)
                            </a>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="numberOfSeats"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Number of Seats *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      type="number"
                                      min="1"
                                      placeholder="e.g., 5"
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="numberOfDoors"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Number of Doors *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      type="number"
                                      min="1"
                                      placeholder="e.g., 4"
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="skiRacks"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Ski Racks *
                                  </FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="bg-background border-border">
                                        <SelectValue placeholder="Select" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="Yes">Yes</SelectItem>
                                      <SelectItem value="No">No</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="skiCrossBars"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Ski Cross Bars *
                                  </FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="bg-background border-border">
                                        <SelectValue placeholder="Select" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="Yes">Yes</SelectItem>
                                      <SelectItem value="No">No</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="roofRails"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Roof Rails *
                                  </FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="bg-background border-border">
                                        <SelectValue placeholder="Select" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="Yes">Yes</SelectItem>
                                      <SelectItem value="No">No</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="lastOilChange"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Last Oil Change *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      type="date"
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="oilType"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Oil Type *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="e.g., 5W-30"
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            {/* Right column: dropdown (matches screenshot) */}
                            <div className="space-y-4">
                            <FormField
                              control={form.control}
                              name="freeDealershipOilChanges"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                      Does Your Vehicle Have Free Dealership Oil Changes? *
                                  </FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="bg-background border-border">
                                        <SelectValue placeholder="Select" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="Yes">Yes</SelectItem>
                                        <SelectItem value="No">No</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          </div>

                          {/* Full-width row (spans both columns) */}
                          <div className="grid grid-cols-1 gap-4">
                            <FormField
                              control={form.control}
                              name="oilPackageDetails"
                              render={({ field }) => (
                                <FormItem className="w-full">
                                  <FormLabel className="text-muted-foreground">
                                    If Yes, For How Many Years of Oil Changes OR What Oil Package
                                    {freeOilChanges === "Yes" ? " *" : ""}
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder={
                                        freeOilChanges === "Yes"
                                          ? "e.g., 2 years / Premium oil package"
                                          : "Select “Yes” above to enable"
                                      }
                                      disabled={freeOilChanges !== "Yes"}
                                      className="w-full bg-background border-border disabled:opacity-60"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="grid grid-cols-1 gap-4">
                            <FormField
                              control={form.control}
                              name="dealershipAddress"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Address of Dealership (If Applicable)
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="Dealership address (optional)"
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="fuelType"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Fuel Type *
                                  </FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="bg-background border-border">
                                        <SelectValue placeholder="Select" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="Regular">Regular</SelectItem>
                                      <SelectItem value="Premium">Premium</SelectItem>
                                      <SelectItem value="Premium 91 Unleaded">Premium 91 Unleaded</SelectItem>
                                      <SelectItem value="Regular Unleaded">Regular Unleaded</SelectItem>
                                      <SelectItem value="91 Unleaded">91 Unleaded</SelectItem>
                                      <SelectItem value="Gasoline">Gasoline</SelectItem>
                                      <SelectItem value="Electric">Electric</SelectItem>
                                      <SelectItem value="Diesel">Diesel</SelectItem>
                                      <SelectItem value="Others">Others</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="tireSize"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Tire Size *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="e.g., 225/45R17"
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={form.control}
                            name="vehicleFeatures"
                            render={() => (
                              <FormItem>
                                <div className="mb-4">
                                  <FormLabel className="text-muted-foreground text-base font-semibold">
                                    Features (check all that apply)
                                    <span className="text-red-500 ml-1">* Required</span>
                                  </FormLabel>
                                </div>
                                <div className="border border-red-500 rounded-lg p-4">
                                  <div className="grid grid-cols-2 gap-3">
                                    {[
                                      "All-wheel drive",
                                      "AUX input",
                                      "Blind Spot Warning",
                                      "Convertible",
                                      "Keyless Entry",
                                      "Snow Tires or Chains",
                                      "USB Charger",
                                      "Android Auto",
                                      "Back Up Camera",
                                      "Bluetooth",
                                      "GPS",
                                      "Pet Friendly",
                                      "Sunroof",
                                      "USB Input",
                                      "Apple CarPlay",
                                      "Bike Rack",
                                      "Toll Pass",
                                      "Wheelchair Accessible",
                                    ].map((feature) => (
                                      <FormField
                                        key={feature}
                                        control={form.control}
                                        name="vehicleFeatures"
                                        render={({ field }) => {
                                          return (
                                            <FormItem
                                              key={feature}
                                              className="flex flex-row items-start space-x-3 space-y-0"
                                            >
                                              <FormControl>
                                                <Checkbox
                                                  checked={field.value?.includes(feature) || false}
                                                  onCheckedChange={(checked) => {
                                                    const currentValue = field.value || [];
                                                    return checked
                                                      ? field.onChange([...currentValue, feature])
                                                      : field.onChange(
                                                          currentValue.filter(
                                                            (value) => value !== feature
                                                          )
                                                        );
                                                  }}
                                                />
                                              </FormControl>
                                              <FormLabel className="text-muted-foreground text-sm font-normal cursor-pointer">
                                                {feature}
                                              </FormLabel>
                                            </FormItem>
                                          );
                                        }}
                                      />
                                    ))}
                                  </div>
                                </div>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormItem>
                            <FormLabel className="text-muted-foreground">
                              Drivers License Upload
                            </FormLabel>
                            <div
                              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                                isDraggingLicense
                                  ? "border-primary bg-[#D3BC8D]/10"
                                  : "border-primary/30"
                              }`}
                              onDragOver={(e) => {
                                e.preventDefault();
                                setIsDraggingLicense(true);
                              }}
                              onDragLeave={() => setIsDraggingLicense(false)}
                              onDrop={(e) => {
                                e.preventDefault();
                                setIsDraggingLicense(false);
                                const file = e.dataTransfer.files[0];
                                if (file) {
                                  if (
                                    file.type.startsWith("image/") ||
                                    file.type === "application/pdf"
                                  ) {
                                    setDriversLicenseFile(file);
                                  } else {
                                    toast({
                                      title: "Invalid file type",
                                      description:
                                        "Please upload an image or PDF file",
                                      variant: "destructive",
                                    });
                                  }
                                }
                              }}
                            >
                              <input
                                type="file"
                                id="drivers-license-upload"
                                accept="image/*,.pdf"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    if (
                                      file.type.startsWith("image/") ||
                                      file.type === "application/pdf"
                                    ) {
                                      setDriversLicenseFile(file);
                                    } else {
                                      toast({
                                        title: "Invalid file type",
                                        description:
                                          "Please upload an image or PDF file",
                                        variant: "destructive",
                                      });
                                      // Reset the input
                                      e.target.value = "";
                                    }
                                  }
                                }}
                              />
                              <label
                                htmlFor="drivers-license-upload"
                                className="cursor-pointer"
                              >
                                <p className="text-primary text-sm">
                                  Drag & drop files here or click to browse
                                </p>
                                <p className="text-muted-foreground text-xs mt-1">
                                  Supports images and PDF files
                                </p>
                              </label>
                              {driversLicenseFile && (
                                <div className="mt-4 p-3 bg-card rounded border border-primary/20">
                                  <p className="text-foreground text-sm">
                                    Selected: {driversLicenseFile.name}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => setDriversLicenseFile(null)}
                                    className="text-red-700 text-xs mt-2 hover:underline"
                                  >
                                    Remove
                                  </button>
                                </div>
                              )}
                            </div>
                          </FormItem>
                        </>
                      )}
                      {step.id === 4 && (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="insuranceProvider"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Insurance Provider *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="insurancePhone"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Insurance Phone *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="policyNumber"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Policy # *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="insuranceExpiration"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Expiration *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      type="date"
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormItem>
                            <FormLabel className="text-muted-foreground">
                              Insurance Card
                            </FormLabel>
                            <div
                              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                                isDragging
                                  ? "border-primary bg-[#D3BC8D]/10"
                                  : "border-primary/30"
                              }`}
                              onDragOver={(e) => {
                                e.preventDefault();
                                setIsDragging(true);
                              }}
                              onDragLeave={() => setIsDragging(false)}
                              onDrop={(e) => {
                                e.preventDefault();
                                setIsDragging(false);
                                const file = e.dataTransfer.files[0];
                                if (file) {
                                  if (
                                    file.type.startsWith("image/") ||
                                    file.type === "application/pdf"
                                  ) {
                                    setInsuranceCardFile(file);
                                  } else {
                                    toast({
                                      title: "Invalid file type",
                                      description:
                                        "Please upload an image or PDF file",
                                      variant: "destructive",
                                    });
                                  }
                                }
                              }}
                            >
                              <input
                                type="file"
                                id="insurance-card-upload"
                                accept="image/*,.pdf"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    if (
                                      file.type.startsWith("image/") ||
                                      file.type === "application/pdf"
                                    ) {
                                      setInsuranceCardFile(file);
                                    } else {
                                      toast({
                                        title: "Invalid file type",
                                        description:
                                          "Please upload an image or PDF file",
                                        variant: "destructive",
                                      });
                                      // Reset the input
                                      e.target.value = "";
                                    }
                                  }
                                }}
                              />
                              <label
                                htmlFor="insurance-card-upload"
                                className="cursor-pointer"
                              >
                                <p className="text-primary text-sm">
                                  Drag & drop files here or click to browse
                                </p>
                                <p className="text-muted-foreground text-xs mt-1">
                                  Supports images and PDF files
                                </p>
                              </label>
                              {insuranceCardFile && (
                                <div className="mt-4 p-3 bg-card rounded border border-primary/20">
                                  <p className="text-foreground text-sm">
                                    Selected: {insuranceCardFile.name}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => setInsuranceCardFile(null)}
                                    className="text-red-700 text-xs mt-2 hover:underline"
                                  >
                                    Remove
                                  </button>
                                </div>
                              )}
                            </div>
                          </FormItem>
                        </>
                      )}
                      {step.id === 5 && (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="purchasePrice"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Purchase Price *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="e.g., 50000"
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="interestRate"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Interest Rate *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="e.g., 3.5"
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="monthlyPayment"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Monthly Payment *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="e.g., 750"
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="downPayment"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Down Payment *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="e.g., 10000"
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={form.control}
                            name="transportCityToCity"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-muted-foreground">
                                  To maximize profits, would you like us to transport the vehicle from city to city if necessary? (US only)
                                </FormLabel>
                                <Select
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                >
                                  <FormControl>
                                    <SelectTrigger className="bg-background border-border">
                                      <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="Yes">Yes</SelectItem>
                                    <SelectItem value="No">No</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="ultimateGoal"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-muted-foreground">
                                  What is your ultimate goal we can help you achieve with our program *
                                </FormLabel>
                                <FormControl>
                                  <Textarea
                                    {...field}
                                    placeholder="Tell us about your goals..."
                                    className="bg-background border-border resize-none"
                                    rows={4}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </>
                      )}
                      {step.id === 6 && (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="bankName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Bank Name *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="taxClassification"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Tax Classification *
                                  </FormLabel>
                                  <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="bg-background border-border">
                                        <SelectValue placeholder="Select" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="Individual">
                                        Individual
                                      </SelectItem>
                                      <SelectItem value="Business">
                                        Business
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="routingNumber"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Routing Number *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="9 digits"
                                      maxLength={9}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="accountNumber"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Account Number *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="businessName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Business Name
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="ein"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    EIN
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="XX-XXXXXXX"
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={form.control}
                            name="ssn"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-muted-foreground">
                                  SSN *
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder="XXX-XX-XXXX"
                                    className="bg-background border-border"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </>
                      )}
                      {step.id === 7 && (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="carManufacturerWebsite"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Car Manufacturer Website *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder="https://..."
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="carManufacturerUsername"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-muted-foreground">
                                    Car Manufacturer Username *
                                  </FormLabel>
                                  <FormControl>
                                    <Input
                                      {...field}
                                      className="bg-background border-border"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-muted-foreground">
                                  Password *
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    type="password"
                                    {...field}
                                    className="bg-background border-border"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="bg-background border border-border rounded p-4">
                            <p className="text-sm text-muted-foreground mb-4">
                              After you submit, we will send the contract
                              agreement to your email
                            </p>
                            <FormField
                              control={form.control}
                              name="confirmAgreement"
                              render={({ field }) => (
                                <FormItem className="flex items-center space-x-2">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <FormLabel className="text-muted-foreground font-normal">
                                    Confirm. Send My Agreement
                                  </FormLabel>
                                </FormItem>
                              )}
                            />
                          </div>
                        </>
                      )}
                    </CardContent>
                  )}
                </Card>
              ))}

              <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-primary/20">
                <Button
                  type="button"
                  onClick={fillWithRandomData}
                  variant="outline"
                  className="bg-[#D3BC8D]/10 border-primary/30 text-primary hover:bg-primary/20"
                  disabled={isSubmitting}
                  data-testid="button-fill-random"
                >
                  Fill Out All Fields With Random Data (For Testing)
                </Button>
                <Button
                  type="submit"
                  className="bg-primary text-primary-foreground hover:bg-primary/80 font-bold w-full sm:w-auto sm:ml-auto"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      Submit
                      <Check className="ml-2 w-4 h-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
