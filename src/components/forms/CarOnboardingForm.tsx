import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/lib/queryClient";
import { Loader2, Car } from "lucide-react";
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

const carOnboardingSchema = z.object({
  date: z.string().min(1, "Date is required"),
  name: z.string().min(1, "Name is required").max(255),
  carId: z.string().min(1, "Please select a car"),
  carMakeModelYear: z.string().min(1, "Car Make/Model/Year is required").max(255),
  plateNumber: z.string().min(1, "Plate number is required").max(50),
  dropOffDate: z.string().min(1, "Drop-off date is required"),
  dropOffTime: z.string().min(1, "Drop-off time is required"),
  dealershipAddress: z.string().optional(),
});

type CarOnboardingFormData = z.infer<typeof carOnboardingSchema>;

interface UserCar {
  id: number;
  vin: string;
  makeModel: string;
  year: number | null;
  plateNumber: string | null;  // Changed from licensePlate to match backend
  status?: string;
  carStatus?: string;  // Backend returns carStatus
  isActive?: number;
}

export default function CarOnboardingForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const [selectedCarId, setSelectedCarId] = useState<string>("");

  // Get current user data
  const { data: userData } = useQuery<{ user?: { firstName?: string; lastName?: string; id?: number } }>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  // Fetch user's cars from the database (include all cars to filter for offboarded ones)
  const { data: carsData, isLoading: isLoadingCars } = useQuery<{
    success: boolean;
    data: UserCar[];
  }>({
    queryKey: ["/api/client/cars", "onboarding"], // Include "onboarding" to differentiate from offboarding query
    queryFn: async () => {
      // Fetch cars for onboarding: off_fleet cars with approved onboarding submissions
      const response = await fetch(buildApiUrl("/api/client/cars?for=onboarding"), {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch cars");
      }
      const result = await response.json();
      console.log("🚗 [CAR ONBOARDING] Fetched cars:", result);
      console.log("🚗 [CAR ONBOARDING] Number of cars:", result.data?.length || 0);
      if (result.data && result.data.length > 0) {
        console.log("🚗 [CAR ONBOARDING] Car IDs:", result.data.map((c: any) => c.id).join(", "));
      }
      return result;
    },
    enabled: !!userData?.user,
  });

  // Backend already filters for off_fleet cars with approved onboarding submissions
  const offboardedCars = carsData?.data || [];

  const form = useForm<CarOnboardingFormData>({
    resolver: zodResolver(carOnboardingSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      name: "",
      carId: "",
      carMakeModelYear: "",
      plateNumber: "",
      dropOffDate: new Date().toISOString().split('T')[0],
      dropOffTime: "09:00",
      dealershipAddress: "",
    },
  });

  // Auto-fill name when user data is available
  useEffect(() => {
    if (userData?.user) {
      const fullName = `${userData.user.firstName} ${userData.user.lastName}`;
      form.setValue("name", fullName);
    }
  }, [userData, form]);

  // Auto-fill car details when a car is selected
  useEffect(() => {
    if (selectedCarId && offboardedCars) {
      const selectedCar = offboardedCars.find((car) => car.id.toString() === selectedCarId);
      if (selectedCar) {
        const makeModelYear = selectedCar.year
          ? `${selectedCar.makeModel} ${selectedCar.year}`
          : selectedCar.makeModel;
        form.setValue("carMakeModelYear", makeModelYear);
        form.setValue("plateNumber", selectedCar.plateNumber || "N/A");  // Changed from licensePlate to plateNumber
      }
    }
  }, [selectedCarId, offboardedCars, form]);

  const onSubmit = async (data: CarOnboardingFormData) => {
    setIsSubmitting(true);
    try {
      // Convert date strings to ISO format
      const dateTime = new Date(data.date).toISOString();
      // Combine drop-off date and time
      const dropOffDateTime = new Date(`${data.dropOffDate}T${data.dropOffTime}`).toISOString();

      const payload = {
        date: dateTime,
        name: data.name,
        carMakeModelYear: data.carMakeModelYear,
        plateNumber: data.plateNumber,
        dropOffDate: dropOffDateTime,
        carId: data.carId, // Include carId to update car status
        dealershipAddress: data.dealershipAddress || "",
      };

      const response = await fetch(buildApiUrl("/api/car-onboarding/submit"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Submission failed" }));
        throw new Error(error.error || "Failed to submit form");
      }

      const result = await response.json();
      
      toast({
        title: "✅ Form Submitted Successfully",
        description: "Your car onboarding request has been submitted. We'll notify you once it's processed.",
        duration: 5000,
      });

      // Reset form
      const now = new Date();
      form.reset({
        date: now.toISOString().split('T')[0],
        name: userData?.user ? `${userData.user.firstName} ${userData.user.lastName}` : "",
        carId: "",
        carMakeModelYear: "",
        plateNumber: "",
        dropOffDate: now.toISOString().split('T')[0],
        dropOffTime: "09:00",
        dealershipAddress: "",
      });
      setSelectedCarId("");
    } catch (error: any) {
      console.error("Submission error:", error);
      toast({
        title: "Submission Failed",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="bg-card border-primary/20">
      <CardHeader>
        <CardTitle className="text-[#D3BC8D] flex items-center gap-2">
          <Car className="w-5 h-5" />
          Car On-boarding Form
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Submit this form when dropping off your car to GLA for rental, maintenance, or onboarding into the fleet.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Date and Name Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Date *</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        className="bg-card border-border text-foreground focus:border-primary"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Name *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Your full name"
                        className="bg-card border-border text-foreground focus:border-primary"
                        readOnly
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Car Selection Dropdown */}
            <FormField
              control={form.control}
              name="carId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">Select Your Car *</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      setSelectedCarId(value);
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-card border-border text-foreground focus:border-primary">
                        <SelectValue placeholder="Select a car to drop off" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-card border-border text-foreground">
                      {isLoadingCars ? (
                        <SelectItem value="loading" disabled>
                          Loading cars...
                        </SelectItem>
                      ) : offboardedCars && offboardedCars.length > 0 ? (
                        offboardedCars.map((car) => {
                          // Extract year from makeModel if year field is not available
                          const displayText = car.makeModel 
                            ? `${car.makeModel}${car.plateNumber ? ` - ${car.plateNumber}` : " - No Plate"}`
                            : `Car #${car.id}${car.plateNumber ? ` - ${car.plateNumber}` : ""}`;
                          
                          return (
                            <SelectItem key={`car-${car.id}`} value={car.id.toString()}>
                              {displayText}
                            </SelectItem>
                          );
                        })
                      ) : (
                        <SelectItem value="no-cars" disabled>
                          No offboarded cars available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground mt-1">
                    Only showing offboarded cars (inactive/returned vehicles)
                  </p>
                </FormItem>
              )}
            />

            {/* Car Details Row: Make/Model/Year, Plate Number, Dealership Address */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="carMakeModelYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Car Make/Model/Year *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Select a car above to auto-fill"
                        className="bg-card border-border text-foreground focus:border-primary"
                        readOnly
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="plateNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Plate Number *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter plate number or auto-filled from car"
                        className="bg-card border-border text-foreground focus:border-primary uppercase"
                        style={{ textTransform: "uppercase" }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dealershipAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Address of Dealership</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter dealership address (if applicable)"
                        className="bg-card border-border text-foreground focus:border-primary"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Drop-off Date and Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="dropOffDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Date of Car Drop-off *</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        className="bg-card border-border text-foreground focus:border-primary"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dropOffTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Time of Car Drop-off *</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        {...field}
                        className="bg-card border-border text-foreground focus:border-primary"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || isLoadingCars}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/80 font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Form"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

