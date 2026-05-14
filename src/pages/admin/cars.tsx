import React, { useState, useEffect } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AdminLayout } from "@/components/admin/admin-layout";
import { ClientPageLinks } from "@/components/client/ClientPageLinks";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  TablePagination,
  ItemsPerPage,
} from "@/components/ui/table-pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, buildApiUrl, getProxiedImageUrl } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Plus, Edit, Search, X, ExternalLink, Car as CarIcon } from "lucide-react";
import { TableRowSkeleton } from "@/components/ui/skeletons";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Car {
  id: number;
  vin: string;
  makeModel: string;
  make?: string | null;
  model?: string | null;
  licensePlate: string | null;
  year: number | null;
  color: string | null;
  mileage: number;
  status: "ACTIVE" | "INACTIVE";
  /**
   * Car photo paths returned by the backend (typically under `/car-photos/...`).
   * We use the first photo as the thumbnail in the Cars table.
   */
  photos?: string[];
  offboardReason: "sold" | "damaged" | "end_lease" | "other" | null;
  offboardNote: string | null;
  offboardAt: string | null;
  userId?: number | null;
  clientId?: number | null;
  tireSize?: string | null;
  oilType?: string | null;
  lastOilChange?: string | null;
  fuelType?: string | null;
  registrationExpiration?: string | null;
  titleType?: string | null;
  contactPhone?: string | null;
  turoLink?: string | null;
  adminTuroLink?: string | null;
  isActive?: number; // car_is_active value: 0=management, 1=own, 2=off_ride, 3=off_ride
  managementStatus?: "management" | "own" | "off_ride";
  owner?: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone?: string | null;
  } | null;
}

const carSchema = z.object({
  vin: z
    .string()
    .length(17, "VIN must be exactly 17 characters"),
  makeModel: z.string().min(1, "Make & Model is required"),
  make: z.string().optional(),
  model: z.string().optional(),
  licensePlate: z.string().optional(),
  year: z.string().optional(),
  color: z.string().optional(),
  interiorColor: z.string().optional(),
  mileage: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  tireSize: z.string().optional(),
  oilType: z.string().optional(),
  lastOilChange: z.string().optional(),
  fuelType: z.string().optional(),
  titleType: z.string().optional(),
  turoLink: z.string().url().optional().or(z.literal("")),
  adminTuroLink: z.string().url().optional().or(z.literal("")),
  offboardAt: z.string().optional(),
  offboardReason: z.enum(["sold", "damaged", "end_lease", "other"]).optional().or(z.literal("")),
  offboardNote: z.string().optional(),
});

type CarFormData = z.infer<typeof carSchema>;

export default function CarsPage() {
  const [, setLocation] = useLocation();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [isLastActiveCarDialogOpen, setIsLastActiveCarDialogOpen] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<"ACTIVE" | "INACTIVE" | null>(null);

  // Load items per page from localStorage, default to 10
  const [itemsPerPage, setItemsPerPage] = useState<ItemsPerPage>(() => {
    const saved = localStorage.getItem("cars_limit");
    return (saved ? parseInt(saved) : 10) as ItemsPerPage;
  });

  // Save to localStorage when itemsPerPage changes
  useEffect(() => {
    localStorage.setItem("cars_limit", itemsPerPage.toString());
  }, [itemsPerPage]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current user to check role
  const { data: userData } = useQuery<{ user?: { isAdmin?: boolean; isClient?: boolean } }>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });
  const isAdmin = userData?.user?.isAdmin === true;
  const isClient = userData?.user?.isClient === true;

  const form = useForm<CarFormData>({
    resolver: zodResolver(carSchema),
    defaultValues: {
      vin: "",
      makeModel: "",
      make: "",
      model: "",
      licensePlate: "",
      year: "",
      color: "",
      interiorColor: "",
      mileage: "",
      status: "ACTIVE",
      tireSize: "",
      oilType: "",
      lastOilChange: "",
      fuelType: "",
      titleType: "",
      turoLink: "",
      adminTuroLink: "",
      offboardAt: "",
      offboardReason: "",
      offboardNote: "",
    },
  });

  const { data: carsData, isLoading } = useQuery<{
    success: boolean;
    data: Car[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>({
    queryKey: isClient
      ? ["/api/client/cars", statusFilter, searchQuery, page, itemsPerPage]
      : ["/api/cars", statusFilter, searchQuery, page, itemsPerPage],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (isClient) {
        const includeReturned = statusFilter === "all" ? "true" : "false";
        const url = buildApiUrl(`/api/client/cars?includeReturned=${includeReturned}`);
        const response = await fetch(url, { credentials: "include" });
        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: "Failed to fetch client cars" }));
          throw new Error(errorData.error || "Failed to fetch client cars");
        }
        const result = await response.json();
        const clientCars = Array.isArray(result?.data) ? result.data : [];

        const mapClientStatus = (carStatus?: string, isActive?: boolean): "ACTIVE" | "INACTIVE" => {
          if (carStatus === "off_fleet") return "INACTIVE";
          if (carStatus === "available" || carStatus === "in_use" || carStatus === "pending") return "ACTIVE";
          return isActive ? "ACTIVE" : "INACTIVE";
        };

        const parsePhotos = (rawPhoto: unknown): string[] => {
          if (!rawPhoto) return [];
          if (Array.isArray(rawPhoto)) {
            return rawPhoto.filter((item) => typeof item === "string") as string[];
          }
          if (typeof rawPhoto === "string") {
            try {
              const parsed = JSON.parse(rawPhoto);
              if (Array.isArray(parsed)) {
                return parsed.filter((item) => typeof item === "string") as string[];
              }
              if (typeof parsed === "string") {
                return [parsed];
              }
            } catch {
              return [rawPhoto];
            }
            return [rawPhoto];
          }
          return [];
        };

        const normalizedCars: Car[] = clientCars.map((car: any) => ({
          id: car.id,
          vin: car.vin || "",
          makeModel: car.makeModel || [car.make, car.model, car.year].filter(Boolean).join(" ") || "N/A",
          make: car.make || null,
          model: car.model || null,
          licensePlate: car.plateNumber || null,
          year: car.year || null,
          color: null,
          mileage: typeof car.mileage === "number" ? car.mileage : 0,
          status: mapClientStatus(car.carStatus, car.isActive),
          photos: parsePhotos(car.photo),
          offboardReason: null,
          offboardNote: null,
          offboardAt: car.returnedAt || null,
          clientId: car.clientId || null,
          tireSize: car.tireSize || null,
          oilType: car.oilType || null,
          lastOilChange: null,
          fuelType: car.fuelType || null,
          turoLink: car.turoLink || null,
          adminTuroLink: car.adminTuroLink || null,
          isActive: car.isActive ? 1 : 0,
          managementStatus: undefined,
          contactPhone: car.contactPhone || null,
          owner: car.ownerFirstName || car.ownerLastName
            ? {
                firstName: car.ownerFirstName || "",
                lastName: car.ownerLastName || "",
                email: null,
                phone: car.contactPhone || null,
              }
            : null,
        }));

        const normalizedSearch = searchQuery.trim().toLowerCase();
        const matchesSearch = (car: Car) =>
          !normalizedSearch ||
          car.makeModel.toLowerCase().includes(normalizedSearch) ||
          (car.licensePlate || "").toLowerCase().includes(normalizedSearch);

        const matchesStatus = (car: Car) => {
          if (statusFilter === "all") return true;
          return car.status === statusFilter;
        };

        const filteredCars = normalizedCars.filter((car) => matchesSearch(car) && matchesStatus(car));
        const total = filteredCars.length;
        const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
        const startIndex = (page - 1) * itemsPerPage;
        const paginatedCars = filteredCars.slice(startIndex, startIndex + itemsPerPage);

        return {
          success: true,
          data: paginatedCars,
          pagination: {
            page,
            limit: itemsPerPage,
            total,
            totalPages,
          },
        };
      }

      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      if (searchQuery) {
        params.append("search", searchQuery);
      }
      params.append("page", page.toString());
      params.append("limit", itemsPerPage.toString());
      const url = buildApiUrl(`/api/cars?${params.toString()}`);
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Database connection failed" }));
        throw new Error(errorData.error || "Failed to fetch cars");
      }
      return response.json();
    },
    enabled: !!userData?.user,
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CarFormData) => {
      const formData = new FormData();
      formData.append("vin", data.vin);
      formData.append("makeModel", data.makeModel);
      if (data.make) formData.append("make", data.make);
      if (data.model) formData.append("model", data.model);
      if (data.licensePlate) formData.append("licensePlate", data.licensePlate);
      if (data.year) formData.append("year", data.year);
      if (data.color) formData.append("color", data.color);
      if (data.interiorColor) formData.append("interiorColor", data.interiorColor);
      if (data.mileage) formData.append("mileage", data.mileage);
      if (data.status) formData.append("status", data.status);
      if (data.tireSize) formData.append("tireSize", data.tireSize);
      if (data.oilType) formData.append("oilType", data.oilType);
      if (data.lastOilChange) formData.append("lastOilChange", data.lastOilChange);
      if (data.fuelType) formData.append("fuelType", data.fuelType);
      if (data.titleType) formData.append("titleType", data.titleType);
      if (data.turoLink) formData.append("turoLink", data.turoLink);
      if (data.adminTuroLink) formData.append("adminTuroLink", data.adminTuroLink);

      const response = await fetch(buildApiUrl("/api/cars"), {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create car");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cars"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-badges"] });
      toast({
        title: "Success",
        description: "Car added successfully",
      });
      setIsAddModalOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create car",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: CarFormData }) => {
      console.log(`📤 [FRONTEND] Update mutation - Full form data:`, data);
      console.log(`📤 [FRONTEND] Status value:`, data.status, `(type: ${typeof data.status})`);
      
      const formData = new FormData();
      // Always append all fields, even if empty, so backend can update them
      formData.append("vin", data.vin || "");
      formData.append("makeModel", data.makeModel || "");
      formData.append("make", data.make || "");
      formData.append("model", data.model || "");
      formData.append("licensePlate", data.licensePlate || "");
      formData.append("year", data.year || "");
      formData.append("color", data.color || "");
      formData.append("interiorColor", data.interiorColor || "");
      formData.append("mileage", data.mileage || "");
      
      // ALWAYS send status - it's required and should always have a value
      const statusValue = data.status || "ACTIVE"; // Default to ACTIVE if somehow undefined
      formData.append("status", statusValue);
      console.log(`📤 [FRONTEND] Appending status to FormData: "${statusValue}"`);
      
      // Always append optional fields, even if empty
      formData.append("tireSize", data.tireSize || "");
      formData.append("oilType", data.oilType || "");
      formData.append("lastOilChange", data.lastOilChange || "");
      formData.append("fuelType", data.fuelType || "");
      formData.append("titleType", data.titleType || "");
      formData.append("turoLink", data.turoLink || "");
      formData.append("adminTuroLink", data.adminTuroLink || "");
      formData.append("offboardAt", data.offboardAt || "");
      formData.append("offboardReason", data.offboardReason || "");
      formData.append("offboardNote", data.offboardNote || "");
      
      // Debug: Log all FormData entries
      console.log(`📤 [FRONTEND] FormData entries:`);
      for (const [key, value] of formData.entries()) {
        console.log(`   ${key}: ${value}`);
      }

      const response = await fetch(buildApiUrl(`/api/cars/${id}`), {
        method: "PATCH",
        credentials: "include",
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update car");
      }
      return response.json();
    },
    onSuccess: async (responseData) => {
      // Immediately update the cache with the response data
      if (responseData?.success && responseData?.data) {
        const updatedCar = responseData.data;
        
        // Update all matching car queries in cache
        queryClient.setQueriesData<{ success: boolean; data: Car[]; pagination?: any }>(
          { queryKey: ["/api/cars"], exact: false },
          (oldData) => {
            if (!oldData) return oldData;
            
            return {
              ...oldData,
              data: oldData.data.map((car) =>
                car.id === updatedCar.id ? updatedCar : car
              ),
            };
          }
        );
      }
      
      // Invalidate all car queries to force refetch in background
      await queryClient.invalidateQueries({ queryKey: ["/api/cars"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["sidebar-badges"] });
      
      // Force refetch to ensure UI updates immediately
      await queryClient.refetchQueries({ queryKey: ["/api/cars"], exact: false });
      
      toast({
        title: "Success",
        description: "Car updated successfully",
      });
      setIsEditModalOpen(false);
      setSelectedCar(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update car",
        variant: "destructive",
      });
    },
  });

  const handleAddClick = () => {
    setSelectedCar(null);
    form.reset({
      vin: "",
      makeModel: "",
      make: "",
      model: "",
      licensePlate: "",
      year: "",
      color: "",
      interiorColor: "",
      mileage: "",
      status: "ACTIVE",
      tireSize: "",
      oilType: "",
      lastOilChange: "",
      fuelType: "",
      titleType: "",
      turoLink: "",
      adminTuroLink: "",
    });
    setIsAddModalOpen(true);
  };

  const handleEditClick = (car: Car) => {
    setSelectedCar(car);
    form.reset({
      vin: car.vin,
      makeModel: car.makeModel,
      make: car.make || "",
      model: car.model || "",
      licensePlate: car.licensePlate || "",
      year: car.year?.toString() || "",
      color: car.color || "",
      interiorColor: "",
      mileage: car.mileage?.toString() || "",
      status: car.status || "ACTIVE",
      tireSize: car.tireSize || "",
      oilType: car.oilType || "",
      lastOilChange: car.lastOilChange || "",
      fuelType: car.fuelType || "",
      turoLink: car.turoLink || "",
      adminTuroLink: car.adminTuroLink || "",
      offboardAt: car.offboardAt ? new Date(car.offboardAt).toISOString().split('T')[0] : "",
      offboardReason: car.offboardReason || "",
      offboardNote: car.offboardNote || "",
    });
    setIsEditModalOpen(true);
  };

  const onSubmit = (data: CarFormData) => {
    if (selectedCar) {
      updateMutation.mutate({ id: selectedCar.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-500/20 text-green-700 border-green-500/30 font-medium";
      case "INACTIVE":
        return "bg-gray-500/20 text-gray-700 border-gray-500/30 font-medium";
      default:
        return "bg-gray-500/20 text-gray-700 border-gray-500/30 font-medium";
    }
  };

  /**
   * Client requirement: show a small car-image icon before the Status badge.
   * Uses the first uploaded photo as thumbnail (or a fallback icon if none).
   * Optimized for performance with lazy loading and intersection observer.
   */
  const CarStatusThumbnail = ({ car }: { car: Car }) => {
    const [failed, setFailed] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const imgRef = React.useRef<HTMLDivElement>(null);

    // Use Intersection Observer for better lazy loading - only load when visible
    React.useEffect(() => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setIsVisible(true);
              observer.disconnect(); // Disconnect after first visibility
            }
          });
        },
        {
          rootMargin: "50px", // Start loading 50px before visible
          threshold: 0.01,
        }
      );

      if (imgRef.current) {
        observer.observe(imgRef.current);
      }

      return () => {
        if (imgRef.current) {
          observer.unobserve(imgRef.current);
        }
        observer.disconnect();
      };
    }, []);

    const rawPath = car.photos?.[0];
    if (!rawPath || failed) {
      return (
        <div 
          ref={imgRef}
          className="h-7 w-7 sm:h-8 sm:w-8 rounded-md bg-background/30 border border-border flex items-center justify-center shrink-0"
        >
          <CarIcon className="h-4 w-4 text-muted-foreground" />
        </div>
      );
    }

    // Use getProxiedImageUrl to handle both GCS URLs and local paths
    // This ensures CORS issues are avoided by proxying GCS URLs through the backend
    let src: string;
    if (!rawPath) {
      console.warn(`[CARS] Empty photo path for car ${car.id}`);
      src = '';
    } else {
      src = getProxiedImageUrl(rawPath);
      // Add size parameter for optimization if using GCS proxy
      if (src.includes('/api/gcs-image-proxy')) {
        // Request a smaller thumbnail (64x64 for 32px display, 2x for retina = 128x128)
        src += (src.includes('?') ? '&' : '?') + 'size=128';
      }
    }

    return (
      <div 
        ref={imgRef}
        className="h-7 w-7 sm:h-8 sm:w-8 rounded-md bg-background/30 border border-border shrink-0 relative overflow-hidden"
      >
        {isVisible ? (
          <img
            src={src}
            alt="Car thumbnail"
            className="h-full w-full rounded-md object-cover"
            loading="lazy"
            decoding="async"
            width={32}
            height={32}
            onError={(e) => {
              console.error('Failed to load car thumbnail:', src);
              console.error('Original photo:', rawPath);
              setFailed(true);
            }}
            onLoad={() => {
              // Image loaded successfully
            }}
          />
        ) : (
          // Show skeleton while waiting for visibility
          <div className="h-full w-full flex items-center justify-center">
            <CarIcon className="h-4 w-4 text-gray-600 animate-pulse" />
          </div>
        )}
      </div>
    );
  };

  const cars = carsData?.data || [];

  return (
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-primary">Cars</h1>
            <p className="text-muted-foreground text-xs sm:text-sm">{isAdmin ? "Manage your vehicle fleet" : "View your vehicles"}</p>
          </div>
        </div>

        {/* Search and Filter */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search by VIN, Plate, Owner, Make/Model/Year..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1); // Reset to first page on search
                  }}
                  className="pl-10 bg-card border-border text-foreground placeholder:text-gray-600"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  setPage(1); // Reset to first page on filter change
                }}
              >
                <SelectTrigger className="w-full md:w-[200px] bg-card border-border text-foreground">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                  <SelectItem value="INACTIVE">INACTIVE</SelectItem>
                </SelectContent>
              </Select>
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchQuery("")}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Cars Table */}
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            <div className="overflow-x-auto -mx-3 sm:mx-0">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-center text-[10px] sm:text-xs font-semibold text-foreground uppercase tracking-wider px-1.5 sm:px-2 py-2 sm:py-3 w-8 sm:w-10">
                      #
                    </th>
                    <th className="text-center text-[10px] sm:text-xs font-semibold text-foreground uppercase tracking-wider px-1.5 sm:px-2 py-2 sm:py-3">
                      Status
                    </th>
                    <th className="text-center text-[10px] sm:text-xs font-semibold text-foreground uppercase tracking-wider px-1.5 sm:px-2 py-2 sm:py-3">
                      Stats
                    </th>
                    <th className="text-center text-[10px] sm:text-xs font-semibold text-foreground uppercase tracking-wider px-1.5 sm:px-2 py-2 sm:py-3 hidden md:table-cell">
                      Management
                    </th>
                    <th className="text-center text-[10px] sm:text-xs font-semibold text-foreground uppercase tracking-wider px-1.5 sm:px-2 py-2 sm:py-3">
                      Owner
                    </th>
                    <th className="text-center text-[10px] sm:text-xs font-semibold text-foreground uppercase tracking-wider px-1.5 sm:px-2 py-2 sm:py-3">
                      Make
                    </th>
                    <th className="text-center text-[10px] sm:text-xs font-semibold text-foreground uppercase tracking-wider px-1.5 sm:px-2 py-2 sm:py-3 hidden lg:table-cell">
                      Year
                    </th>
                    <th className="text-center text-[10px] sm:text-xs font-semibold text-foreground uppercase tracking-wider px-1.5 sm:px-2 py-2 sm:py-3">
                      Model/Specs
                    </th>
                    <th className="text-center text-[10px] sm:text-xs font-semibold text-foreground uppercase tracking-wider px-1.5 sm:px-2 py-2 sm:py-3 hidden lg:table-cell">
                      Contact
                    </th>
                    <th className="text-center text-[10px] sm:text-xs font-semibold text-foreground uppercase tracking-wider px-1.5 sm:px-2 py-2 sm:py-3 hidden lg:table-cell">
                      VIN #
                    </th>
                    <th className="text-center text-[10px] sm:text-xs font-semibold text-foreground uppercase tracking-wider px-1.5 sm:px-2 py-2 sm:py-3 hidden lg:table-cell">
                      Plate #
                    </th>
                    <th className="text-center text-[10px] sm:text-xs font-semibold text-foreground uppercase tracking-wider px-1.5 sm:px-2 py-2 sm:py-3 hidden lg:table-cell">
                      Gas
                    </th>
                    <th className="text-center text-[10px] sm:text-xs font-semibold text-foreground uppercase tracking-wider px-1.5 sm:px-2 py-2 sm:py-3 hidden xl:table-cell">
                      Tire Size
                    </th>
                    <th className="text-center text-[10px] sm:text-xs font-semibold text-foreground uppercase tracking-wider px-1.5 sm:px-2 py-2 sm:py-3 hidden xl:table-cell">
                      Oil Type
                    </th>
                    <th className="text-center text-[10px] sm:text-xs font-semibold text-foreground uppercase tracking-wider px-1.5 sm:px-2 py-2 sm:py-3 hidden xl:table-cell">
                      Turo Link
                    </th>
                    {isAdmin && (
                      <th className="text-center text-[10px] sm:text-xs font-semibold text-foreground uppercase tracking-wider px-1.5 sm:px-2 py-2 sm:py-3 hidden xl:table-cell">
                        Admin Turo Link
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading ? (
                    <TableRowSkeleton colSpan={isAdmin ? 13 : 12} rows={5} />
                  ) : cars.length > 0 ? (
                    cars.map((car, index) => {
                      const formatDate = (dateStr: string | null | undefined): string => {
                        if (!dateStr) return "N/A";
                        try {
                          return new Date(dateStr).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          });
                        } catch {
                          return "N/A";
                        }
                      };

                      // Get Management status from car_is_active value
                      // Mapping: 0 = management, 1 = own, 2 = off_ride, 3 = off_ride
                      const getManagementStatusFromIsActive = (isActive?: number): "management" | "own" | "off_ride" => {
                        if (isActive === undefined || isActive === null) return "own"; // Default fallback
                        if (isActive === 0) return "own";
                        if (isActive === 1) return "management";
                        if (isActive === 2 || isActive === 3) return "off_ride";
                        return "own"; // Default fallback
                      };
                      
                      const getManagementDisplay = (status: "management" | "own" | "off_ride") => {
                        switch (status) {
                          case "management":
                            return "Management";
                          case "own":
                            return "Own";
                          case "off_ride":
                            return "Off Ride";
                          default:
                            return "Own";
                        }
                      };
                      
                      // Derive management status from car_is_active
                      const derivedManagementStatus = getManagementStatusFromIsActive(car.isActive);
                      const managementValue = getManagementDisplay(derivedManagementStatus);

                      // Create unique key to avoid duplicate key warnings
                      // Use combination of id, index, and vin to ensure uniqueness
                      const uniqueKey = `car-${car.id}-${index}-${car.vin || 'no-vin'}`;

                      // Calculate global row number across all pages
                      const globalRowNumber = (page - 1) * itemsPerPage + index + 1;

                      return (
                        <tr
                          key={uniqueKey}
                          className="hover:bg-muted/50 transition-colors group border-b border-border"
                        >
                          <td className="text-center text-primary text-xs sm:text-sm px-1.5 sm:px-2 py-2 sm:py-3 align-middle">
                            {globalRowNumber}
                          </td>
                          <td className="text-center px-1.5 sm:px-2 py-2 sm:py-3 align-middle">
                            <div className="flex items-center justify-center gap-1.5">
                              <CarStatusThumbnail car={car} />
                              <Badge
                                variant="outline"
                                className={cn(getStatusBadgeColor(car.status), "text-xs")}
                              >
                                {car.status === "ACTIVE"
                                  ? "ACTIVE"
                                  : car.status === "INACTIVE"
                                    ? "INACTIVE"
                                    : car.status || "ACTIVE"}
                              </Badge>
                            </div>
                          </td>
                          <td className="text-center px-1.5 sm:px-2 py-2 sm:py-3 align-middle">
                            <a
                              href={`/admin/view-car/${car.id}`}
                              onClick={(e) => {
                                e.preventDefault();
                                setLocation(`/admin/view-car/${car.id}`);
                              }}
                              className="text-[#B8860B] hover:text-[#9A7209] hover:underline font-semibold text-xs sm:text-sm transition-colors duration-200"
                            >
                              View Stats
                            </a>
                          </td>
                          <td className="text-center px-1.5 sm:px-2 py-2 sm:py-3 align-middle hidden md:table-cell">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs",
                                derivedManagementStatus === "management"
                                  ? "bg-[#D3BC8D]/25 text-[#8B6914] border-[#D3BC8D]/60 font-semibold shadow-sm"
                                  : derivedManagementStatus === "off_ride"
                                    ? "bg-yellow-500/20 text-yellow-800 border-yellow-600/50 font-semibold shadow-sm"
                                    : "bg-[#D3BC8D]/15 text-[#8B6914] border-[#D3BC8D]/40 font-semibold shadow-sm"
                              )}
                            >
                            {managementValue}
                            </Badge>
                          </td>
                          <td className="text-center px-1.5 sm:px-2 py-2 sm:py-3 align-middle">
                            {car.owner ? (
                              <div>
                                {car.clientId ? (
                                  <>
                                    <a
                                      href={`/admin/clients/${car.clientId}`}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        setLocation(`/admin/clients/${car.clientId}`);
                                      }}
                                      className="text-[#B8860B] hover:text-[#9A7209] hover:underline font-semibold text-xs sm:text-sm cursor-pointer block transition-colors duration-200"
                                    >
                                      {car.owner.firstName} {car.owner.lastName}
                                    </a>
                                    {car.owner.email && (
                                      <a
                                        href={`/admin/clients/${car.clientId}`}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          setLocation(`/admin/clients/${car.clientId}`);
                                        }}
                                        className="text-[#8B6914] hover:text-[#B8860B] hover:underline text-[10px] sm:text-xs cursor-pointer block mt-0.5 transition-colors duration-200 font-medium"
                                      >
                                        {car.owner.email}
                                      </a>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <div className="text-foreground text-xs sm:text-sm">
                                      {car.owner.firstName} {car.owner.lastName}
                                    </div>
                                    {car.owner.email && (
                                      <div className="text-muted-foreground text-[10px] sm:text-xs">
                                        {car.owner.email}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs sm:text-sm">
                                Unassigned
                              </span>
                            )}
                          </td>
                          <td className="text-center text-foreground text-xs sm:text-sm px-1.5 sm:px-2 py-2 sm:py-3 align-middle">
                            {car.make || "N/A"}
                          </td>
                          <td className="text-center text-foreground text-xs sm:text-sm px-1.5 sm:px-2 py-2 sm:py-3 align-middle hidden lg:table-cell">
                            {car.year || "N/A"}
                          </td>
                          <td className="text-center text-foreground text-xs sm:text-sm px-1.5 sm:px-2 py-2 sm:py-3 align-middle">
                            {car.model || "N/A"}
                          </td>
                          <td className="text-center text-muted-foreground text-xs sm:text-sm px-1.5 sm:px-2 py-2 sm:py-3 align-middle hidden lg:table-cell">
                            {car.contactPhone || car.owner?.phone || "N/A"}
                          </td>
                          <td className="text-center text-foreground font-mono text-xs sm:text-sm px-1.5 sm:px-2 py-2 sm:py-3 align-middle hidden lg:table-cell">
                            {car.vin || "N/A"}
                          </td>
                          <td className="text-center text-muted-foreground text-xs sm:text-sm px-1.5 sm:px-2 py-2 sm:py-3 align-middle hidden lg:table-cell">
                            {car.licensePlate || "N/A"}
                          </td>
                          <td className="text-center text-muted-foreground text-xs sm:text-sm px-1.5 sm:px-2 py-2 sm:py-3 align-middle hidden lg:table-cell">
                            {car.fuelType || "N/A"}
                          </td>
                          <td className="text-center text-muted-foreground text-xs sm:text-sm px-1.5 sm:px-2 py-2 sm:py-3 align-middle hidden xl:table-cell">
                            {car.tireSize || "N/A"}
                          </td>
                          <td className="text-center text-muted-foreground text-xs sm:text-sm px-1.5 sm:px-2 py-2 sm:py-3 align-middle hidden xl:table-cell">
                            {car.oilType || "N/A"}
                          </td>
                          <td className="text-center px-1.5 sm:px-2 py-2 sm:py-3 align-middle hidden xl:table-cell">
                            {car.turoLink ? (
                              <a
                                href={car.turoLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-[#B8860B] hover:text-[#9A7209] hover:underline inline-flex items-center justify-center transition-colors duration-200"
                              >
                                <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4" />
                              </a>
                            ) : (
                              <span className="text-gray-600 text-xs sm:text-sm">N/A</span>
                            )}
                          </td>
                          {isAdmin && (
                            <td className="text-center px-1.5 sm:px-2 py-2 sm:py-3 align-middle hidden xl:table-cell">
                              {car.adminTuroLink ? (
                                <a
                                  href={car.adminTuroLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-blue-700 hover:underline inline-flex items-center justify-center"
                                >
                                  <ExternalLink className="w-3 h-3 sm:w-4 sm:h-4" />
                                </a>
                              ) : (
                                <span className="text-gray-600 text-xs sm:text-sm">N/A</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={isAdmin ? 13 : 12} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <p className="text-muted-foreground text-lg">No cars found</p>
                          <p className="text-muted-foreground text-sm">
                            Try adjusting your search or filters
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {carsData?.pagination && (
              <TablePagination
                totalItems={carsData.pagination.total}
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
          </CardContent>
        </Card>

        {/* Add/Edit Car Modal */}
        <Dialog
          open={isAddModalOpen || isEditModalOpen}
          onOpenChange={(open) => {
            if (!open) {
              setIsAddModalOpen(false);
              setIsEditModalOpen(false);
              setSelectedCar(null);
              form.reset();
            }
          }}
        >
          <DialogContent className="bg-card border-border text-foreground max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">
                {selectedCar ? "Edit Car" : "Add New Car"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {selectedCar
                  ? "Update car information"
                  : "Add a new vehicle to the fleet"}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4 mt-4"
              >
                <FormField
                  control={form.control}
                  name="vin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">VIN *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="bg-card border-border text-foreground focus:border-primary"
                          placeholder="1HGBH41JXMN109186"
                          maxLength={17}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="makeModel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">
                        Make & Model *
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="bg-card border-border text-foreground focus:border-primary"
                          placeholder="2024 Mercedes S580"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="make"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Make</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className="bg-card border-border text-foreground focus:border-primary"
                            placeholder="Mercedes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Model</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className="bg-card border-border text-foreground focus:border-primary"
                            placeholder="S580"
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
                    name="licensePlate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">
                          License Plate
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className="bg-card border-border text-foreground focus:border-primary"
                            placeholder="ABC-1234"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="year"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Year</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            className="bg-card border-border text-foreground focus:border-primary"
                            placeholder="2024"
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
                    name="color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Exterior Color</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className="bg-card border-border text-foreground focus:border-primary"
                            placeholder="Black"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="interiorColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Interior Color</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className="bg-card border-border text-foreground focus:border-primary"
                            placeholder="Black"
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
                    name="mileage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">
                          Current Mileage
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            className="bg-card border-border text-foreground focus:border-primary"
                            placeholder="0"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Status *</FormLabel>
                        <Select
                          onValueChange={async (value) => {
                            console.log(`📝 [FRONTEND] Status changed to: ${value}`);
                            
                            // If changing to INACTIVE and editing an existing car, check if it's the last active car
                            if (value === "INACTIVE" && selectedCar && selectedCar.userId) {
                              try {
                                const response = await fetch(
                                  buildApiUrl(`/api/cars/check-last-active?carId=${selectedCar.id}&userId=${selectedCar.userId}`),
                                  { credentials: "include" }
                                );
                                if (response.ok) {
                                  const result = await response.json();
                                  if (result.isLastActiveCar) {
                                    setPendingStatusChange("INACTIVE");
                                    setIsLastActiveCarDialogOpen(true);
                                    return; // Don't update the field yet
                                  }
                                }
                              } catch (error) {
                                console.error("Error checking last active car:", error);
                              }
                            }
                            
                            field.onChange(value);
                          }}
                          value={field.value || "ACTIVE"}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-card border-border text-foreground focus:border-primary">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-card border-border text-foreground">
                            <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                            <SelectItem value="INACTIVE">INACTIVE</SelectItem>
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
                    name="tireSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Tire Size</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className="bg-card border-border text-foreground focus:border-primary"
                            placeholder="225/50R17"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="oilType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Oil Type</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className="bg-card border-border text-foreground focus:border-primary"
                            placeholder="5W-30"
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
                    name="lastOilChange"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Last Oil Change</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="date"
                            className="bg-card border-border text-foreground focus:border-primary"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="fuelType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Fuel Type</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-card border-border text-foreground focus:border-primary">
                              <SelectValue placeholder="Select fuel type" />
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
                </div>

                <FormField
                  control={form.control}
                  name="titleType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">Title Type</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="bg-card border-border text-foreground focus:border-primary"
                          placeholder="Enter title type"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    control={form.control}
                    name="turoLink"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Turo Link</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="url"
                            className="bg-card border-border text-foreground focus:border-primary"
                            placeholder="https://turo.com/us/en/car/..."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="adminTuroLink"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Admin Turo Link</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="url"
                            className="bg-card border-border text-foreground focus:border-primary"
                            placeholder="https://turo.com/us/en/car/..."
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
                    variant="ghost"
                    onClick={() => {
                      setIsAddModalOpen(false);
                      setIsEditModalOpen(false);
                      setSelectedCar(null);
                      form.reset();
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-primary text-primary-foreground hover:bg-primary/80 font-medium"
                    disabled={
                      createMutation.isPending || updateMutation.isPending
                    }
                  >
                    {selectedCar ? "Update" : "Create"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Confirmation Dialog for Last Active Car */}
        <AlertDialog open={isLastActiveCarDialogOpen} onOpenChange={setIsLastActiveCarDialogOpen}>
          <AlertDialogContent className="bg-card border-border text-foreground">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-semibold text-primary">
                Last Active Car Warning
              </AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                This is the client's last active car. Changing the status to INACTIVE will leave the client with no active vehicles. You may want to consider deactivating the client account as well.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setIsLastActiveCarDialogOpen(false);
                  setPendingStatusChange(null);
                  // Reset status to previous value
                  if (selectedCar) {
                    form.setValue("status", selectedCar.status);
                  }
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (pendingStatusChange && selectedCar) {
                    form.setValue("status", pendingStatusChange);
                    setIsLastActiveCarDialogOpen(false);
                    setPendingStatusChange(null);
                  }
                }}
                className="bg-primary text-primary-foreground hover:bg-primary/80 font-medium"
              >
                Continue
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <ClientPageLinks />
      </div>
    </AdminLayout>
  );
}
