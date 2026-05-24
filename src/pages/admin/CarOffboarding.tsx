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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { buildApiUrl } from "@/lib/queryClient";
import { Loader2, Search, LogOut } from "lucide-react";
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

interface OffboardingCar {
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
}

const offboardCarSchema = z.object({
  date: z.string().min(1, "Date is required"),
  name: z.string().min(1, "Name is required"),
  vehicleMakeModelYear: z
    .string()
    .min(1, "Vehicle Make/Model/Year is required"),
  licensePlate: z.string().min(1, "License Plate is required"),
  returnDate: z.string().min(1, "Return date is required"),
});

type OffboardCarFormData = z.infer<typeof offboardCarSchema>;

export default function CarOffboarding() {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [isOffboardDialogOpen, setIsOffboardDialogOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load items per page from localStorage, default to 10
  const [itemsPerPage, setItemsPerPage] = useState<ItemsPerPage>(() => {
    const saved = localStorage.getItem("car_offboarding_limit");
    return (saved ? parseInt(saved) : 10) as ItemsPerPage;
  });

  // Save to localStorage when itemsPerPage changes
  useEffect(() => {
    localStorage.setItem("car_offboarding_limit", itemsPerPage.toString());
  }, [itemsPerPage]);

  // Reset page to 1 when search changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery]);

  // Fetch cars for offboarding section with pagination
  const { data: carsData, isLoading } = useQuery<{
    success: boolean;
    data: OffboardingCar[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>({
    queryKey: ["cars-offboarding-forms", searchQuery, page, itemsPerPage],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: itemsPerPage.toString(),
      });
      if (searchQuery) {
        params.append("search", searchQuery);
      }
      const response = await fetch(
        buildApiUrl(`/api/cars/offboarding-forms?${params.toString()}`),
        {
          credentials: "include",
        }
      );
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Database connection failed" }));
        throw new Error(
          errorData.error || "Failed to fetch cars for offboarding"
        );
      }
      return response.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Form for Offboard Car dialog
  const offboardCarForm = useForm<OffboardCarFormData>({
    resolver: zodResolver(offboardCarSchema),
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      name: "",
      vehicleMakeModelYear: "",
      licensePlate: "",
      returnDate: new Date().toISOString().split("T")[0],
    },
  });

  // Offboard car mutation
  const offboardCarMutation = useMutation({
    mutationFn: async (data: OffboardCarFormData) => {
      const response = await fetch(buildApiUrl("/api/cars/offboard"), {
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
          .catch(() => ({ error: "Failed to offboard car" }));
        throw new Error(error.error || "Failed to offboard car");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cars-offboarding-forms"] });
      // Also invalidate main cars list so cars page updates (car status changes to off_fleet)
      queryClient.invalidateQueries({ queryKey: ["/api/cars"] });
      // Invalidate sidebar badges (car counts may change)
      queryClient.invalidateQueries({ queryKey: ["sidebar-badges"] });
      setIsOffboardDialogOpen(false);
      offboardCarForm.reset();
      toast({
        title: "✅ Success",
        description: "Car offboarded successfully",
        duration: 5000,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to offboard car",
        variant: "destructive",
      });
    },
  });

  const onSubmitOffboardCar = (data: OffboardCarFormData) => {
    offboardCarMutation.mutate(data);
  };

  const cars = carsData?.data || [];
  const pagination = carsData?.pagination;

  // Handle row click - navigate to client profile
  const handleRowClick = (car: OffboardingCar) => {
    if (car.clientId) {
      setLocation(`/admin/clients?id=${car.clientId}`);
    } else if (car.clientName) {
      setLocation(
        `/admin/clients?search=${encodeURIComponent(car.clientName)}`
      );
    }
  };

  // Format offboard reason
  const formatReason = (reason: string | null): string => {
    if (!reason) return "—";
    return reason
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-foreground">Car Off-boarding</h2>
        <p className="text-sm text-muted-foreground mt-1">
          View vehicles removed from the fleet
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          type="text"
          placeholder="Search by name, email, phone, VIN, plate, or make/model..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-card border-border text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Table Card */}
      <Card className="bg-card border-primary/20 overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : cars.length > 0 ? (
            <>
              <div className="w-full max-w-full overflow-x-auto">
              <div className="overflow-x-auto">
                <Table className="w-full table-auto">
                  <TableHeader>
                    <TableRow className="border-b border-border">
                      <TableHead className="text-left text-xs font-medium text-primary uppercase tracking-wider px-2 sm:px-3 py-3 sm:py-4 whitespace-nowrap">
                        Name
                      </TableHead>
                      <TableHead className="text-left text-xs font-medium text-primary uppercase tracking-wider px-2 sm:px-3 py-3 sm:py-4 hidden md:table-cell whitespace-nowrap">
                        Email
                      </TableHead>
                      <TableHead className="text-left text-xs font-medium text-primary uppercase tracking-wider px-2 sm:px-3 py-3 sm:py-4 hidden lg:table-cell whitespace-nowrap">
                        Phone
                      </TableHead>
                      <TableHead className="text-left text-xs font-medium text-primary uppercase tracking-wider px-2 sm:px-3 py-3 sm:py-4 whitespace-nowrap">
                        Vehicle
                      </TableHead>
                      <TableHead className="text-left text-xs font-medium text-primary uppercase tracking-wider px-2 sm:px-3 py-3 sm:py-4 hidden xl:table-cell whitespace-nowrap">
                        VIN#
                      </TableHead>
                      <TableHead className="text-left text-xs font-medium text-primary uppercase tracking-wider px-2 sm:px-3 py-3 sm:py-4 hidden xl:table-cell whitespace-nowrap">
                        Plate #
                      </TableHead>
                      <TableHead className="text-left text-xs font-medium text-primary uppercase tracking-wider px-2 sm:px-3 py-3 sm:py-4 hidden lg:table-cell whitespace-nowrap">
                        Submitted
                      </TableHead>
                      <TableHead className="text-left text-xs font-medium text-primary uppercase tracking-wider px-2 sm:px-3 py-3 sm:py-4 whitespace-nowrap">
                        Status
                      </TableHead>
                      <TableHead className="text-left text-xs font-medium text-primary uppercase tracking-wider px-2 sm:px-3 py-3 sm:py-4 hidden md:table-cell whitespace-nowrap">
                        Contract
                      </TableHead>
                      <TableHead className="text-left text-xs font-medium text-primary uppercase tracking-wider px-2 sm:px-3 py-3 sm:py-4 hidden 2xl:table-cell whitespace-nowrap">
                        Car Offboarding Date
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
                          {new Date(car.createdAt).toLocaleDateString("en-US", {
                            month: "2-digit",
                            day: "2-digit",
                            year: "numeric",
                          })}
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
                          {car.offboardAt
                            ? new Date(car.offboardAt).toLocaleDateString(
                                "en-US",
                                {
                                  month: "2-digit",
                                  day: "2-digit",
                                  year: "numeric",
                                }
                              )
                            : "—"}
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
                    setPage(1); // Reset to first page when changing limit
                  }}
                  isLoading={isLoading}
                />
              )}
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg">No records found</p>
              <p className="text-sm mt-2">
                {searchQuery
                  ? "Try adjusting your search"
                  : "No cars have been offboarded yet"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Offboard Car Dialog */}
      <Dialog
        open={isOffboardDialogOpen}
        onOpenChange={setIsOffboardDialogOpen}
      >
        <DialogContent className="bg-card border-primary/30 border-2 text-foreground max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-primary">
              Offboard Car
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Remove a vehicle from the active fleet
            </DialogDescription>
          </DialogHeader>

          <Form {...offboardCarForm}>
            <form
              onSubmit={offboardCarForm.handleSubmit(onSubmitOffboardCar)}
              className="space-y-6 mt-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={offboardCarForm.control}
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
                  control={offboardCarForm.control}
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
                control={offboardCarForm.control}
                name="vehicleMakeModelYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-muted-foreground">
                      Vehicle Make/Model (Year){" "}
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
                  control={offboardCarForm.control}
                  name="licensePlate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">
                        License Plate Number{" "}
                        <span className="text-primary">*</span>
                      </FormLabel>
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
                  control={offboardCarForm.control}
                  name="returnDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">
                        Vehicle Return Date{" "}
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
                    setIsOffboardDialogOpen(false);
                    offboardCarForm.reset();
                  }}
                  className="border-border text-muted-foreground hover:bg-muted/50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    offboardCarMutation.isPending ||
                    !offboardCarForm.formState.isValid
                  }
                  className="bg-primary text-primary-foreground hover:bg-primary/80 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {offboardCarMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Offboarding...
                    </>
                  ) : (
                    "Confirm Offboarding"
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
