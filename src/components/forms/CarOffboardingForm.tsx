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
import { Loader2, LogOut } from "lucide-react";
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

const carOffboardingSchema = z.object({
  date: z.string().min(1, "Date is required"),
  name: z.string().min(1, "Name is required").max(255),
  carId: z.string().min(1, "Please select a car"),
  carMakeModelYear: z.string().min(1, "Car Make/Model/Year is required").max(255),
  plateNumber: z.string().min(1, "Plate number is required").max(50),
  pickUpDate: z.string().min(1, "Pick-up date is required"),
  pickUpTime: z.string().min(1, "Pick-up time is required"),
  dealershipAddress: z.string().optional(),
});

type CarOffboardingFormData = z.infer<typeof carOffboardingSchema>;

interface UserCar {
  id: number;
  vin: string;
  makeModel: string;
  year: number | null;
  plateNumber: string | null;  // Changed from licensePlate to match backend
  status?: string;
  carStatus?: string;  // Backend returns carStatus
  isActive: number;
}

export default function CarOffboardingForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const [selectedCarId, setSelectedCarId] = useState<string>("");

  // Get current user data
  const { data: userData } = useQuery<{ user?: { firstName?: string; lastName?: string; id?: number } }>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  // Fetch user's cars from the database (only active/on-boarded cars)
  // Note: API returns only active cars by default (includeReturned=false)
  const { data: carsData, isLoading: isLoadingCars } = useQuery<{
    success: boolean;
    data: UserCar[];
  }>({
    queryKey: ["/api/client/cars", "offboarding"], // Include "offboarding" to differentiate from onboarding query
    queryFn: async () => {
      // Fetch cars for offboarding: only available cars
      const response = await fetch(buildApiUrl("/api/client/cars?for=offboarding"), {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch cars");
      }
      const result = await response.json();
      console.log("🚗 [CAR OFFBOARDING] Fetched cars:", result);
      console.log("🚗 [CAR OFFBOARDING] Number of cars:", result.data?.length || 0);
      return result;
    },
    enabled: !!userData?.user,
  });

  // Backend already filters for available cars
  const activeCars = carsData?.data || [];

  const form = useForm<CarOffboardingFormData>({
    resolver: zodResolver(carOffboardingSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      name: "",
      carId: "",
      carMakeModelYear: "",
      plateNumber: "",
      pickUpDate: new Date().toISOString().split('T')[0],
      pickUpTime: "09:00",
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
    if (selectedCarId && activeCars) {
      const selectedCar = activeCars.find((car) => car.id.toString() === selectedCarId);
      if (selectedCar) {
        const makeModelYear = selectedCar.year
          ? `${selectedCar.makeModel} ${selectedCar.year}`
          : selectedCar.makeModel;
        form.setValue("carMakeModelYear", makeModelYear);
        form.setValue("plateNumber", selectedCar.plateNumber || "N/A");  // Changed from licensePlate to plateNumber
      }
    }
  }, [selectedCarId, activeCars, form]);

  const onSubmit = async (data: CarOffboardingFormData) => {
    setIsSubmitting(true);
    try {
      // Convert date strings to ISO format
      const dateTime = new Date(data.date).toISOString();
      // Combine pick-up date and time
      const pickUpDateTime = new Date(`${data.pickUpDate}T${data.pickUpTime}`).toISOString();

      const payload = {
        date: dateTime,
        name: data.name,
        carMakeModelYear: data.carMakeModelYear,
        plateNumber: data.plateNumber,
        pickUpDate: pickUpDateTime,
        carId: data.carId, // Include carId to update car status
        dealershipAddress: data.dealershipAddress || "",
      };

      const response = await fetch(buildApiUrl("/api/car-offboarding/submit"), {
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
        description: "Your car offboarding request has been submitted. We'll notify you once it's processed.",
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
        pickUpDate: now.toISOString().split('T')[0],
        pickUpTime: "09:00",
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
          <LogOut className="w-5 h-5" />
          Car Off-boarding Form
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Submit this form when requesting your car back from GLA (end of rental or off-boarding from the fleet).
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

            {/* Car Selection Dropdown - Only Active Cars */}
            <FormField
              control={form.control}
              name="carId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">Select Car to Pick Up *</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      setSelectedCarId(value);
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-card border-border text-foreground focus:border-primary">
                        <SelectValue placeholder="Select a car to pick up" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-card border-border text-foreground">
                      {isLoadingCars ? (
                        <SelectItem value="loading" disabled>
                          Loading cars...
                        </SelectItem>
                      ) : activeCars && activeCars.length > 0 ? (
                        activeCars.map((car) => {
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
                          No active cars available for pick-up
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground mt-1">
                    Only showing cars currently with GLA (on-boarded status)
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

            {/* Pick-Up Date and Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="pickUpDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Pick-up Date *</FormLabel>
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
                name="pickUpTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">Pick-up Time *</FormLabel>
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
              disabled={isSubmitting || isLoadingCars || activeCars.length === 0}
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

