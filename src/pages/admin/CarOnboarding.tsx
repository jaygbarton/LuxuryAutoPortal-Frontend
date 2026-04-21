import { useState, useEffect } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { buildApiUrl } from "@/lib/queryClient";
import { Loader2, Search, Plus } from "lucide-react";
import {
  TablePagination,
  ItemsPerPage,
} from "@/components/ui/table-pagination";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

interface OnboardingCar {
  id: number;
  createdAt: string;
  clientId: number | null;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  vin: string | null;
  carMakeModel: string;
  year: number | null;
  licensePlate: string | null;
  status: string;
  offboardAt: string | null;
  offboardReason: string | null;
  finalMileage: number | null;
  contractStatus: string | null;
  onboardingDate: string | null;
}

const addCarSchema = z.object({
  date: z.string().min(1, "Date is required"),
  name: z.string().min(1, "Name is required"),
  carMakeModelYear: z.string().min(1, "Car Make/Model/Year is required"),
  plateNumber: z.string().optional(),
  dropOffDate: z.string().min(1, "Drop-off date is required"),
});

type AddCarFormData = z.infer<typeof addCarSchema>;

function CarOnboarding() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [page, setPage] = useState(1);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load items per page from localStorage, default to 10
  const [itemsPerPage, setItemsPerPage] = useState<ItemsPerPage>(() => {
    const saved = localStorage.getItem("car_onboarding_limit");
    return (saved ? parseInt(saved) : 10) as ItemsPerPage;
  });

  // Save to localStorage when itemsPerPage changes
  useEffect(() => {
    localStorage.setItem("car_onboarding_limit", itemsPerPage.toString());
  }, [itemsPerPage]);

  // Reset page to 1 when search or status changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter]);

  // Form for Add New Car dialog
  const addCarForm = useForm<AddCarFormData>({
    resolver: zodResolver(addCarSchema),
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      name: "",
      carMakeModelYear: "",
      plateNumber: "",
      dropOffDate: new Date().toISOString().split("T")[0],
    },
  });

  // Fetch cars for onboarding section with pagination
  const { data: carsData, isLoading } = useQuery<{
    success: boolean;
    data: OnboardingCar[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>({
    queryKey: [
      "cars-onboarding",
      searchQuery,
      statusFilter,
      page,
      itemsPerPage,
    ],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: itemsPerPage.toString(),
      });
      if (searchQuery) {
        params.append("search", searchQuery);
      }
      if (statusFilter && statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      const response = await fetch(
        buildApiUrl(`/api/cars/onboarding?${params.toString()}`),
        {
          credentials: "include",
        }
      );
      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to fetch cars" }));
        throw new Error(
          error.error || `Failed to fetch cars: ${response.status}`
        );
      }
      return response.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Add new car mutation
  const addCarMutation = useMutation({
    mutationFn: async (data: AddCarFormData) => {
      const response = await fetch(buildApiUrl("/api/cars/onboard"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Failed to add car" }));
        throw new Error(error.error || "Failed to add car");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cars-onboarding"] });
      // Also invalidate main cars list so cars page updates
      queryClient.invalidateQueries({ queryKey: ["/api/cars"] });
      // Invalidate sidebar badges (car counts may change)
      queryClient.invalidateQueries({ queryKey: ["sidebar-badges"] });
      setIsAddDialogOpen(false);
      addCarForm.reset();
      toast({
        title: "✅ Success",
        description: "New car added successfully",
        duration: 5000,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add car",
        variant: "destructive",
      });
    },
  });

  const onSubmitAddCar = (data: AddCarFormData) => {
    addCarMutation.mutate(data);
  };

  const cars = carsData?.data || [];
  const pagination = carsData?.pagination;

  // Handle row click - navigate to client profile
  const handleRowClick = (car: OnboardingCar) => {
    if (car.clientId) {
      setLocation(`/admin/clients?id=${car.clientId}`);
    } else if (car.clientName) {
      setLocation(
        `/admin/clients?search=${encodeURIComponent(car.clientName)}`
      );
    }
  };

  const handleEdit = (e: React.MouseEvent, car: OnboardingCar) => {
    e.stopPropagation();
    setLocation(`/cars?id=${car.id}`);
  };

  const handleOffboard = (e: React.MouseEvent, car: OnboardingCar) => {
    e.stopPropagation();
    setLocation(`/admin/cars/offboarding?carId=${car.id}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-foreground">Car On-boarding</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage vehicles added to the fleet
        </p>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            type="text"
            placeholder="Search by name, email, phone, VIN, plate, or make/model..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div className="w-full sm:w-48">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="bg-card border-border text-foreground">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="offboarded">Offboarded</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table Card */}
      <Card className="bg-card border-primary/20">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : cars.length > 0 ? (
            <>
              <div className="w-full overflow-hidden">
                <div className="overflow-x-auto">
                <Table className="w-full table-auto">
                  <TableHeader>
                    <TableRow className="border-b border-border">
                      <TableHead className="text-center text-xs font-medium text-foreground uppercase tracking-wider px-2 sm:px-3 py-3 sm:py-4 whitespace-nowrap">
                        Name
                      </TableHead>
                      <TableHead className="text-center text-xs font-medium text-primary uppercase tracking-wider px-2 sm:px-3 py-3 sm:py-4 hidden md:table-cell whitespace-nowrap">
                        Email
                      </TableHead>
                      <TableHead className="text-center text-xs font-medium text-primary uppercase tracking-wider px-2 sm:px-3 py-3 sm:py-4 hidden lg:table-cell whitespace-nowrap">
                        Phone
                      </TableHead>
                      <TableHead className="text-center text-xs font-medium text-foreground uppercase tracking-wider px-2 sm:px-3 py-3 sm:py-4 whitespace-nowrap">
                        Vehicle
                      </TableHead>
                      <TableHead className="text-center text-xs font-medium text-primary uppercase tracking-wider px-2 sm:px-3 py-3 sm:py-4 hidden xl:table-cell whitespace-nowrap">
                        VIN#
                      </TableHead>
                      <TableHead className="text-center text-xs font-medium text-primary uppercase tracking-wider px-2 sm:px-3 py-3 sm:py-4 hidden xl:table-cell whitespace-nowrap">
                        Plate #
                      </TableHead>
                      <TableHead className="text-center text-xs font-medium text-primary uppercase tracking-wider px-2 sm:px-3 py-3 sm:py-4 hidden lg:table-cell whitespace-nowrap">
                        Submitted
                      </TableHead>
                      <TableHead className="text-center text-xs font-medium text-foreground uppercase tracking-wider px-2 sm:px-3 py-3 sm:py-4 whitespace-nowrap">
                        Status
                      </TableHead>
                      <TableHead className="text-center text-xs font-medium text-primary uppercase tracking-wider px-2 sm:px-3 py-3 sm:py-4 hidden md:table-cell whitespace-nowrap">
                        Contract
                      </TableHead>
                      <TableHead className="text-center text-xs font-medium text-primary uppercase tracking-wider px-2 sm:px-3 py-3 sm:py-4 hidden 2xl:table-cell whitespace-nowrap">
                        Car Onboarding Date
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cars.map((car) => (
                      <TableRow
                        key={car.id}
                        className={cn(
                          "border-b border-border hover:bg-card transition-colors"
                        )}
                      >
                        <TableCell
                          className="text-center px-2 sm:px-3 py-3 sm:py-4 text-xs sm:text-sm cursor-pointer max-w-[120px] truncate"
                          onClick={() => handleRowClick(car)}
                          title={car.clientName || "Unassigned"}
                        >
                          {car.clientName ? (
                            <span className="text-foreground">{car.clientName}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center px-2 sm:px-3 py-3 sm:py-4 text-muted-foreground text-xs sm:text-sm hidden md:table-cell max-w-[150px] truncate" title={car.clientEmail || "—"}>
                          {car.clientEmail || "—"}
                        </TableCell>
                        <TableCell className="text-center px-2 sm:px-3 py-3 sm:py-4 text-muted-foreground text-xs sm:text-sm hidden lg:table-cell max-w-[120px] truncate" title={car.clientPhone || "—"}>
                          {car.clientPhone || "—"}
                        </TableCell>
                        <TableCell className="text-center px-2 sm:px-3 py-3 sm:py-4 text-muted-foreground text-xs sm:text-sm max-w-[150px] truncate" title={car.carMakeModel}>
                          {car.carMakeModel}
                        </TableCell>
                        <TableCell className="text-center px-2 sm:px-3 py-3 sm:py-4 text-muted-foreground font-mono text-xs hidden xl:table-cell max-w-[120px] truncate" title={car.vin || "—"}>
                          {car.vin || "—"}
                        </TableCell>
                        <TableCell className="text-center px-2 sm:px-3 py-3 sm:py-4 text-muted-foreground font-mono text-xs hidden xl:table-cell max-w-[100px] truncate" title={car.licensePlate ? car.licensePlate.toUpperCase() : "—"}>
                          {car.licensePlate
                            ? car.licensePlate.toUpperCase()
                            : "—"}
                        </TableCell>
                        <TableCell className="text-center px-2 sm:px-3 py-3 sm:py-4 text-muted-foreground text-xs sm:text-sm hidden lg:table-cell whitespace-nowrap">
                          {car.createdAt ? (
                            <div className="flex flex-col items-center leading-tight">
                              <span>
                                {new Date(car.createdAt).toLocaleDateString("en-US", {
                                  month: "2-digit",
                                  day: "2-digit",
                                  year: "numeric",
                                })}
                              </span>
                              <span className="text-[10px] text-muted-foreground/70">
                                {new Date(car.createdAt).toLocaleTimeString("en-US", {
                                  hour: "numeric",
                                  minute: "2-digit",
                                  hour12: true,
                                })}
                              </span>
                            </div>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-center px-2 sm:px-3 py-3 sm:py-4 whitespace-nowrap">
                          <div className="flex items-center justify-center">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs",
                                (car.status === "available" || car.status === "in_use") 
                                  ? "bg-green-500/20 text-green-700 border-green-500/30 font-medium"
                                : "bg-gray-500/20 text-gray-700 border-gray-500/30 font-medium"
                            )}
                          >
                            {(car.status === "available" || car.status === "in_use") ? "ACTIVE" : "INACTIVE"}
                          </Badge>
                        </div>
                        </TableCell>
                        <TableCell className="text-center px-2 sm:px-3 py-3 sm:py-4 hidden md:table-cell whitespace-nowrap">
                          <div className="flex items-center justify-center">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs",
                                car.contractStatus === "signed"
                                  ? "border-green-500/50 text-green-700 bg-green-500/20 font-semibold"
                                  : car.contractStatus === "pending"
                                  ? "border-yellow-500/50 text-yellow-800 bg-yellow-500/20 font-semibold"
                                  : car.contractStatus === "sent" || car.contractStatus === "opened"
                                  ? "border-blue-500/50 text-blue-700 bg-blue-500/20 font-semibold"
                                  : car.contractStatus === "declined"
                                  ? "border-red-500/50 text-red-700 bg-red-500/20 font-semibold"
                                  : "bg-muted/30 text-gray-700 border-border font-semibold"
                              )}
                            >
                              {car.contractStatus ? car.contractStatus.charAt(0).toUpperCase() + car.contractStatus.slice(1) : "N/A"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-center px-2 sm:px-3 py-3 sm:py-4 text-muted-foreground text-xs sm:text-sm hidden 2xl:table-cell whitespace-nowrap">
                          {(() => {
                            const dateStr = car.onboardingDate || car.createdAt;
                            if (!dateStr) return "—";
                            const d = new Date(dateStr);
                            return (
                              <div className="flex flex-col items-center leading-tight">
                                <span>
                                  {d.toLocaleDateString("en-US", {
                                    month: "2-digit",
                                    day: "2-digit",
                                    year: "numeric",
                                  })}
                                </span>
                                <span className="text-[10px] text-muted-foreground/70">
                                  {d.toLocaleTimeString("en-US", {
                                    hour: "numeric",
                                    minute: "2-digit",
                                    hour12: true,
                                  })}
                                </span>
                              </div>
                            );
                          })()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </div>

              {/* Pagination */}
              {pagination && (
                <TablePagination
                  totalItems={pagination.total}
                  itemsPerPage={itemsPerPage}
                  currentPage={page}
                  onPageChange={(newPage) => {
                    setPage(newPage);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  onItemsPerPageChange={(newLimit) => {
                    setItemsPerPage(newLimit);
                    setPage(1);
                  }}
                  isLoading={isLoading}
                />
              )}
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg">No records found</p>
              <p className="text-sm mt-2">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "No cars have been onboarded yet"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add New Car Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="bg-card border-primary/30 border-2 text-foreground max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-primary">
              Add New Car
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Add a new vehicle to the onboarding queue
            </DialogDescription>
          </DialogHeader>

          <Form {...addCarForm}>
            <form
              onSubmit={addCarForm.handleSubmit(onSubmitAddCar)}
              className="space-y-6 mt-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={addCarForm.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">
                        Date <span className="text-primary">*</span>
                      </FormLabel>
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
                  control={addCarForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">
                        Name <span className="text-primary">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Client full name"
                          className="bg-card border-border text-foreground focus:border-primary"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={addCarForm.control}
                name="carMakeModelYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">
                      Car Make/Model (Year){" "}
                      <span className="text-primary">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., 2024 Lamborghini Urus"
                        className="bg-card border-border text-foreground focus:border-primary"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={addCarForm.control}
                  name="plateNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">Plate #</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="License plate number"
                          className="bg-card border-border text-foreground focus:border-primary uppercase"
                          style={{ textTransform: "uppercase" }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={addCarForm.control}
                  name="dropOffDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">
                        Date of Car Drop Off{" "}
                        <span className="text-primary">*</span>
                      </FormLabel>
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
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    addCarForm.reset();
                  }}
                  className="border-border text-muted-foreground hover:bg-muted/50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    addCarMutation.isPending || !addCarForm.formState.isValid
                  }
                  className="bg-primary text-primary-foreground hover:bg-primary/80 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addCarMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Confirm"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CarOnboarding;
