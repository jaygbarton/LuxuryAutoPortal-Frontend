import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Car, Upload, X, Edit, Trash2, ChevronLeft, ChevronRight, CheckSquare, Square, FileText, Star, Plus, Minus } from "lucide-react";
import { CarDetailSkeleton } from "@/components/ui/skeletons";
import { buildApiUrl, getProxiedImageUrl } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getOnlineStatusBadge, formatLastLogin } from "@/lib/onlineStatus";
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
import { Checkbox } from "@/components/ui/checkbox";

/**
 * Extract Turo vehicle ID from a Turo listing URL.
 * Turo URLs typically end with the vehicle ID: .../location/make/model/ID
 */
function extractTuroVehicleIdFromUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  try {
    const href = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    const u = new URL(href);
    const pathSegments = u.pathname.split("/").filter(Boolean);
    const last = pathSegments[pathSegments.length - 1];
    if (last && /^\d+$/.test(last)) return last;
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch document URL with credentials and return a blob URL for display.
 * Required in production when frontend and backend are on different origins:
 * <img src="..."> does not send cookies cross-origin, so the auth proxy returns 401.
 * Fetching with credentials: 'include' sends cookies and we display the result via blob URL.
 */
function useDocumentBlobUrl(apiUrl: string | null) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const isProxyUrl = Boolean(apiUrl?.includes("/api/cars/documents/file-content"));

  useEffect(() => {
    if (!apiUrl || !apiUrl.trim()) {
      setBlobUrl(null);
      setLoading(false);
      setError(false);
      return;
    }
    if (!isProxyUrl) {
      setBlobUrl(apiUrl);
      setLoading(false);
      setError(false);
      return;
    }
    setLoading(true);
    setError(false);
    let revoked = false;
    fetch(apiUrl, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (revoked) return;
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        setLoading(false);
      })
      .catch(() => {
        if (!revoked) {
          setError(true);
          setLoading(false);
          setBlobUrl(null);
        }
      });
    return () => {
      revoked = true;
    };
  }, [apiUrl, isProxyUrl]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  return {
    src: isProxyUrl ? blobUrl : apiUrl,
    loading: isProxyUrl && loading,
    error: isProxyUrl && error,
  };
}

/** Renders an img for a document URL; uses credentialled fetch for proxy URLs so it works in published (cross-origin) project. */
function DocumentImageWithAuth({
  url,
  alt,
  className,
  onLoad,
  onError,
}: {
  url: string;
  alt: string;
  className?: string;
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
  onError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}) {
  const { src, loading, error } = useDocumentBlobUrl(url);
  if (loading) {
    return (
      <div className={cn("w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground text-sm bg-muted/30 rounded-lg", className)}>
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <span>Loading...</span>
      </div>
    );
  }
  if (error || !src) {
    return (
      <div className={cn("w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground text-sm bg-muted/30 rounded-lg border border-border p-4", className)}>
        <FileText className="w-10 h-10 text-muted-foreground/70" />
        <span className="text-center">Document unavailable</span>
        <span className="text-xs text-center">File not found or no access</span>
      </div>
    );
  }
  return <img src={src} alt={alt} className={className} onLoad={onLoad} onError={onError} />;
}

interface CarDetail {
  id: number;
  vin: string;
  makeModel: string;
  licensePlate?: string;
  year?: number;
  color?: string;
  mileage: number;
  status: "ACTIVE" | "INACTIVE";
  rawStatus?: "pending" | "available" | "in_use" | "maintenance" | "off_fleet"; // Raw database status
  offboardReason?: "sold" | "damaged" | "end_lease" | "other" | null;
  offboardNote?: string | null;
  offboardAt?: string | null;
  createdAt: string;
  updatedAt: string;
  userId?: number | null;
  clientId?: number | null;
  owner?: {
    firstName: string;
    lastName: string;
    email: string | null;
    lastLoginAt?: string | null;
    lastLogoutAt?: string | null;
    isActive?: boolean;
    status?: number;
  } | null;
  photos?: string[];
  turoLink?: string | null;
  adminTuroLink?: string | null;
  turoVehicleIds?: string[] | null;
  managementStatus?: "management" | "own" | "off_ride";
  // Vehicle Information fields from car table
  interiorColor?: string | null;
  vehicleTrim?: string | null;
  vehicleRecall?: string | null;
  numberOfSeats?: string | null;
  numberOfDoors?: string | null;
  skiRacks?: string | null;
  skiCrossBars?: string | null;
  roofRails?: string | null;
  freeDealershipOilChanges?: string | null;
  oilPackageDetails?: string | null;
  dealershipAddress?: string | null;
  vehicleFeatures?: string | string[] | null;
  tireSize?: string | null;
  oilType?: string | null;
  lastOilChange?: string | null;
  fuelType?: string | null;
  registrationExpiration?: string | null;
  titleType?: string | null;
}

const carSchema = z.object({
  // Vehicle Information
  vin: z
    .string()
    .length(17, "VIN must be exactly 17 characters"),
  makeModel: z.string().min(1, "Make & Model is required"),
  licensePlate: z.string().optional(),
  year: z.string().optional(),
  color: z.string().optional(),
  mileage: z.string().optional(),
  // Extended Vehicle Information
  vehicleTrim: z.string().optional(),
  interiorColor: z.string().optional(),
  registrationExpiration: z.string().optional(),
  vehicleRecall: z.string().optional(),
  numberOfSeats: z.string().optional(),
  numberOfDoors: z.string().optional(),
  skiRacks: z.string().optional(),
  skiCrossBars: z.string().optional(),
  roofRails: z.string().optional(),
  oilType: z.string().optional(),
  lastOilChange: z.string().optional(),
  freeDealershipOilChanges: z.string().optional(),
  oilPackageDetails: z.string().optional(),
  dealershipAddress: z.string().optional(),
  fuelType: z.string().optional(),
  tireSize: z.string().optional(),
  titleType: z.string().optional(),
  vehicleFeatures: z.union([z.string(), z.array(z.string())]).optional(), // JSON string array, comma-separated, or array
  // Financial Information
  purchasePrice: z.string().optional(),
  downPayment: z.string().optional(),
  monthlyPayment: z.string().optional(),
  interestRate: z.string().optional(),
  transportCityToCity: z.string().optional(),
  ultimateGoal: z.string().optional(),
  // Insurance Information
  insuranceProvider: z.string().optional(),
  insurancePhone: z.string().optional(),
  policyNumber: z.string().optional(),
  insuranceExpiration: z.string().optional(),
  // Additional Information
  carManufacturerWebsite: z.string().optional(),
  carManufacturerUsername: z.string().optional(),
  password: z.string().optional(),
  // Car Links
  turoLink: z.string().optional(),
  adminTuroLink: z.string().optional(),
  turoVehicleIds: z.array(z.string()).max(10).optional(),
  // Car Status (admin-only)
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  // Management Status (admin-only)
  managementStatus: z.enum(["management", "own", "off_ride"]).optional(),
  // Offboarding Information
  offboardAt: z.string().optional(),
  offboardReason: z.enum(["sold", "damaged", "end_lease", "other"]).optional(),
  offboardNote: z.string().optional(),
  // Documents
  insuranceCardUrl: z.string().optional(),
  driversLicenseUrls: z.string().optional(), // JSON string array
});

type CarFormData = z.infer<typeof carSchema>;

export default function CarDetailPage() {
  const [, params] = useRoute("/admin/cars/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const carId = params?.id ? parseInt(params.id, 10) : null;
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<number>>(new Set());
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);
  const [fullScreenImageIndex, setFullScreenImageIndex] = useState<number | null>(null);
  const [fullScreenDocument, setFullScreenDocument] = useState<{ url: string; type: 'insurance' | 'license'; index?: number; isPdf?: boolean } | null>(null);
  // Document editing state
  const [insuranceCardFile, setInsuranceCardFile] = useState<File | null>(null);
  const [insuranceCardPreview, setInsuranceCardPreview] = useState<string | null>(null);
  const [driversLicenseFiles, setDriversLicenseFiles] = useState<File[]>([]);
  const [driversLicensePreviews, setDriversLicensePreviews] = useState<string[]>([]);

  // Helper function to check if a URL is a PDF
  const isPdfDocument = (url: string): boolean => {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    return lowerUrl.endsWith('.pdf') || lowerUrl.includes('.pdf?') || lowerUrl.includes('application/pdf');
  };

  // Get current user to check if admin
  const { data: userData } = useQuery<{
    user?: {
      isAdmin?: boolean;
    };
  }>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });
  const isAdmin = userData?.user?.isAdmin === true;

  const { data, isLoading, error } = useQuery<{
    success: boolean;
    data: CarDetail;
  }>({
    queryKey: ["/api/cars", carId],
    queryFn: async () => {
      if (!carId) throw new Error("Invalid car ID");
      const url = buildApiUrl(`/api/cars/${carId}`);
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch car");
      return response.json();
    },
    enabled: !!carId,
    retry: false,
    // Only fetch on initial load - disable all automatic refetching
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnMount: false, // Don't refetch on mount if data already exists
    refetchOnReconnect: false, // Don't refetch on reconnect
    staleTime: Infinity, // Data never becomes stale, preventing automatic refetches
    gcTime: Infinity, // Keep data in cache indefinitely
    // Keep previous data while refetching to avoid flickering
    placeholderData: (previousData) => previousData,
  });

  const car = data?.data;
  
  // Debug logging for photos
  useEffect(() => {
    if (car?.photos) {
      console.log(`📸 [CAR DETAIL] Car photos loaded:`, {
        count: car.photos.length,
        photos: car.photos.map((p: string, i: number) => ({
          index: i,
          url: p?.substring(0, 100) || 'empty',
          isGcs: p?.startsWith('https://storage.googleapis.com/') || false
        }))
      });
    } else {
      console.log(`📸 [CAR DETAIL] No photos found for car ${carId}`);
    }
  }, [car?.photos, carId]);

  // Fetch onboarding data for financial, insurance, and additional information
  // Use VIN from vehicle information card to fetch the correct onboarding record
  const { data: onboardingData, isLoading: isLoadingOnboarding } = useQuery<{
    success: boolean;
    data: any;
  }>({
    queryKey: ["/api/onboarding/vin", car?.vin, "onboarding"],
    queryFn: async () => {
      if (!car?.vin) throw new Error("No VIN");
      // Use VIN to fetch onboarding data
      const url = buildApiUrl(`/api/onboarding/vin/${encodeURIComponent(car.vin)}`);
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // Return null if no onboarding found (404) instead of throwing
        if (response.status === 404) {
          return { success: false, data: null };
        }
        throw new Error(errorData.error || `Failed to fetch onboarding: ${response.statusText}`);
      }
      const result = await response.json();
      return result;
    },
    enabled: !!car?.vin,
    retry: false,
  });

  const onboarding = onboardingData?.success ? onboardingData?.data : null;

  // Fetch the corresponding client so Last Login (and online status) match the Client profile page (same API, same polling).
  const { data: clientData } = useQuery<{ success: boolean; data?: { lastLoginAt?: string | null; lastLogoutAt?: string | null } }>({
    queryKey: ["/api/clients", car?.clientId],
    queryFn: async () => {
      if (!car?.clientId) throw new Error("No client ID");
      const url = buildApiUrl(`/api/clients/${car.clientId}`);
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch client");
      return response.json();
    },
    enabled: !!car?.clientId,
    retry: false,
    refetchInterval: 2000,
    refetchOnWindowFocus: true,
  });
  const ownerLastLoginAt = clientData?.data?.lastLoginAt ?? car?.owner?.lastLoginAt ?? null;
  const ownerLastLogoutAt = clientData?.data?.lastLogoutAt ?? car?.owner?.lastLogoutAt ?? null;

  // Debug logging for documents (only in development)
  useEffect(() => {
    if (import.meta.env.DEV && onboarding) {
      console.log('[Car Detail] Onboarding data:', {
        hasInsuranceCardUrl: !!onboarding.insuranceCardUrl,
        insuranceCardUrl: onboarding.insuranceCardUrl,
        insuranceCardUrlType: typeof onboarding.insuranceCardUrl,
        insuranceCardUrlLength: onboarding.insuranceCardUrl?.length,
        hasDriversLicenseUrls: !!onboarding.driversLicenseUrls,
        driversLicenseUrls: onboarding.driversLicenseUrls,
        driversLicenseUrlsType: typeof onboarding.driversLicenseUrls,
        isArray: Array.isArray(onboarding.driversLicenseUrls),
      });
      
      // Check if insuranceCardUrl looks like a Google Drive ID
      if (onboarding.insuranceCardUrl) {
        const trimmed = String(onboarding.insuranceCardUrl).trim();
        const looksLikeGoogleDriveId = trimmed && 
          !trimmed.includes('/') && 
          !trimmed.includes('.') && 
          trimmed.length >= 10 && 
          /^[a-zA-Z0-9_-]+$/.test(trimmed) &&
          !trimmed.startsWith('http');
        console.log('[Car Detail] Insurance Card ID Analysis:', {
          trimmed,
          looksLikeGoogleDriveId,
          hasSlash: trimmed.includes('/'),
          hasDot: trimmed.includes('.'),
          startsWithHttp: trimmed.startsWith('http'),
          length: trimmed.length,
          matchesPattern: /^[a-zA-Z0-9_-]+$/.test(trimmed),
        });
      }
    }
  }, [onboarding]);

  // Memoize filtered drivers license URLs to avoid repeated filtering
  const validDriversLicenseUrls = useMemo(() => {
    if (!onboarding?.driversLicenseUrls) {
      return [];
    }
    
    // Handle both array and string (JSON) formats
    let urlsArray: any[] = [];
    if (Array.isArray(onboarding.driversLicenseUrls)) {
      urlsArray = onboarding.driversLicenseUrls;
    } else if (typeof onboarding.driversLicenseUrls === 'string') {
      try {
        const parsed = JSON.parse(onboarding.driversLicenseUrls);
        urlsArray = Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.error('[Car Detail] Failed to parse driversLicenseUrls as JSON:', e);
        urlsArray = [];
      }
    }
    
    return urlsArray
      .filter((url: any) => url && typeof url === 'string' && url.trim())
      .map((url: string) => url.trim());
  }, [onboarding?.driversLicenseUrls]);

  // Calculate online status badge (use client API lastLoginAt/lastLogoutAt so it matches Client profile page)
  const onlineStatusBadge = useMemo(() => {
    if (!car?.owner) {
      return null;
    }
    
    // Online Status is based ONLY on login/logout activity, NOT on account status
    // Use ownerLastLoginAt/ownerLastLogoutAt (from client API when car.clientId exists) so value matches Client profile
    const onlineStatus = getOnlineStatusBadge(
      ownerLastLoginAt,
      ownerLastLogoutAt
    );
    
    // Debug logging (only in development)
    if (import.meta.env.DEV) {
      const now = new Date();
      
      console.log('[Car Detail] Online Status Calculation:', {
        ownerName: `${car.owner.firstName} ${car.owner.lastName}`,
        email: car.owner.email,
        lastLoginAt: ownerLastLoginAt,
        lastLogoutAt: ownerLastLogoutAt,
        result: onlineStatus.text,
        isOnline: onlineStatus.isOnline,
        timestamp: now.toISOString(),
      });
      
      if (!ownerLastLoginAt && car.owner.email) {
        console.warn(`⚠️ [Car Detail] Owner ${car.owner.email} has no lastLoginAt value. This could indicate:`);
        console.warn('   1. Database columns (lastLoginAt/lastLogoutAt) don\'t exist in user table');
        console.warn('   2. User has never logged in through /api/auth/login endpoint');
        console.warn('   3. Login endpoint failed to update lastLoginAt');
        console.warn('   Check backend logs for migration warnings or login update errors.');
      }
    }
    
    return onlineStatus;
  }, [car?.owner, ownerLastLoginAt, ownerLastLogoutAt]);

  // Helper functions
  const formatValue = (value: any): string => {
    if (value === null || value === undefined || value === "") {
      return "Not provided";
    }
    return String(value);
  };

  const formatCurrency = (value: string | null | undefined): string => {
    if (!value) return "Not provided";
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    return `$${num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Reset carousel index when car changes or photos change
  useEffect(() => {
    if (car?.photos && car.photos.length > 0) {
      // Ensure carousel index is within bounds
      if (carouselIndex >= car.photos.length) {
        // If current index is out of bounds, go to last available photo
        setCarouselIndex(Math.max(0, car.photos.length - 1));
      }
      // If carousel index is 0 but there are photos, ensure it's valid
      if (carouselIndex < 0) {
        setCarouselIndex(0);
      }
    } else {
      // No photos available, reset to 0
      setCarouselIndex(0);
    }
  }, [car?.photos?.length, carouselIndex]);

  // Note: We no longer automatically deselect photos when carousel changes
  // Carousel navigation does not affect Photos card selection

  // Keyboard navigation for full screen document viewer
  useEffect(() => {
    if (fullScreenDocument === null || !onboarding) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (fullScreenDocument.type === 'license' && 
          validDriversLicenseUrls.length > 1 && 
          fullScreenDocument.index !== undefined) {
        if (e.key === 'ArrowLeft' && fullScreenDocument.index > 0) {
          const prevIndex = fullScreenDocument.index - 1;
          const prevUrl = validDriversLicenseUrls[prevIndex];
          // Check if it's a Google Drive file ID
          const isGoogleDriveId = prevUrl && 
            !prevUrl.includes('/') && 
            !prevUrl.includes('.') && 
            prevUrl.length >= 10 && 
            /^[a-zA-Z0-9_-]+$/.test(prevUrl) &&
            !prevUrl.startsWith('http');
          const imageUrl = isGoogleDriveId
            ? buildApiUrl(`/api/cars/documents/file-content?fileId=${encodeURIComponent(prevUrl)}`)
            : prevUrl.startsWith('http') ? prevUrl : buildApiUrl(prevUrl.startsWith('/') ? prevUrl : `/${prevUrl}`);
          setFullScreenDocument({ 
            url: imageUrl, 
            type: 'license', 
            index: prevIndex,
            isPdf: isGoogleDriveId
              ? (prevUrl.toLowerCase().includes('pdf') || prevUrl.toLowerCase().endsWith('.pdf'))
              : isPdfDocument(prevUrl)
          });
        } else if (e.key === 'ArrowRight' && fullScreenDocument.index < validDriversLicenseUrls.length - 1) {
          const nextIndex = fullScreenDocument.index + 1;
          const nextUrl = validDriversLicenseUrls[nextIndex];
          // Check if it's a Google Drive file ID
          const isGoogleDriveId = nextUrl && 
            !nextUrl.includes('/') && 
            !nextUrl.includes('.') && 
            nextUrl.length >= 10 && 
            /^[a-zA-Z0-9_-]+$/.test(nextUrl) &&
            !nextUrl.startsWith('http');
          const imageUrl = isGoogleDriveId
            ? buildApiUrl(`/api/cars/documents/file-content?fileId=${encodeURIComponent(nextUrl)}`)
            : nextUrl.startsWith('http') ? nextUrl : buildApiUrl(nextUrl.startsWith('/') ? nextUrl : `/${nextUrl}`);
          setFullScreenDocument({ 
            url: imageUrl, 
            type: 'license', 
            index: nextIndex,
            isPdf: isGoogleDriveId
              ? (nextUrl.toLowerCase().includes('pdf') || nextUrl.toLowerCase().endsWith('.pdf'))
              : isPdfDocument(nextUrl)
          });
        }
      }
      
      if (e.key === 'Escape') {
        setFullScreenDocument(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullScreenDocument, validDriversLicenseUrls]);

  // Keyboard navigation for full screen image viewer
  useEffect(() => {
    if (fullScreenImageIndex === null || !car?.photos) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFullScreenImageIndex(null);
      } else if (e.key === "ArrowLeft" && car.photos && car.photos.length > 1) {
        const prevIndex = (fullScreenImageIndex - 1 + car.photos.length) % car.photos.length;
        setFullScreenImageIndex(prevIndex);
      } else if (e.key === "ArrowRight" && car.photos && car.photos.length > 1) {
        const nextIndex = (fullScreenImageIndex + 1) % car.photos.length;
        setFullScreenImageIndex(nextIndex);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [fullScreenImageIndex, car?.photos]);

  // Auto-advance carousel every 3 seconds
  useEffect(() => {
    if (!car?.photos || car.photos.length <= 1 || isCarouselPaused) return;

    const interval = setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % car.photos!.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [car?.photos, carouselIndex, isCarouselPaused]);

  const form = useForm<CarFormData>({
    resolver: zodResolver(carSchema),
    defaultValues: {
      vin: "",
      makeModel: "",
      licensePlate: "",
      year: "",
      color: "",
      mileage: "",
      vehicleTrim: "",
      interiorColor: "",
      registrationExpiration: "",
      vehicleRecall: "",
      numberOfSeats: "",
      numberOfDoors: "",
      skiRacks: "",
      skiCrossBars: "",
      roofRails: "",
      oilType: "",
      lastOilChange: "",
      freeDealershipOilChanges: "",
      oilPackageDetails: "",
      dealershipAddress: "",
      fuelType: "",
      tireSize: "",
      titleType: "",
      vehicleFeatures: "",
      purchasePrice: "",
      downPayment: "",
      monthlyPayment: "",
      interestRate: "",
      transportCityToCity: "",
      ultimateGoal: "",
      insuranceProvider: "",
      insurancePhone: "",
      policyNumber: "",
      insuranceExpiration: "",
      carManufacturerWebsite: "",
      carManufacturerUsername: "",
      password: "",
      turoLink: "",
      adminTuroLink: "",
      turoVehicleIds: [],
      status: "ACTIVE",
      managementStatus: "own",
      offboardAt: "",
      offboardReason: undefined,
      offboardNote: "",
      insuranceCardUrl: "",
      driversLicenseUrls: "",
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: CarFormData) => {
      const formData = new FormData();
      // Vehicle Information
      formData.append("vin", data.vin);
      formData.append("makeModel", data.makeModel);
      formData.append("licensePlate", data.licensePlate || "");
      formData.append("year", data.year || "");
      formData.append("color", data.color || "");
      formData.append("mileage", data.mileage || "");
      // Extended Vehicle Information - Always send all fields to ensure backend can update them
      formData.append("vehicleTrim", data.vehicleTrim || "");
      formData.append("interiorColor", data.interiorColor || "");
      formData.append("registrationExpiration", data.registrationExpiration || "");
      formData.append("vehicleRecall", data.vehicleRecall || "");
      formData.append("numberOfSeats", data.numberOfSeats || "");
      formData.append("numberOfDoors", data.numberOfDoors || "");
      formData.append("skiRacks", data.skiRacks || "");
      formData.append("skiCrossBars", data.skiCrossBars || "");
      formData.append("roofRails", data.roofRails || "");
      formData.append("oilType", data.oilType || "");
      formData.append("lastOilChange", data.lastOilChange || "");
      formData.append("freeDealershipOilChanges", data.freeDealershipOilChanges || "");
      formData.append("oilPackageDetails", data.oilPackageDetails || "");
      formData.append("dealershipAddress", data.dealershipAddress || "");
      formData.append("fuelType", data.fuelType || "");
      formData.append("tireSize", data.tireSize || "");
      formData.append("titleType", data.titleType || "");
      // Convert vehicleFeatures array to JSON string
      if (data.vehicleFeatures) {
        if (Array.isArray(data.vehicleFeatures)) {
          formData.append("vehicleFeatures", JSON.stringify(data.vehicleFeatures));
        } else if (typeof data.vehicleFeatures === 'string') {
        try {
          // Try to parse as JSON first
          JSON.parse(data.vehicleFeatures);
          formData.append("vehicleFeatures", data.vehicleFeatures);
        } catch {
          // If not JSON, treat as comma-separated and convert to JSON array
          const featuresArray = data.vehicleFeatures.split(',').map(f => f.trim()).filter(f => f);
          formData.append("vehicleFeatures", JSON.stringify(featuresArray));
          }
        } else {
          formData.append("vehicleFeatures", "");
        }
      } else {
        formData.append("vehicleFeatures", "");
      }
      // Financial Information - Always send all fields to ensure backend can update them
      formData.append("purchasePrice", data.purchasePrice || "");
      formData.append("downPayment", data.downPayment || "");
      formData.append("monthlyPayment", data.monthlyPayment || "");
      formData.append("interestRate", data.interestRate || "");
      formData.append("transportCityToCity", data.transportCityToCity || "");
      formData.append("ultimateGoal", data.ultimateGoal || "");
      // Insurance Information - Always send all fields to ensure backend can update them
      formData.append("insuranceProvider", data.insuranceProvider || "");
      formData.append("insurancePhone", data.insurancePhone || "");
      formData.append("policyNumber", data.policyNumber || "");
      formData.append("insuranceExpiration", data.insuranceExpiration || "");
      // Additional Information - Always send all fields to ensure backend can update them
      formData.append("carManufacturerWebsite", data.carManufacturerWebsite || "");
      formData.append("carManufacturerUsername", data.carManufacturerUsername || "");
      formData.append("password", data.password || "");
      // Car Links - Always send all fields to ensure backend can update them
      formData.append("turoLink", data.turoLink || "");
      formData.append("adminTuroLink", data.adminTuroLink || "");
      formData.append("turoVehicleIds", JSON.stringify((data.turoVehicleIds || []).filter((id): id is string => typeof id === "string" && id.trim().length > 0)));
      // Car Status (admin-only) - Always send if admin and value is provided
      if (isAdmin && data.status) {
        formData.append("status", data.status);
      }
      // Management Status (admin-only) - Only send if admin and value is provided
      if (isAdmin && data.managementStatus) {
        formData.append("managementStatus", data.managementStatus);
      }
      // Offboarding Information - Always send all fields
      formData.append("offboardAt", data.offboardAt || "");
      formData.append("offboardReason", data.offboardReason || "");
      formData.append("offboardNote", data.offboardNote || "");
      
      // Documents - Handle file uploads using state
      if (insuranceCardFile instanceof File) {
        formData.append("insuranceCard", insuranceCardFile);
      } else if (data.insuranceCardUrl !== undefined) {
        // Fallback to URL if no file uploaded
        formData.append("insuranceCardUrl", data.insuranceCardUrl || "");
      }
      
      if (driversLicenseFiles && driversLicenseFiles.length > 0) {
        driversLicenseFiles.forEach((file: File) => {
          if (file instanceof File) {
            formData.append("driversLicense", file);
          }
        });
      } else if (data.driversLicenseUrls !== undefined) {
        // Fallback to URLs if no files uploaded
        formData.append("driversLicenseUrls", data.driversLicenseUrls || "");
      }

      const response = await fetch(buildApiUrl(`/api/cars/${carId}`), {
        method: "PATCH",
        credentials: "include",
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update car");
      }
      const result = await response.json();
      return result;
    },
    onSuccess: async (responseData, variables) => {
      // Immediately update the car data in cache to reflect changes
      // This ensures the UI updates instantly without waiting for refetch
      if (responseData?.data) {
        queryClient.setQueryData(["/api/cars", carId], responseData);
      }
      
      // Get the VIN from form data (most reliable), then updated car data, then current car
      // The form data VIN is the source of truth for what was submitted
      const updatedCar = responseData?.data || car;
      const newVin = variables?.vin || updatedCar?.vin || car?.vin;
      const oldVin = car?.vin;
      
      // Refetch car data in the background to ensure we have the latest from server
      // This will update the cache again with any server-side changes
      await queryClient.refetchQueries({ queryKey: ["/api/cars", carId] });
      
      // Invalidate and refetch onboarding data using VIN
      // This ensures Financial, Insurance, Additional Information, and Documents are updated immediately
      // If VIN changed, invalidate both old and new VIN queries
      if (oldVin && oldVin !== newVin) {
        // VIN was changed - invalidate old VIN query
        queryClient.invalidateQueries({ queryKey: ["/api/onboarding/vin", oldVin, "onboarding"] });
      }
      
      if (newVin) {
        // Invalidate the new VIN query (or current VIN if it didn't change)
        queryClient.invalidateQueries({ queryKey: ["/api/onboarding/vin", newVin, "onboarding"] });
        // Also invalidate all onboarding queries that start with this pattern to catch any variations
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            const key = query.queryKey;
            return Array.isArray(key) && 
                   key.length >= 2 && 
                   key[0] === "/api/onboarding/vin" && 
                   (key[1] === newVin || key[1] === oldVin);
          }
        });
        // Refetch the onboarding data with the new VIN - wait for it to complete
        try {
          await queryClient.refetchQueries({ 
            queryKey: ["/api/onboarding/vin", newVin, "onboarding"],
            exact: false // Also refetch partial matches
          });
          console.log(`✅ [CAR DETAIL] Refetched onboarding data for VIN: ${newVin}`);
        } catch (error) {
          console.error(`❌ [CAR DETAIL] Failed to refetch onboarding data:`, error);
        }
      } else {
        // If no VIN, still try to invalidate all onboarding queries for this car
        // This handles cases where documents might be updated but VIN is missing
        console.warn(`⚠️ [CAR DETAIL] No VIN found for car ${carId}, invalidating all onboarding queries`);
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            const key = query.queryKey;
            return Array.isArray(key) && key[0] === "/api/onboarding/vin";
          }
        });
      }
      
      // Also invalidate client-based onboarding queries for backward compatibility
      const finalCar = updatedCar;
      if (finalCar?.clientId) {
        queryClient.invalidateQueries({ queryKey: ["/api/clients", finalCar.clientId, "onboarding"] });
        await queryClient.refetchQueries({ queryKey: ["/api/clients", finalCar.clientId, "onboarding"] });
      } else if (car?.clientId) {
        queryClient.invalidateQueries({ queryKey: ["/api/clients", car.clientId, "onboarding"] });
        await queryClient.refetchQueries({ queryKey: ["/api/clients", car.clientId, "onboarding"] });
      }
      
      // Invalidate other related queries
      queryClient.invalidateQueries({ queryKey: ["/api/cars"] }); // For the cars list page
      queryClient.invalidateQueries({ queryKey: ["sidebar-badges"] });
      
      toast({
        title: "Success",
        description: "Car information updated successfully",
      });
      // Reset document file state after successful update
      setInsuranceCardFile(null);
      setInsuranceCardPreview(null);
      setDriversLicenseFiles([]);
      setDriversLicensePreviews([]);
      setIsEditModalOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update car",
        variant: "destructive",
      });
    },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: async (photoPath: string) => {
      // Send the full photo path/URL to backend for proper matching
      // Backend will handle extraction of filename and matching
      // Use encodeURIComponent to safely encode URLs and paths
      const response = await fetch(
        buildApiUrl(
          `/api/cars/${carId}/photos/${encodeURIComponent(photoPath)}`
        ),
        {
          method: "DELETE",
          credentials: "include",
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete photo");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cars", carId] });
      toast({
        title: "Success",
        description: "Photo deleted successfully",
      });
      // Don't clear all selections here - selection management is handled in the onConfirm callback
      // Adjust carousel index if needed - will be handled by useEffect after data refresh
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete photo",
        variant: "destructive",
      });
    },
  });

  const deleteMultiplePhotosMutation = useMutation({
    mutationFn: async (photoPaths: string[]) => {
      // Delete all selected photos sequentially to avoid race conditions
      // and ensure all deletions are processed correctly
      const results = [];
      const errors: string[] = [];
      
      for (const photoPath of photoPaths) {
        try {
          // Send the full photo path/URL to backend for proper matching
          // Extract a short identifier for error messages
          const shortId = photoPath.split("/").pop()?.split("?")[0] || photoPath.substring(0, 50);
          const response = await fetch(
            buildApiUrl(
              `/api/cars/${carId}/photos/${encodeURIComponent(photoPath)}`
            ),
            {
              method: "DELETE",
              credentials: "include",
            }
          );
          
          if (!response.ok) {
            const error = await response.json();
            errors.push(`${shortId}: ${error.error || "Failed to delete"}`);
          } else {
            const result = await response.json();
            results.push(result);
          }
        } catch (error: any) {
          const shortId = photoPath.split("/").pop()?.split("?")[0] || photoPath.substring(0, 50);
          errors.push(`${shortId}: ${error.message || "Failed to delete"}`);
        }
      }
      
      // If any deletions failed, throw error with details
      if (errors.length > 0) {
        throw new Error(`Failed to delete some photos:\n${errors.join("\n")}`);
      }
      
      return { success: true, deletedCount: results.length };
    },
    onSuccess: (_, variables) => {
      // Invalidate queries to refresh car data
      queryClient.invalidateQueries({ queryKey: ["/api/cars", carId] });
      
      const deletedCount = variables.length;
      toast({
        title: "Success",
        description: `${deletedCount} photo(s) deleted successfully`,
      });
      
      // Clear all selections
      setSelectedPhotos(new Set());
      
      // Reset carousel index - will be adjusted by useEffect when car data refreshes
      // Set to 0 initially, useEffect will handle bounds checking
      setCarouselIndex(0);
      setIsCarouselPaused(false);
      
      // Close full screen viewer if open
      setFullScreenImageIndex(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete photos",
        variant: "destructive",
      });
    },
  });

  /**
   * Set the selected photo as the "main" photo.
   * Backend models main photo as the first photo in the stored list, so the Cars page
   * thumbnail and the carousel will both reflect the new main photo.
   */
  const setMainPhotoMutation = useMutation({
    mutationFn: async (photoPath: string) => {
      const response = await fetch(buildApiUrl(`/api/cars/${carId}/photos/main`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ photoPath }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || error.message || "Failed to set main photo");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cars", carId] });
      queryClient.invalidateQueries({ queryKey: ["/api/cars"] }); // refresh Cars list thumbnails
      toast({
        title: "Success",
        description: "Main photo updated successfully",
      });
      // Reset carousel to the first image (new main)
      setCarouselIndex(0);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to set main photo",
        variant: "destructive",
      });
    },
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Check photo count limit
    const currentPhotoCount = car?.photos?.length || 0;
    if (currentPhotoCount + files.length > 20) {
      toast({
        title: "Error",
        description: `Maximum 20 photos allowed. Current: ${currentPhotoCount}, Trying to add: ${files.length}`,
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }

    setUploadingPhotos(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append("photos", file);
      });

      const response = await fetch(buildApiUrl(`/api/cars/${carId}/photos`), {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload photos");
      }

      const result = await response.json();
      
      console.log('📸 [CAR DETAIL] Photo upload response:', {
        success: result.success,
        message: result.message,
        hasData: !!result.data,
        photoCount: result.data?.photos?.length || 0,
        photos: result.data?.photos || []
      });
      
      // Update the query cache with the new car data immediately
      if (result.data) {
        queryClient.setQueryData(["/api/cars", carId], {
          success: true,
          data: result.data,
        });
        console.log('✅ [CAR DETAIL] Updated query cache with new car data:', {
          photoCount: result.data.photos?.length || 0,
          photos: result.data.photos || []
        });
      }
      
      // Also invalidate and refetch to ensure fresh data
      await queryClient.invalidateQueries({ queryKey: ["/api/cars", carId] });
      
      // Force a refetch to ensure photos are loaded
      await queryClient.refetchQueries({ queryKey: ["/api/cars", carId] });
      
      // Reset carousel to first image if no images were present before
      const hadNoPhotos = !car?.photos || car.photos.length === 0;
      if (hadNoPhotos && result.data?.photos && result.data.photos.length > 0) {
        setCarouselIndex(0);
        console.log('🔄 [CAR DETAIL] Reset carousel to first image');
      }
      
      toast({
        title: "Success",
        description: result.message || "Photos uploaded successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload photos",
        variant: "destructive",
      });
    } finally {
      setUploadingPhotos(false);
      e.target.value = "";
    }
  };

  const handleEditClick = () => {
    if (!car) return;
    
    // Format vehicleFeatures for form (parse to array for checkboxes)
    let vehicleFeaturesValue: string[] = [];
    if (onboarding?.vehicleFeatures) {
      if (Array.isArray(onboarding.vehicleFeatures)) {
        vehicleFeaturesValue = onboarding.vehicleFeatures;
      } else if (typeof onboarding.vehicleFeatures === 'string') {
        try {
          // Try to parse as JSON array
          const parsed = JSON.parse(onboarding.vehicleFeatures);
          if (Array.isArray(parsed)) {
            vehicleFeaturesValue = parsed;
          } else {
            // If it's a comma-separated string, split it
            vehicleFeaturesValue = onboarding.vehicleFeatures.split(',').map((f: string) => f.trim()).filter((f: string) => f);
          }
        } catch {
          // If not JSON, treat as comma-separated string
          vehicleFeaturesValue = onboarding.vehicleFeatures.split(',').map((f: string) => f.trim()).filter((f: string) => f);
        }
      }
    }
    
    // Helper function to format date for date input fields (YYYY-MM-DD)
    const formatDateForInput = (dateValue: any): string => {
      if (!dateValue) return "";
      try {
        // Handle various date formats
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) return "";
        return date.toISOString().split('T')[0];
      } catch {
        // If it's already in YYYY-MM-DD format, return as is
        if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
          return dateValue;
        }
        return "";
      }
    };

    // Helper function to safely convert number to string
    const numToString = (value: any): string => {
      if (value === null || value === undefined) return "";
      if (typeof value === 'number') return value.toString();
      if (typeof value === 'string') return value;
      return String(value || "");
    };

    form.reset({
      vin: car.vin || "",
      makeModel: car.makeModel || "",
      licensePlate: car.licensePlate || "",
      year: numToString(car.year),
      color: car.color || "",
      // Mileage: Check both onboarding.vehicleMiles and car.mileage (onboarding takes precedence)
      mileage: numToString(onboarding?.vehicleMiles || car.mileage),
      // Extended Vehicle Information
      vehicleTrim: onboarding?.vehicleTrim || "",
      interiorColor: onboarding?.interiorColor || car.interiorColor || "",
      registrationExpiration: formatDateForInput(onboarding?.registrationExpiration),
      vehicleRecall: onboarding?.vehicleRecall || "",
      numberOfSeats: numToString(onboarding?.numberOfSeats),
      numberOfDoors: numToString(onboarding?.numberOfDoors),
      skiRacks: onboarding?.skiRacks || "",
      skiCrossBars: onboarding?.skiCrossBars || "",
      roofRails: onboarding?.roofRails || "",
      oilType: onboarding?.oilType || car.oilType || "",
      lastOilChange: onboarding?.lastOilChange || car.lastOilChange || "",
      freeDealershipOilChanges: onboarding?.freeDealershipOilChanges || "",
      oilPackageDetails: (onboarding as any)?.oilPackageDetails || "",
      dealershipAddress: (onboarding as any)?.dealershipAddress || "",
      fuelType: onboarding?.fuelType || car.fuelType || "",
      tireSize: onboarding?.tireSize || car.tireSize || "",
      titleType: onboarding?.titleType || "",
      vehicleFeatures: vehicleFeaturesValue,
      // Financial Information
      purchasePrice: onboarding?.purchasePrice ? numToString(onboarding.purchasePrice) : "",
      downPayment: onboarding?.downPayment ? numToString(onboarding.downPayment) : "",
      monthlyPayment: onboarding?.monthlyPayment ? numToString(onboarding.monthlyPayment) : "",
      interestRate: onboarding?.interestRate ? numToString(onboarding.interestRate) : "",
      transportCityToCity: onboarding?.transportCityToCity || "",
      ultimateGoal: onboarding?.ultimateGoal || "",
      // Insurance Information
      insuranceProvider: onboarding?.insuranceProvider || "",
      insurancePhone: onboarding?.insurancePhone || "",
      policyNumber: onboarding?.policyNumber || "",
      insuranceExpiration: formatDateForInput(onboarding?.insuranceExpiration),
      // Additional Information (Car Login)
      carManufacturerWebsite: onboarding?.carManufacturerWebsite || "",
      carManufacturerUsername: onboarding?.carManufacturerUsername || "",
      password: onboarding?.password || "",
      // Car Links
      turoLink: car.turoLink || "",
      adminTuroLink: car.adminTuroLink || "",
      turoVehicleIds: (() => {
        const dbIds = (car.turoVehicleIds || []).filter((id): id is string => typeof id === "string" && id.trim().length > 0);
        if (dbIds.length > 0) return [...dbIds];
        const fromLink = extractTuroVehicleIdFromUrl(car.turoLink);
        const fromAdmin = extractTuroVehicleIdFromUrl(car.adminTuroLink);
        const extracted = [...new Set([fromLink, fromAdmin].filter((id): id is string => Boolean(id)))];
        return extracted.length > 0 ? extracted : [];
      })(),
      // Car Status
      status: (car.status || "ACTIVE") as "ACTIVE" | "INACTIVE",
      // Management Status
      managementStatus: (car.managementStatus || "own") as "management" | "own" | "off_ride",
      // Offboarding Information
      offboardAt: formatDateForInput(car.offboardAt),
      offboardReason: (car.offboardReason || undefined) as "sold" | "damaged" | "end_lease" | "other" | undefined,
      offboardNote: car.offboardNote || "",
      // Documents
      insuranceCardUrl: onboarding?.insuranceCardUrl || "",
      driversLicenseUrls: onboarding?.driversLicenseUrls ? (Array.isArray(onboarding.driversLicenseUrls) ? JSON.stringify(onboarding.driversLicenseUrls) : onboarding.driversLicenseUrls) : "",
    });
    // Reset document file state when opening edit dialog
    setInsuranceCardFile(null);
    setInsuranceCardPreview(null);
    setDriversLicenseFiles([]);
    setDriversLicensePreviews([]);
    setIsEditModalOpen(true);
  };

  // Handle insurance card file selection
  const handleInsuranceCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setInsuranceCardFile(file);
      // Generate preview
      if (file.type === 'application/pdf') {
        setInsuranceCardPreview(null); // PDF preview handled separately
      } else {
        const reader = new FileReader();
        reader.onloadend = () => {
          setInsuranceCardPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Handle drivers license files selection
  const handleDriversLicenseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      setDriversLicenseFiles(fileArray);
      // Generate previews
      const previews: string[] = [];
      let loadedCount = 0;
      fileArray.forEach((file, index) => {
        if (file.type === 'application/pdf') {
          previews[index] = 'pdf'; // Mark as PDF
          loadedCount++;
          if (loadedCount === fileArray.length) {
            setDriversLicensePreviews(previews);
          }
        } else {
          const reader = new FileReader();
          reader.onloadend = () => {
            previews[index] = reader.result as string;
            loadedCount++;
            if (loadedCount === fileArray.length) {
              setDriversLicensePreviews(previews);
            }
          };
          reader.readAsDataURL(file);
        }
      });
    }
  };

  // Remove insurance card file
  const handleRemoveInsuranceCard = () => {
    setInsuranceCardFile(null);
    setInsuranceCardPreview(null);
    // Reset file input
    const input = document.getElementById('insurance-card-input') as HTMLInputElement;
    if (input) input.value = '';
  };

  // Remove drivers license file
  const handleRemoveDriversLicense = (index: number) => {
    const newFiles = driversLicenseFiles.filter((_, i) => i !== index);
    const newPreviews = driversLicensePreviews.filter((_, i) => i !== index);
    setDriversLicenseFiles(newFiles);
    setDriversLicensePreviews(newPreviews);
    // Reset file input if all files removed
    if (newFiles.length === 0) {
      const input = document.getElementById('drivers-license-input') as HTMLInputElement;
      if (input) input.value = '';
    }
  };

  const onSubmit = (data: CarFormData) => {
    updateMutation.mutate(data);
  };

  // Photo selection and deletion handlers
  const handleSelectPhoto = (index: number) => {
    if (!isAdmin) return;
    
    // Allow selecting any photo, including the carousel photo
    // The carousel photo will only be automatically deselected when "Select All" is clicked
    const newSelected = new Set(selectedPhotos);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedPhotos(newSelected);
  };

  const handleSelectAll = () => {
    if (!isAdmin || !car?.photos) return;
    
    // Check if all photos are already selected
    const allIndices = car.photos.map((_, index) => index);
    const allSelected = allIndices.length > 0 && allIndices.every(index => selectedPhotos.has(index));
    
    if (allSelected && selectedPhotos.size === allIndices.length) {
      // Deselect all
      setSelectedPhotos(new Set());
    } else {
      // Select all photos including the one currently displayed in the carousel
      setSelectedPhotos(new Set(allIndices));
    }
  };

  const handleDeleteSelected = () => {
    if (!isAdmin || !car?.photos || selectedPhotos.size === 0) return;
    
    // Get photo paths from selected indices
    const selectedIndices = Array.from(selectedPhotos);
    const photoPaths = selectedIndices.map(index => car.photos![index]).filter(Boolean);
    
    if (photoPaths.length === 0) {
      toast({
        title: "Error",
        description: "No valid photos selected",
        variant: "destructive",
      });
      return;
    }
    
    // Delete all selected photos (even if currently displayed in carousel)
    deleteMultiplePhotosMutation.mutate(photoPaths);
  };

  // Carousel navigation handlers
  // Note: Carousel navigation does not affect Photos card selection
  const handleCarouselNext = () => {
    if (!car?.photos || car.photos.length === 0) return;
    setIsCarouselPaused(true);
    const nextIndex = (carouselIndex + 1) % car.photos!.length;
    setCarouselIndex(nextIndex);
    // Resume auto-advance after 5 seconds
    setTimeout(() => setIsCarouselPaused(false), 5000);
  };

  const handleCarouselPrev = () => {
    if (!car?.photos || car.photos.length === 0) return;
    setIsCarouselPaused(true);
    const prevIndex = (carouselIndex - 1 + car.photos!.length) % car.photos!.length;
    setCarouselIndex(prevIndex);
    // Resume auto-advance after 5 seconds
    setTimeout(() => setIsCarouselPaused(false), 5000);
  };

  const handleCarouselGoTo = (index: number) => {
    if (!car?.photos || car.photos.length === 0) return;
    setIsCarouselPaused(true);
    setCarouselIndex(index);
    // Resume auto-advance after 5 seconds
    setTimeout(() => setIsCarouselPaused(false), 5000);
  };

  // Keyboard navigation for carousel
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!car?.photos || car.photos.length === 0) return;
      if (e.key === "ArrowLeft") {
        setCarouselIndex((prev) => (prev - 1 + car.photos!.length) % car.photos!.length);
      } else if (e.key === "ArrowRight") {
        setCarouselIndex((prev) => (prev + 1) % car.photos!.length);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [car?.photos]);

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-500/20 text-green-700 border-green-500/30 font-medium";
      case "INACTIVE":
        return "bg-gray-500/20 text-gray-700 border-gray-500/30 font-medium";
      // Legacy support for database values (if any still exist)
      case "available":
      case "in_use":
        return "bg-green-500/20 text-green-700 border-green-500/30 font-medium";
      case "maintenance":
        return "bg-yellow-500/20 text-yellow-700 border-yellow-500/30 font-medium";
      case "off_fleet":
        return "bg-gray-500/20 text-gray-700 border-gray-500/30 font-medium";
      default:
        return "bg-gray-500/20 text-gray-700 border-gray-500/30 font-medium";
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "N/A";
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <CarDetailSkeleton />
      </AdminLayout>
    );
  }

  if (error || !car) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <p className="text-red-700 mb-4">Failed to load car details</p>
          <Button
            onClick={() => {
              if (carId) {
                setLocation(`/admin/view-car/${carId}`);
              } else {
                setLocation("/cars");
              }
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/80"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="w-full min-w-0 space-y-4 sm:space-y-6 overflow-x-hidden max-w-full">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
            <Button
              variant="ghost"
              onClick={() => setLocation(`/admin/view-car/${carId}`)}
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <ArrowLeft className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Back</span>
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-primary truncate">
                {car.makeModel}
              </h1>
              <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">Car Details</p>
            </div>
          </div>
          {isAdmin && (
            <Button
              onClick={handleEditClick}
              className="bg-primary text-primary-foreground hover:bg-primary/80 w-full sm:w-auto shrink-0"
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          )}
        </div>

        {/* Row 1: Vehicle Information, Car Photos, and Car Links */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch w-full min-w-0 max-w-full">
          {/* Vehicle Information Card */}
          <Card className="bg-card border-border lg:col-span-6 flex flex-col min-w-0 w-full max-w-full overflow-hidden">
            <CardHeader className="pb-2 min-w-0">
              <CardTitle className="text-primary text-base sm:text-lg flex items-center gap-2 min-w-0">
                <Car className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span className="min-w-0 truncate">Vehicle Information</span>
              </CardTitle>
            </CardHeader>
              <CardContent className="space-y-4 min-w-0 overflow-hidden">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 min-w-0">
                {/* Column 1: Basic Vehicle Information */}
                <div className="space-y-4 min-w-0">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">Make & Model</p>
                    <p className="text-foreground text-base font-medium break-words min-w-0">{car.makeModel}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">Year</p>
                    <p className="text-foreground text-base break-words min-w-0">{car.year || "N/A"}</p>
                  </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">VIN</p>
                    <p className="text-foreground text-base font-mono break-all min-w-0">{car.vin}</p>
                </div>
                <div className="min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">License Plate</p>
                    <p className="text-foreground text-base break-words min-w-0">{car.licensePlate || "N/A"}</p>
                </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">Title Type</p>
                    <p className="text-foreground text-base break-words min-w-0">{onboarding?.titleType ? formatValue(onboarding.titleType) : "N/A"}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">Trim</p>
                    <p className="text-foreground text-base break-words min-w-0">{car.vehicleTrim ? formatValue(car.vehicleTrim) : "N/A"}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">Mileage</p>
                    <p className="text-foreground text-base break-words min-w-0">{car.mileage ? `${car.mileage.toLocaleString()} miles` : "N/A"}</p>
                  </div>
                </div>

                {/* Column 2: Specifications & Colors */}
                <div className="space-y-4 min-w-0">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">Exterior Color</p>
                    <p className="text-foreground text-base break-words min-w-0">{car.color ? formatValue(car.color) : "N/A"}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">Interior Color</p>
                    <p className="text-foreground text-base break-words min-w-0">{car.interiorColor ? formatValue(car.interiorColor) : "N/A"}</p>
                  </div>
                <div className="min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">Fuel Type</p>
                    <p className="text-foreground text-base break-words min-w-0">{car.fuelType ? formatValue(car.fuelType) : "N/A"}</p>
                </div>
                <div className="min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">Tire Size</p>
                    <p className="text-foreground text-base break-words min-w-0">{car.tireSize ? formatValue(car.tireSize) : "N/A"}</p>
                </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">Number of Doors</p>
                    <p className="text-foreground text-base break-words min-w-0">{car.numberOfDoors ? formatValue(car.numberOfDoors) : "N/A"}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">Number of Seats</p>
                    <p className="text-foreground text-base break-words min-w-0">{car.numberOfSeats ? formatValue(car.numberOfSeats) : "N/A"}</p>
                  </div>
                  </div>

                {/* Column 3: Maintenance & Accessories */}
                <div className="space-y-4 min-w-0">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">Oil Type</p>
                    <p className="text-foreground text-base break-words min-w-0">{car.oilType ? formatValue(car.oilType) : "N/A"}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">Last Oil Change</p>
                    <p className="text-foreground text-base break-words min-w-0">{car.lastOilChange ? formatValue(car.lastOilChange) : "N/A"}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">Does Your Vehicle Have Free Dealership Oil Changes?</p>
                    <p className="text-foreground text-base break-words min-w-0">{car.freeDealershipOilChanges ? formatValue(car.freeDealershipOilChanges) : "N/A"}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">If Yes, For How Many Years of Oil Changes, or What Oil Package</p>
                    <p className="text-foreground text-base break-words min-w-0">
                      {car.oilPackageDetails ? formatValue(car.oilPackageDetails) : "N/A"}
                    </p>
                  </div>
                  {car.dealershipAddress && (
                <div className="min-w-0">
                      <p className="text-xs text-muted-foreground mb-1">Dealership Address</p>
                      <p className="text-foreground text-base break-words min-w-0">{formatValue(car.dealershipAddress)}</p>
                </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">Registration Expiration</p>
                    <p className="text-foreground text-base break-words min-w-0">{car.registrationExpiration ? formatValue(car.registrationExpiration) : "N/A"}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">Vehicle Recall</p>
                    <p className="text-foreground text-base break-words min-w-0">{car.vehicleRecall ? formatValue(car.vehicleRecall) : "N/A"}</p>
                  </div>
                </div>
              </div>
              
              {/* Accessories Section - Full width */}
              <div className="pt-4 border-t border-border min-w-0">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 min-w-0">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">Roof Rails</p>
                    <p className="text-foreground text-base break-words min-w-0">{car.roofRails ? formatValue(car.roofRails) : "N/A"}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">Ski Crossbars</p>
                    <p className="text-foreground text-base break-words min-w-0">{car.skiCrossBars ? formatValue(car.skiCrossBars) : "N/A"}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">Ski Rack</p>
                    <p className="text-foreground text-base break-words min-w-0">{car.skiRacks ? formatValue(car.skiRacks) : "N/A"}</p>
                  </div>
              </div>
              </div>
              
              {/* Features - Full width */}
              <div className="pt-4 border-t border-border min-w-0">
                <p className="text-xs text-muted-foreground mb-1">Features</p>
                <p className="text-foreground text-base break-words min-w-0">
                  {car.vehicleFeatures && Array.isArray(car.vehicleFeatures) && car.vehicleFeatures.length > 0
                    ? car.vehicleFeatures.join(", ")
                    : (car.vehicleFeatures && typeof car.vehicleFeatures === 'string'
                      ? car.vehicleFeatures
                      : "N/A")}
                </p>
              </div>
              
              {/* Assigned To Section */}
                <div className="pt-1.5 border-t border-border min-w-0">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 lg:gap-6 min-w-0">
                    {/* Left: Assigned To */}
                    <div className="flex-shrink-0 text-center lg:text-left min-w-0">
                      <p className="text-xs text-muted-foreground mb-1.5">Assigned To</p>
                    {/* Display maintenance status if car is in maintenance */}
                    {car.rawStatus === "maintenance" ? (
                      <div>
                        <Badge
                          variant="outline"
                            className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30 mb-2"
                        >
                          Maintenance
                        </Badge>
                        {car.owner && (
                          <div className="mt-2">
                              <p className="text-foreground text-sm sm:text-base font-semibold">
                              {car.owner.firstName} {car.owner.lastName}
                            </p>
                            {car.owner.email && (
                                <p className="text-foreground text-xs mt-0.5 break-all">
                                {car.owner.email}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : car.owner ? (
                      car.clientId ? (
                        <button
                          onClick={() => setLocation(`/admin/clients/${car.clientId}`)}
                            className="hover:text-blue-700 transition-colors"
                        >
                            <p className="text-foreground text-sm sm:text-base font-semibold hover:underline">
                            {car.owner.firstName} {car.owner.lastName}
                          </p>
                          {car.owner.email && (
                              <p className="text-foreground text-xs mt-0.5 hover:text-blue-700 break-all">
                              {car.owner.email}
                            </p>
                          )}
                        </button>
                      ) : (
                        <>
                            <p className="text-foreground text-sm sm:text-base font-semibold">
                            {car.owner.firstName} {car.owner.lastName}
                          </p>
                          {car.owner.email && (
                              <p className="text-foreground text-xs mt-0.5 break-all">
                              {car.owner.email}
                            </p>
                          )}
                        </>
                      )
                    ) : (
                      <p className="text-muted-foreground text-xs sm:text-sm">Unassigned</p>
                      )}
                    </div>

                    {/* Right: Car Status, Management, Online Status, Last Login */}
                    <div className="grid grid-cols-2 lg:flex lg:items-start lg:gap-6 lg:flex-1 lg:justify-end gap-4 w-full min-w-0">
                      {/* Car Status */}
                      <div className="text-center lg:min-w-[100px] min-w-0">
                        <p className="text-xs text-muted-foreground mb-1.5">Car Status</p>
                        <div className="flex justify-center">
                          <Badge
                            variant="outline"
                            className={cn(getStatusBadgeColor(car.status), "text-xs")}
                          >
                            {car.status === "ACTIVE"
                              ? "ACTIVE"
                              : car.status === "INACTIVE"
                              ? "INACTIVE"
                              : String(car.status).replace("_", " ").toUpperCase()}
                          </Badge>
                        </div>
                      </div>

                      {/* Management */}
                      <div className="text-center lg:min-w-[100px] min-w-0">
                        <p className="text-xs text-muted-foreground mb-1.5">Management</p>
                        <p className="text-foreground text-xs sm:text-sm font-medium">
                          {car.managementStatus === "management"
                            ? "Management"
                            : car.managementStatus === "own"
                            ? "Own"
                            : car.managementStatus === "off_ride"
                            ? "Off Ride"
                            : "N/A"}
                        </p>
                      </div>

                      {/* Online Status */}
                      <div className="text-center lg:min-w-[120px] min-w-0">
                        <p className="text-xs text-muted-foreground mb-1.5">Online Status</p>
                        {!car.owner ? (
                          <p className="text-muted-foreground text-xs sm:text-sm">N/A</p>
                        ) : onlineStatusBadge ? (
                          <div className="flex justify-center">
                            <Badge
                              variant="outline"
                              className={cn(onlineStatusBadge.className, "text-xs")}
                            >
                              {onlineStatusBadge.text}
                            </Badge>
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-xs sm:text-sm">N/A</p>
                        )}
                      </div>

                      {/* Last Login - use client API value so it matches Client profile page */}
                      <div className="text-center lg:min-w-[140px] min-w-0 col-span-2 lg:col-span-1">
                        <p className="text-xs text-muted-foreground mb-1.5">Last Login</p>
                        <p className="text-foreground text-xs sm:text-sm font-medium whitespace-normal break-words">
                          {car.owner
                            ? formatLastLogin(ownerLastLoginAt)
                            : "N/A"}
                        </p>
                    </div>
                    </div>
                </div>
              </div>
              {car.offboardAt && (
                  <div className="pt-1.5 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-0.5">Off-boarded</p>
                    <p className="text-foreground text-base">
                    {formatDate(car.offboardAt)}
                  </p>
                  {car.offboardReason && (
                      <p className="text-muted-foreground text-xs mt-0.5">
                      Reason: {car.offboardReason.replace("_", " ")}
                    </p>
                  )}
                  {car.offboardNote && (
                      <p className="text-muted-foreground text-xs mt-0.5">
                      Note: {car.offboardNote}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Column 2: Car Photos and Car Links stacked vertically */}
          <div className="lg:col-span-6 flex flex-col gap-6 min-w-0 w-full">
            {/* Car Photos Carousel Card */}
            <Card className="bg-card border-border flex flex-col flex-1 min-w-0 w-full max-w-full overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-primary text-lg flex items-center gap-2">
                  <Car className="w-5 h-5" />
                  Car Photos
              </CardTitle>
            </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                {car.photos && car.photos.length > 0 ? (
                  <div className="space-y-2 flex-1 flex flex-col">
                      {/* Main Carousel Display - Flexible height to match Vehicle Information card */}
                      <div className="relative w-full flex-1 bg-background rounded-lg overflow-hidden border border-border">
                      {car.photos.map((photo, index) => {
                        // Use getProxiedImageUrl to handle both GCS URLs and local paths
                        // This ensures CORS issues are avoided by proxying GCS URLs through the backend
                        let photoUrl: string;
                        if (!photo) {
                          console.warn(`⚠️ [CAR DETAIL] Empty photo path at index ${index}`);
                          photoUrl = '';
                        } else {
                          photoUrl = getProxiedImageUrl(photo);
                          // Log first photo for debugging
                          if (index === 0) {
                            console.log(`📸 [CAR DETAIL] Photo ${index + 1}: Using proxied URL:`, photoUrl.substring(0, 100) + '...');
                          }
                        }
                        const isActive = index === carouselIndex;
                        return (
                          <div
                            key={index}
                            className={cn(
                              "absolute inset-0 transition-all duration-500 ease-in-out px-6",
                              isActive ? "opacity-100 z-10" : "opacity-0 z-0"
                            )}
                          >
                            <img
                              src={photoUrl}
                              alt={`Car photo ${index + 1}`}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                console.error('❌ [CAR DETAIL] Failed to load photo:', photoUrl);
                                console.error('   Original photo:', photo);
                                console.error('   API Base URL:', import.meta.env.VITE_API_URL || 'Not set');
                                console.error('   Photo URL type:', photo?.startsWith('https://storage.googleapis.com/') ? 'GCS' : 'Other');
                                console.error('   Proxy URL:', photoUrl);
                                
                                // Try to fetch the image directly to see what error we get
                                if (photoUrl && photoUrl.includes('/api/gcs-image-proxy')) {
                                  fetch(photoUrl)
                                    .then(res => {
                                      console.error('   Proxy response status:', res.status);
                                      console.error('   Proxy response headers:', Object.fromEntries(res.headers.entries()));
                                      return res.text();
                                    })
                                    .then(text => console.error('   Proxy response body:', text.substring(0, 200)))
                                    .catch(err => console.error('   Proxy fetch error:', err));
                                }
                                
                                // Don't hide the image - keep it visible but show error state
                                const img = e.target as HTMLImageElement;
                                img.style.opacity = '0.3';
                                img.style.filter = 'grayscale(100%)';
                              }}
                            />
                </div>
                        );
                      })}
                      
                      {/* Navigation Controls - Bottom Center */}
                      {car.photos.length > 1 && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3">
                          {/* Previous Button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleCarouselPrev}
                            className="h-9 w-9 bg-background/70 hover:bg-background/90 text-foreground border border-white/30 rounded-full shadow-lg backdrop-blur-sm transition-all hover:scale-110"
                            aria-label="Previous image"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </Button>
                          
                          {/* Image Counter */}
                          <div className="bg-background/70 px-4 py-2 rounded-full border border-white/30 shadow-lg backdrop-blur-sm">
                            <span className="text-foreground text-sm font-medium">
                              {carouselIndex + 1} / {car.photos.length}
                            </span>
                  </div>
                          
                          {/* Next Button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleCarouselNext}
                            className="h-9 w-9 bg-background/70 hover:bg-background/90 text-foreground border border-white/30 rounded-full shadow-lg backdrop-blur-sm transition-all hover:scale-110"
                            aria-label="Next image"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </Button>
                  </div>
                      )}
                  </div>

                    {/* Circular Indicator Dots */}
                    {car.photos.length > 1 && (
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        {car.photos.map((_, index) => (
                          <button
                            key={index}
                            onClick={() => handleCarouselGoTo(index)}
                            className={cn(
                              "w-3 h-3 rounded-full transition-all duration-300",
                              index === carouselIndex
                                ? "bg-[#D3BC8D] w-8"
                                : "bg-gray-600 hover:bg-gray-500"
                            )}
                            aria-label={`Go to image ${index + 1}`}
                          />
                        ))}
                  </div>
                    )}
                </div>
              ) : (
                    <div className="flex items-center justify-center flex-1 bg-background/20 rounded-lg border border-border">
                      <p className="text-muted-foreground text-center">
                        No photos available
                      </p>
                </div>
              )}
            </CardContent>
          </Card>

            {/* Car Links Card */}
            <Card className="bg-card border-border min-w-0 w-full max-w-full overflow-hidden">
            <CardHeader>
                <CardTitle className="text-primary text-lg flex items-center gap-2">
                  <Car className="w-5 h-5" />
                  Car Links
              </CardTitle>
            </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Turo Link</p>
                    {car.turoLink ? (
                      <p className="text-foreground text-base break-all">
                        <a
                          href={car.turoLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-700 hover:underline"
                        >
                          {formatValue(car.turoLink)}
                        </a>
                      </p>
                    ) : (
                      <p className="text-muted-foreground text-base">Not provided</p>
                    )}
                  </div>
                  {isAdmin && (
                  <div>
                      <p className="text-xs text-muted-foreground mb-1">Admin Turo Link</p>
                      {car.adminTuroLink ? (
                        <p className="text-foreground text-base break-all">
                          <a
                            href={car.adminTuroLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-700 hover:underline"
                          >
                            {formatValue(car.adminTuroLink)}
                          </a>
                        </p>
              ) : (
                        <p className="text-muted-foreground text-base">Not provided</p>
                      )}
                </div>
              )}
                  {isAdmin && (
                  <div>
                      <p className="text-xs text-muted-foreground mb-1">Turo Vehicle IDs</p>
                      {(() => {
                        const dbIds = (car.turoVehicleIds || []).filter((id): id is string => typeof id === "string" && id.trim().length > 0);
                        const fromTuroLink = extractTuroVehicleIdFromUrl(car.turoLink);
                        const fromAdminLink = extractTuroVehicleIdFromUrl(car.adminTuroLink);
                        const allIds = [...new Set([...dbIds, fromTuroLink, fromAdminLink].filter((id): id is string => Boolean(id)))];
                        return allIds.length > 0 ? (
                          <div className="space-y-1">
                            {allIds.map((id, idx) => (
                              <p key={idx} className="text-foreground text-sm font-mono">{id}</p>
                            ))}
                            <p className="text-xs text-muted-foreground">({allIds.length} of 10 max — for automation{fromTuroLink || fromAdminLink ? ", includes IDs from links" : ""})</p>
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-base">Not provided</p>
                        );
                      })()}
                </div>
              )}
                </div>
            </CardContent>
          </Card>
          </div>
        </div>

        {/* Row 2: Documents, Vehicle Purchase Information, Car Login Information, Insurance Information */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 w-full min-w-0 max-w-full">
          {/* Documents Card */}
          <Card className="bg-card border-border lg:col-span-3 min-w-0 max-w-full">
            <CardHeader>
              <CardTitle className="text-primary text-lg">
                Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingOnboarding ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">Loading documents...</p>
                </div>
              ) : onboarding ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
                  {/* Insurance Card */}
                  <div>
                    <h4 className="text-base font-semibold text-muted-foreground mb-4">Insurance Card</h4>
                    {onboarding.insuranceCardUrl && String(onboarding.insuranceCardUrl).trim() ? (() => {
                      const trimmedUrl = String(onboarding.insuranceCardUrl).trim();
                      
                      // Check if it's a Google Drive file ID
                      // Google Drive IDs are typically: alphanumeric with hyphens/underscores, no slashes, no dots (unless it's a full URL)
                      // Length is usually 28-44 characters, but we'll accept anything >= 10 that matches the pattern
                      // Also check: if it doesn't look like a URL or local path, treat it as a Google Drive ID
                      const looksLikeUrl = trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://') || trimmedUrl.startsWith('/');
                      const looksLikeLocalPath = trimmedUrl.includes('/') && (trimmedUrl.includes('.') || trimmedUrl.startsWith('/'));
                      
                      // More lenient detection: if it doesn't look like a URL or local path, and matches Google Drive ID pattern, treat it as one
                      const isGoogleDriveId = trimmedUrl && 
                        !looksLikeUrl &&
                        !looksLikeLocalPath &&
                        trimmedUrl.length >= 10 && 
                        /^[a-zA-Z0-9_-]+$/.test(trimmedUrl);
                      
                      // Determine document URL - use proxy endpoint for Google Drive IDs
                      const documentUrl = isGoogleDriveId
                        ? buildApiUrl(`/api/cars/documents/file-content?fileId=${encodeURIComponent(trimmedUrl)}`)
                        : trimmedUrl.startsWith('http') 
                          ? trimmedUrl 
                          : buildApiUrl(trimmedUrl.startsWith('/') ? trimmedUrl : `/${trimmedUrl}`);
                      
                      // For Google Drive IDs, we can't determine MIME type from the ID alone
                      // We'll default to treating it as an image, and the proxy endpoint will set the correct Content-Type
                      // The browser will handle PDFs correctly based on the Content-Type header
                      // For local files, use existing logic
                      const isPdf = isGoogleDriveId 
                        ? false // Default to image, proxy endpoint will handle PDFs via Content-Type
                        : isPdfDocument(trimmedUrl);
                      
                      return (
                        <div 
                          className="relative group cursor-pointer"
                          onClick={() => {
                            setFullScreenDocument({ url: documentUrl, type: 'insurance', isPdf });
                          }}
                        >
                          <div className={`relative w-full aspect-[4/3] bg-background rounded-lg border-2 transition-all overflow-hidden shadow-lg ${
                            isPdf 
                              ? 'border-primary/50 hover:border-primary shadow-[#D3BC8D]/20' 
                              : 'border-primary/30 hover:border-primary shadow-[#D3BC8D]/20'
                          }`}>
                            {isPdf ? (
                              <div className="w-full h-full flex flex-col items-center justify-center p-4">
                                <FileText className="w-16 h-16 text-primary mb-2" />
                                <p className="text-primary text-sm font-semibold">PDF Document</p>
                                <p className="text-muted-foreground text-xs mt-1">Click to open in PDF viewer</p>
                              </div>
                            ) : isGoogleDriveId ? (
                              // For Google Drive: use credentialled fetch so documents display in published (cross-origin) project
                              <DocumentImageWithAuth
                                url={documentUrl}
                                alt="Insurance Card"
                                className="w-full h-full object-contain p-2"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  const parent = target.parentElement;
                                  if (parent && !parent.querySelector('iframe')) {
                                    target.style.display = "none";
                                    const iframe = document.createElement('iframe');
                                    iframe.src = documentUrl;
                                    iframe.className = "w-full h-full border-0";
                                    iframe.title = "Insurance Card";
                                    parent.appendChild(iframe);
                                  } else if (parent && !parent.querySelector(".error-message")) {
                                    const errorDiv = document.createElement("div");
                                    errorDiv.className = "error-message text-sm text-muted-foreground absolute inset-0 flex items-center justify-center";
                                    errorDiv.textContent = "Failed to load document";
                                    parent.appendChild(errorDiv);
                                  }
                                }}
                              />
                            ) : (
                              <img
                                src={documentUrl}
                                alt="Insurance Card"
                                className="w-full h-full object-contain p-2"
                                onLoad={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  const parent = target.parentElement?.parentElement;
                                  if (parent) {
                                    const errorMessage = parent.querySelector(".error-message");
                                    if (errorMessage) errorMessage.remove();
                                  }
                                }}
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = "none";
                                  const parent = target.parentElement?.parentElement;
                                  if (parent && !parent.querySelector(".error-message")) {
                                    const errorDiv = document.createElement("div");
                                    errorDiv.className = "error-message text-sm text-muted-foreground absolute inset-0 flex items-center justify-center";
                                    errorDiv.textContent = "Failed to load image";
                                    parent.appendChild(errorDiv);
                                  }
                                }}
                              />
                            )}
                            <div className="absolute inset-0 bg-background/0 group-hover:bg-background/10 transition-colors flex items-center justify-center">
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-background/70 text-foreground px-4 py-2 rounded-lg text-sm font-medium">
                                {isPdf ? 'Click to open PDF' : 'Click to view full screen'}
                              </div>
                            </div>
                            {isPdf && (
                              <div className="absolute top-2 right-2 bg-primary/90 text-primary-foreground text-xs px-2 py-1 rounded font-semibold">
                                PDF
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })() : (
                      <div className="w-full aspect-[4/3] bg-background rounded-lg border border-border flex items-center justify-center">
                        <p className="text-sm text-muted-foreground">No insurance card uploaded</p>
                      </div>
                    )}
                  </div>

                  {/* Drivers License */}
                  <div>
                    <h4 className="text-base font-semibold text-muted-foreground mb-4">Drivers License</h4>
                    {validDriversLicenseUrls.length > 0 ? (
                      <div className="space-y-4">
                        {validDriversLicenseUrls.map((url: string, index: number) => {
                            // Check if it's a Google Drive file ID
                            // Google Drive IDs are typically: alphanumeric with hyphens/underscores, no slashes, no dots (unless it's a full URL)
                            // Length is usually 28-44 characters, but we'll accept anything >= 10 that matches the pattern
                            // Also check: if it doesn't look like a URL or local path, treat it as a Google Drive ID
                            const looksLikeUrl = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/');
                            const looksLikeLocalPath = url.includes('/') && (url.includes('.') || url.startsWith('/'));
                            
                            // More lenient detection: if it doesn't look like a URL or local path, and matches Google Drive ID pattern, treat it as one
                            const isGoogleDriveId = url && 
                              !looksLikeUrl &&
                              !looksLikeLocalPath &&
                              url.length >= 10 && 
                              /^[a-zA-Z0-9_-]+$/.test(url);
                            
                            // Determine document URL - use proxy endpoint for Google Drive IDs
                            const documentUrl = isGoogleDriveId
                              ? buildApiUrl(`/api/cars/documents/file-content?fileId=${encodeURIComponent(url)}`)
                              : url.startsWith('http') ? url : buildApiUrl(url.startsWith('/') ? url : `/${url}`);
                            
                            // For Google Drive IDs, we can't determine MIME type from the ID alone
                            // We'll default to treating it as an image, and the proxy endpoint will set the correct Content-Type
                            // The browser will handle PDFs correctly based on the Content-Type header
                            // For local files, use existing logic
                            const isPdf = isGoogleDriveId
                              ? false // Default to image, proxy endpoint will handle PDFs via Content-Type
                              : isPdfDocument(url);
                            
                          return (
                            <div 
                              key={index}
                              className="relative group cursor-pointer"
                              onClick={() => setFullScreenDocument({ url: documentUrl, type: 'license', index, isPdf })}
                            >
                              <div className={`relative w-full aspect-[4/3] bg-background rounded-lg border-2 transition-all overflow-hidden shadow-lg ${
                                isPdf 
                                  ? 'border-primary/50 hover:border-primary shadow-[#D3BC8D]/20' 
                                  : 'border-primary/30 hover:border-primary shadow-[#D3BC8D]/20'
                              }`}>
                                {isPdf ? (
                                  <div className="w-full h-full flex flex-col items-center justify-center p-4">
                                    <div className="text-primary mb-2">
                                      <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                      </svg>
                                    </div>
                                    <p className="text-primary text-sm font-semibold">PDF Document</p>
                                    <p className="text-muted-foreground text-xs mt-1">Click to open in PDF viewer</p>
                                  </div>
                                ) : isGoogleDriveId ? (
                                  // For Google Drive: use credentialled fetch so documents display in published (cross-origin) project
                                  <DocumentImageWithAuth
                                    url={documentUrl}
                                    alt={`Drivers License ${index + 1}`}
                                    className="w-full h-full object-contain p-2"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      const parent = target.parentElement;
                                      if (parent && !parent.querySelector('iframe')) {
                                        target.style.display = "none";
                                        const iframe = document.createElement('iframe');
                                        iframe.src = documentUrl;
                                        iframe.className = "w-full h-full border-0";
                                        iframe.title = `Drivers License ${index + 1}`;
                                        parent.appendChild(iframe);
                                      } else if (parent && !parent.querySelector(".error-message")) {
                                        const errorDiv = document.createElement("div");
                                        errorDiv.className = "error-message text-sm text-muted-foreground absolute inset-0 flex items-center justify-center";
                                        errorDiv.textContent = "Failed to load document";
                                        parent.appendChild(errorDiv);
                                      }
                                    }}
                                  />
                                ) : (
                                  <img
                                    src={documentUrl}
                                    alt={`Drivers License ${index + 1}`}
                                    className="w-full h-full object-contain p-2"
                                    onLoad={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      const parent = target.parentElement?.parentElement;
                                      if (parent) {
                                        const errorMessage = parent.querySelector(".error-message");
                                        if (errorMessage) errorMessage.remove();
                                      }
                                    }}
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = "none";
                                      const parent = target.parentElement?.parentElement;
                                      if (parent && !parent.querySelector(".error-message")) {
                                        const errorDiv = document.createElement("div");
                                        errorDiv.className = "error-message text-sm text-muted-foreground absolute inset-0 flex items-center justify-center";
                                        errorDiv.textContent = "Failed to load image";
                                        parent.appendChild(errorDiv);
                                      }
                                    }}
                                  />
                                )}
                                <div className="absolute inset-0 bg-background/0 group-hover:bg-background/10 transition-colors flex items-center justify-center">
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-background/70 text-foreground px-4 py-2 rounded-lg text-sm font-medium">
                                    {isPdf ? 'Click to open PDF' : 'Click to view full screen'}
                                  </div>
                                </div>
                                {isPdf && (
                                  <div className="absolute top-2 right-2 bg-[#D3BC8D]/90 text-black text-xs px-2 py-1 rounded font-semibold">
                                    PDF
                                  </div>
                                )}
                                {validDriversLicenseUrls.length > 1 && (
                                  <div className="absolute top-2 left-2 bg-background/80 text-foreground text-xs px-2 py-1 rounded">
                                    {index + 1} / {validDriversLicenseUrls.length}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="w-full aspect-[4/3] bg-background rounded-lg border border-border flex items-center justify-center">
                        <p className="text-sm text-muted-foreground">No drivers license uploaded</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No documents available</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vehicle Purchase Information Card */}
          <Card className="bg-card border-border lg:col-span-3 min-w-0 max-w-full">
            <CardHeader>
              <CardTitle className="text-primary text-lg">
              Purchase Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingOnboarding ? (
                <div className="text-center py-4 text-muted-foreground">
                  <p className="text-sm">Loading...</p>
                </div>
              ) : onboarding ? (
                <>
                  {/* Financial Details - 2 columns */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Purchase Price</p>
                      <p className="text-foreground text-base font-medium">{formatCurrency(onboarding.purchasePrice)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Down Payment</p>
                      <p className="text-foreground text-base font-medium">{formatCurrency(onboarding.downPayment)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Monthly Payment</p>
                      <p className="text-foreground text-base font-medium">{formatCurrency(onboarding.monthlyPayment)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Interest Rate</p>
                      <p className="text-foreground text-base font-medium">{formatValue(onboarding.interestRate)}%</p>
                  </div>
                  </div>
                  
                  {/* Additional Information - Full width with separator */}
                  <div className="pt-4 border-t border-border space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Transport City to City</p>
                    <p className="text-foreground text-base">{formatValue(onboarding.transportCityToCity)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Ultimate Goal</p>
                    <p className="text-foreground text-base">{formatValue(onboarding.ultimateGoal)}</p>
                  </div>
                </div>
                </>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <p className="text-sm">No financial information available</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Car Login Information Card */}
          <Card className="bg-card border-border lg:col-span-3 min-w-0 max-w-full">
            <CardHeader>
              <CardTitle className="text-primary text-lg">
                Car Login Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoadingOnboarding ? (
                <div className="text-center py-4 text-muted-foreground">
                  <p className="text-sm">Loading...</p>
                </div>
              ) : onboarding ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  {onboarding.carManufacturerWebsite && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Car Manufacturer Website</p>
                      <p className="text-foreground text-base break-all">
                        <a
                          href={onboarding.carManufacturerWebsite}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-700 hover:underline"
                        >
                          {formatValue(onboarding.carManufacturerWebsite)}
                        </a>
                      </p>
                    </div>
                  )}
                  {onboarding.carManufacturerUsername && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Manufacturer Username</p>
                      <p className="text-foreground text-base">{formatValue(onboarding.carManufacturerUsername)}</p>
                    </div>
                  )}
                  {onboarding.password && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Password</p>
                      <p className="text-foreground text-base font-mono">{formatValue(onboarding.password)}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <p className="text-sm">No additional information available</p>
                </div>
              )}
              {/* Timestamps */}
              <div className="pt-3 border-t border-border space-y-2">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Created</p>
                  <p className="text-foreground text-base">
                  {formatDate(car.createdAt)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Last Updated</p>
                  <p className="text-foreground text-base">
                  {formatDate(car.updatedAt)}
                </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Insurance Information Card */}
          <Card className="bg-card border-border lg:col-span-3 min-w-0 max-w-full">
            <CardHeader>
              <CardTitle className="text-primary text-lg">
                Insurance Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoadingOnboarding ? (
                <div className="text-center py-4 text-muted-foreground">
                  <p className="text-sm">Loading...</p>
        </div>
              ) : onboarding ? (
                <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Provider</p>
                    <p className="text-foreground text-base">{formatValue(onboarding.insuranceProvider)}</p>
                        </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Phone</p>
                    <p className="text-foreground text-base">{formatValue(onboarding.insurancePhone)}</p>
                      </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Policy Number</p>
                    <p className="text-foreground text-base font-mono">{formatValue(onboarding.policyNumber)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Expiration</p>
                    <p className="text-foreground text-base">{formatValue(onboarding.insuranceExpiration)}</p>
                    </div>
                  </div>
                </>
                ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <p className="text-sm">No insurance information available</p>
                  </div>
                )}
            </CardContent>
          </Card>

        </div>

        {/* Photos Grid - 8 columns per row (up to 20 images) - Hidden for client accounts */}
        {isAdmin && (
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-primary text-lg flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Photos ({car.photos?.length || 0} / 20)
              </CardTitle>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  {selectedPhotos.size > 0 && (
                    <>
                      <ConfirmDialog
                        trigger={
                          <Button
                            variant="outline"
                            disabled={deleteMultiplePhotosMutation.isPending}
                            className="border-red-500/50 text-red-700 hover:bg-red-500/10 hover:border-red-500"
                          >
                            {deleteMultiplePhotosMutation.isPending ? (
                              <>
                                Deleting...
                              </>
                            ) : (
                              <>
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Selected ({selectedPhotos.size})
                              </>
                            )}
                          </Button>
                        }
                        title="Delete Selected Photos"
                        description={`Are you sure you want to delete ${selectedPhotos.size} photo(s)? This action cannot be undone. Photos will be deleted from both the interface and storage.`}
                        confirmText="Delete"
                        cancelText="Cancel"
                        variant="destructive"
                        onConfirm={handleDeleteSelected}
                      />
                      <Button
                        variant="ghost"
                        onClick={() => setSelectedPhotos(new Set())}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Clear Selection
                      </Button>
                    </>
                  )}
                  {car.photos && car.photos.length > 0 && (
                    <Button
                      onClick={handleSelectAll}
                      className="bg-primary text-primary-foreground hover:bg-primary/80"
                    >
                      {(() => {
                        // Check if all photos are selected
                        const allIndices = car.photos.map((_, index) => index);
                        const allSelected = allIndices.length > 0 && 
                          allIndices.every(index => selectedPhotos.has(index)) &&
                          selectedPhotos.size === allIndices.length;
                        
                        return allSelected ? (
                          <>
                            <Square className="w-4 h-4 mr-2" />
                            Deselect All
                          </>
                        ) : (
                          <>
                            <CheckSquare className="w-4 h-4 mr-2" />
                            Select All
                          </>
                        );
                      })()}
                    </Button>
                  )}
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhotos}
                    className="hidden"
                    id="photo-upload"
                    title="Select one or more images (JPEG, PNG, GIF, WebP - max 10MB each)"
                  />
                  <Button
                    asChild
                    className="bg-primary text-primary-foreground hover:bg-primary/80"
                    disabled={uploadingPhotos}
                  >
                    <label htmlFor="photo-upload" className="cursor-pointer" title="Select multiple images to upload at once">
                      {uploadingPhotos ? (
                        <>
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Photos
                        </>
                      )}
                    </label>
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {car.photos && car.photos.length > 0 ? (
              <div className="grid grid-cols-8 gap-4">
                {car.photos.map((photo, index) => {
                  // Use getProxiedImageUrl to handle both GCS URLs and local paths
                  // This ensures CORS issues are avoided by proxying GCS URLs through the backend
                  let photoUrl: string;
                  if (!photo) {
                    console.warn(`[CAR DETAIL] Empty photo path at index ${index}`);
                    photoUrl = '';
                  } else {
                    photoUrl = getProxiedImageUrl(photo);
                  }
                  // Log in production to help debug
                  if (import.meta.env.PROD && index === 0) {
                    console.log(`[CAR DETAIL] Main photo URL (grid):`, photoUrl);
                    console.log(`[CAR DETAIL] Photo path (grid):`, photo);
                    console.log(`[CAR DETAIL] Original photo (grid):`, photo);
                  }
                  const isSelected = selectedPhotos.has(index);
                  const isMain = index === 0;
                  return (
                    <div
                      key={index}
                      className={cn(
                        "relative group",
                        isSelected && "ring-2 ring-[#D3BC8D] rounded-lg",
                        // Removed carousel sync indicator - carousel and Photos card are independent
                        isAdmin && "cursor-pointer"
                      )}
                      onClick={(e) => {
                        // Only select if admin and not clicking on checkbox or delete button
                        if (isAdmin) {
                          const target = e.target as HTMLElement;
                          if (!target.closest('.checkbox-area') && !target.closest('button')) {
                            handleSelectPhoto(index);
                          }
                        }
                      }}
                    >
                      <div className="relative aspect-square">
                    <img
                      src={photoUrl}
                      alt={`Car photo ${index + 1}`}
                          className={cn(
                            "w-full h-full object-cover rounded-lg border transition-all",
                            isSelected
                              ? "border-primary opacity-80"
                              : "border-border group-hover:border-primary/50"
                          )}
                      onError={(e) => {
                       // Don't hide the image - keep it visible but show error state
                        const img = e.target as HTMLImageElement;
                        img.style.opacity = '0.3';
                        img.style.filter = 'grayscale(100%)';
                      }}
                    />
                        {/* Main Photo Badge */}
                        {isMain && (
                          <div className="absolute bottom-2 left-2 bg-background/70 text-primary text-[10px] px-2 py-1 rounded border border-primary/30">
                            Main
                          </div>
                        )}
                        {/* Checkbox Overlay */}
                    {isAdmin && (
                          <div 
                            className="absolute top-2 left-2 z-10 checkbox-area"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectPhoto(index);
                              }}
                              className={cn(
                                "w-6 h-6 rounded border-2 flex items-center justify-center transition-all cursor-pointer",
                                isSelected
                                  ? "bg-[#D3BC8D] border-primary hover:bg-primary/80"
                                  : "bg-background/50 border-white/50 hover:border-white hover:bg-background/70"
                              )}
                            >
                              {isSelected && (
                                <CheckSquare className="w-4 h-4 text-black" />
                              )}
                            </button>
                          </div>
                        )}
                        {/* Delete Button (Admin only, single delete) */}
                        {isAdmin && (
                          <div 
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            onClick={(e) => e.stopPropagation()}
                          >
                      <ConfirmDialog
                        trigger={
                          <Button
                            variant="ghost"
                            size="sm"
                                  className="bg-red-500/80 hover:bg-red-500 text-foreground"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        }
                        title="Delete Photo"
                              description={`Are you sure you want to delete this photo? This action cannot be undone.`}
                        confirmText="Delete"
                        cancelText="Cancel"
                        variant="destructive"
                              onConfirm={() => {
                                // Capture the photo path and index in the closure
                                const photoToDelete = photo;
                                const photoIndex = index;
                                
                                // Delete only this specific photo
                                deletePhotoMutation.mutate(photoToDelete, {
                                  onSuccess: () => {
                                    // Remove from selection if it was selected
                                    if (selectedPhotos.has(photoIndex)) {
                                      const newSelected = new Set(selectedPhotos);
                                      newSelected.delete(photoIndex);
                                      setSelectedPhotos(newSelected);
                                    }
                                    // Adjust carousel index if needed
                                    if (car.photos && carouselIndex >= car.photos.length - 1) {
                                      setCarouselIndex(Math.max(0, car.photos.length - 2));
                                    }
                                  }
                                });
                              }}
                            />
                          </div>
                        )}
                        {/* Set Main Button (Admin only) */}
                        {isAdmin && !isMain && (
                          <div
                            className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={setMainPhotoMutation.isPending}
                              onClick={(e) => {
                                e.stopPropagation();
                                setMainPhotoMutation.mutate(photo);
                              }}
                              className="bg-background/70 hover:bg-background/90 text-primary border border-primary/30 h-7 w-7 p-0"
                              title="Set as main photo"
                            >
                              <Star className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                        {/* Image Number Badge */}
                        <div className="absolute bottom-2 right-2 bg-background/70 px-2 py-1 rounded text-xs text-foreground">
                          {index + 1}
                        </div>
                      </div>
                  </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center py-16">
                <p className="text-muted-foreground text-center">
                  No photos uploaded. {isAdmin && "Upload one or multiple photos (up to 20) to get started."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Rental History - Placeholder */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-primary text-lg">Rental History</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center py-8">
              Rental history tracking coming soon
            </p>
          </CardContent>
        </Card>

        {/* Edit Modal - Only for admins */}
        {isAdmin && (
          <Dialog open={isEditModalOpen} onOpenChange={(open) => {
            setIsEditModalOpen(open);
            if (!open) {
              // Reset document file state when dialog closes
              setInsuranceCardFile(null);
              setInsuranceCardPreview(null);
              setDriversLicenseFiles([]);
              setDriversLicensePreviews([]);
            }
          }}>
          <DialogContent className="bg-card border-border text-foreground max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl font-semibold">
                Edit Car Information
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Update vehicle information, documents, vehicle purchase information, vehicle login information, and insurance information
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6 mt-4"
              >
                {/* Vehicle Information Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary border-b border-border pb-2">
                    Vehicle Information
                  </h3>
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
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                    <FormField
                      control={form.control}
                      name="mileage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">Mileage</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                            className="bg-card border-border text-foreground focus:border-primary"
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
                        <FormLabel className="text-muted-foreground">Title Type</FormLabel>
                        <FormControl>
                          <Input
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
                    name="vehicleTrim"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Trim</FormLabel>
                        <FormControl>
                          <Input
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
                    name="interiorColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Interior Color</FormLabel>
                        <FormControl>
                          <Input
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
                    name="registrationExpiration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Registration Expiration</FormLabel>
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
                    name="vehicleRecall"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Vehicle Recall</FormLabel>
                        <FormControl>
                          <Input
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
                    name="numberOfSeats"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Number of Seats</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            className="bg-card border-border text-foreground focus:border-primary"
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
                        <FormLabel className="text-muted-foreground">Number of Doors</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            className="bg-card border-border text-foreground focus:border-primary"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="skiRacks"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Ski Rack</FormLabel>
                        <FormControl>
                          <Input
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
                    name="skiCrossBars"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Ski Crossbars</FormLabel>
                        <FormControl>
                          <Input
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
                    name="roofRails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Roof Rails</FormLabel>
                        <FormControl>
                          <Input
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
                    name="oilType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Oil Type</FormLabel>
                        <FormControl>
                          <Input
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
                    name="lastOilChange"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Last Oil Change Date</FormLabel>
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
                    name="freeDealershipOilChanges"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Does Your Vehicle Have Free Dealership Oil Changes?</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                        <FormControl>
                            <SelectTrigger className="bg-card border-border text-foreground focus:border-primary">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                        </FormControl>
                          <SelectContent className="bg-card border-border text-foreground">
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
                    name="oilPackageDetails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">If Yes, For How Many Years of Oil Changes, or What Oil Package</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className="bg-card border-border text-foreground focus:border-primary"
                            placeholder="e.g., 3 years or Premium Package"
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
                        <FormLabel className="text-muted-foreground">Dealership Address</FormLabel>
                        <FormControl>
                          <Input
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
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="vehicleFeatures"
                    render={() => (
                      <FormItem className="col-span-2">
                        <div className="mb-4">
                          <FormLabel className="text-muted-foreground text-base font-semibold">
                            Features (check all that apply)
                          </FormLabel>
                        </div>
                        <div className="border border-border rounded-lg p-4 bg-card">
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
                                          checked={Array.isArray(field.value) ? field.value.includes(feature) : false}
                                          onCheckedChange={(checked) => {
                                            const currentValue = Array.isArray(field.value) ? field.value : [];
                                            return checked
                                              ? field.onChange([...currentValue, feature])
                                              : field.onChange(
                                                  currentValue.filter(
                                                    (value) => value !== feature
                                                  )
                                                );
                                          }}
                                          className="border-border data-[state=checked]:bg-[#D3BC8D] data-[state=checked]:border-primary"
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
                  </div>
                </div>

                {/* Financial Information Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary border-b border-border pb-2">
                    Purchase Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="purchasePrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">Purchase Price</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className="bg-card border-border text-foreground focus:border-primary"
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
                          <FormLabel className="text-muted-foreground">Down Payment</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className="bg-card border-border text-foreground focus:border-primary"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="monthlyPayment"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">Monthly Payment</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className="bg-card border-border text-foreground focus:border-primary"
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
                          <FormLabel className="text-muted-foreground">Interest Rate (%)</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              className="bg-card border-border text-foreground focus:border-primary"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="transportCityToCity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">Transport City to City</FormLabel>
                          <FormControl>
                            <Input
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
                      name="ultimateGoal"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">Ultimate Goal</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              className="bg-card border-border text-foreground focus:border-primary"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Insurance Information Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary border-b border-border pb-2">
                    Insurance Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="insuranceProvider"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">Provider</FormLabel>
                          <FormControl>
                            <Input
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
                      name="insurancePhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">Phone</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="tel"
                              className="bg-card border-border text-foreground focus:border-primary"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="policyNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">Policy Number</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              className="bg-card border-border text-foreground focus:border-primary font-mono"
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
                          <FormLabel className="text-muted-foreground">Expiration</FormLabel>
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
                  </div>
                </div>

                {/* Car Login Information Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary border-b border-border pb-2">
                    Car Login Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="carManufacturerWebsite"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">Car Manufacturer Website</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="url"
                              placeholder="https://example.com"
                              className="bg-card border-border text-foreground focus:border-primary"
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
                          <FormLabel className="text-muted-foreground">Manufacturer Username</FormLabel>
                          <FormControl>
                            <Input
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
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">Password</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="password"
                              className="bg-card border-border text-foreground focus:border-primary font-mono"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Car Links Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary border-b border-border pb-2">
                    Car Links
                  </h3>
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
                              placeholder="https://turo.com/..."
                              className="bg-card border-border text-foreground focus:border-primary"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {isAdmin && (
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
                                placeholder="https://turo.com/..."
                                className="bg-card border-border text-foreground focus:border-primary"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    {isAdmin && (
                      <div className="space-y-2">
                        <FormLabel className="text-muted-foreground">Turo Vehicle IDs (5–10 for automation)</FormLabel>
                        <p className="text-xs text-muted-foreground">Add up to 10 Turo Vehicle IDs for the automation process.</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-border text-muted-foreground hover:text-primary hover:border-primary mb-2"
                          onClick={() => {
                            const turoLink = form.getValues("turoLink");
                            const adminTuroLink = form.getValues("adminTuroLink");
                            const fromLink = extractTuroVehicleIdFromUrl(turoLink);
                            const fromAdmin = extractTuroVehicleIdFromUrl(adminTuroLink);
                            const newIds = [fromLink, fromAdmin].filter((id): id is string => Boolean(id));
                            if (newIds.length === 0) return;
                            const current = (form.getValues("turoVehicleIds") || []).filter((id): id is string => typeof id === "string" && id.trim().length > 0);
                            const merged = [...new Set([...current, ...newIds])].slice(0, 10);
                            form.setValue("turoVehicleIds", merged);
                          }}
                        >
                          Extract from Turo links
                        </Button>
                        {form.watch("turoVehicleIds")?.map((_, index) => (
                          <div key={index} className="flex gap-2 items-center">
                            <FormField
                              control={form.control}
                              name={`turoVehicleIds.${index}`}
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormControl>
                                    <Input
                                      {...field}
                                      placeholder={`Vehicle ID ${index + 1}`}
                                      className="bg-card border-border text-foreground focus:border-primary font-mono"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="text-muted-foreground hover:text-red-700 shrink-0"
                              onClick={() => {
                                const current = form.getValues("turoVehicleIds") || [];
                                form.setValue("turoVehicleIds", current.filter((_, i) => i !== index));
                              }}
                            >
                              <Minus className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        {(form.watch("turoVehicleIds")?.length ?? 0) < 10 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="border-border text-muted-foreground hover:text-primary hover:border-primary"
                            onClick={() => {
                              const current = form.getValues("turoVehicleIds") || [];
                              form.setValue("turoVehicleIds", [...current, ""]);
                            }}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Add Turo Vehicle ID
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Car Status Section (Admin Only) */}
                {isAdmin && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-primary border-b border-border pb-2">
                      Car Status
                    </h3>
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">Car Status</FormLabel>
                          <FormControl>
                            <Select
                              value={field.value || "ACTIVE"}
                              onValueChange={(value) => {
                                field.onChange(value);
                                // Automation: Update offboarding status based on car status
                                if (value === "INACTIVE") {
                                  // When status changes to INACTIVE, set offboarding status to Offboarded
                                  // Set offboardAt to current date if not already set
                                  const currentOffboardAt = form.getValues("offboardAt");
                                  if (!currentOffboardAt) {
                                    form.setValue("offboardAt", new Date().toISOString().split('T')[0]);
                                  }
                                  // Keep offboardReason if already set, otherwise leave it
                                } else if (value === "ACTIVE") {
                                  // When status changes to ACTIVE, clear offboarding status
                                  form.setValue("offboardAt", "");
                                  form.setValue("offboardReason", undefined);
                                  form.setValue("offboardNote", "");
                                }
                              }}
                              disabled={!isAdmin}
                            >
                              <SelectTrigger className="bg-card border-border text-foreground focus:border-primary">
                                <SelectValue placeholder="Select car status" />
                              </SelectTrigger>
                              <SelectContent className="bg-card border-border text-foreground">
                                <SelectItem value="ACTIVE">Active</SelectItem>
                                <SelectItem value="INACTIVE">Inactive</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                          <p className="text-xs text-muted-foreground">
                            Only admins can change car status. When set to Inactive, offboarding status will be automatically updated to Offboarded. When set to Active, offboarding status will be automatically updated to Active.
                          </p>
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* Management Status Section (Admin Only) */}
                {isAdmin && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-primary border-b border-border pb-2">
                      Management Status
                    </h3>
                    <FormField
                      control={form.control}
                      name="managementStatus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">Management Status</FormLabel>
                          <FormControl>
                            <Select
                              value={field.value || "own"}
                              onValueChange={field.onChange}
                              disabled={!isAdmin}
                            >
                              <SelectTrigger className="bg-card border-border text-foreground focus:border-primary">
                                <SelectValue placeholder="Select management status" />
                              </SelectTrigger>
                              <SelectContent className="bg-card border-border text-foreground">
                                <SelectItem value="management">Management</SelectItem>
                                <SelectItem value="own">Own</SelectItem>
                                <SelectItem value="off_ride">Off Ride</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                          <p className="text-xs text-muted-foreground">
                            Only admins can change management status. Automatic updates occur on onboarding approval, offboarding, and maintenance events.
                          </p>
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* Documents Section */}
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-primary border-b border-border pb-2">
                    Documents
                  </h3>
                  
                  {/* Upload Boxes - Side by Side */}
                  <div className="grid grid-cols-2 gap-6">
                    {/* Insurance Card Upload */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-1 rounded-full bg-[#D3BC8D]"></div>
                        <Label className="text-muted-foreground text-base font-semibold">Insurance Card</Label>
                      </div>
                      
                      {/* Current Insurance Card Preview */}
                      {onboarding?.insuranceCardUrl && !insuranceCardFile && (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground font-medium">Current Document</p>
                          <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a] rounded-xl border-2 border-border overflow-hidden shadow-lg hover:border-primary/30 transition-all">
                            {(() => {
                              const trimmedUrl = String(onboarding.insuranceCardUrl).trim();
                              // Check if it's a Google Drive file ID
                              const isGoogleDriveId = trimmedUrl && 
                                !trimmedUrl.includes('/') && 
                                !trimmedUrl.includes('.') && 
                                trimmedUrl.length >= 10 && 
                                /^[a-zA-Z0-9_-]+$/.test(trimmedUrl) &&
                                !trimmedUrl.startsWith('http');
                              const documentUrl = isGoogleDriveId
                                ? buildApiUrl(`/api/cars/documents/file-content?fileId=${encodeURIComponent(trimmedUrl)}`)
                                : trimmedUrl.startsWith('http') 
                                  ? trimmedUrl 
                                  : buildApiUrl(trimmedUrl.startsWith('/') ? trimmedUrl : `/${trimmedUrl}`);
                              const isPdf = isGoogleDriveId
                                ? (trimmedUrl.toLowerCase().includes('pdf') || trimmedUrl.toLowerCase().endsWith('.pdf'))
                                : isPdfDocument(trimmedUrl);
                              
                              return isPdf ? (
                                <div className="w-full h-full flex flex-col items-center justify-center p-4">
                                  <div className="relative">
                                    <FileText className="w-16 h-16 text-primary mb-2" />
                                    <div className="absolute -top-1 -right-1 bg-[#D3BC8D]/20 text-primary text-xs px-2 py-0.5 rounded-full font-bold">
                                      PDF
                                    </div>
                                  </div>
                                  <p className="text-primary text-sm font-semibold">PDF Document</p>
                                  <p className="text-muted-foreground text-xs mt-1 truncate max-w-full px-2">{isGoogleDriveId ? 'Google Drive File' : onboarding.insuranceCardUrl.split("/").pop()}</p>
                                </div>
                              ) : (
                                <img
                                  src={documentUrl}
                                  alt="Current Insurance Card"
                                  className="w-full h-full object-contain p-2"
                                />
                              );
                            })()}
                          </div>
                        </div>
                      )}

                      {/* New Insurance Card Preview */}
                      {insuranceCardFile && (
                        <div className="space-y-2">
                          <p className="text-xs text-primary font-semibold">New Document Selected</p>
                          <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-[#D3BC8D]/10 to-[#D3BC8D]/5 rounded-xl border-2 border-primary/60 overflow-hidden shadow-lg ring-2 ring-[#D3BC8D]/20">
                            {insuranceCardFile.type === 'application/pdf' ? (
                              <div className="w-full h-full flex flex-col items-center justify-center p-4">
                                <div className="relative">
                                  <FileText className="w-16 h-16 text-primary mb-2" />
                                  <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full font-bold">
                                    PDF
                                  </div>
                                </div>
                                <p className="text-primary text-sm font-semibold">PDF Document</p>
                                <p className="text-muted-foreground text-xs mt-1 truncate max-w-full px-2">{insuranceCardFile.name}</p>
                              </div>
                            ) : insuranceCardPreview ? (
                              <div className="relative w-full h-full">
                                <img
                                  src={insuranceCardPreview}
                                  alt="Preview"
                                  className="w-full h-full object-contain p-2"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={handleRemoveInsuranceCard}
                                  className="absolute top-2 right-2 h-8 w-8 bg-red-500/20 text-red-700 border-red-500/50/90 hover:bg-red-500/20 text-red-700 border-red-500/50 text-foreground rounded-full shadow-lg hover:scale-110 transition-transform"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      )}

                      {/* Stylish Upload Button */}
                      <div className="relative">
                        <label
                          htmlFor="insurance-card-input"
                          className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-primary/40 rounded-xl bg-background/50 hover:border-primary/60 hover:bg-primary/5 transition-all cursor-pointer group"
                        >
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload className="w-8 h-8 text-primary mb-2 group-hover:scale-110 transition-transform" />
                            <p className="mb-2 text-sm font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                              {insuranceCardFile ? "Change File" : "Click to Upload"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Image or PDF (Max 10MB)
                            </p>
                          </div>
                          <Input
                            id="insurance-card-input"
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={handleInsuranceCardChange}
                            className="hidden"
                          />
                        </label>
                        {insuranceCardFile && (
                          <p className="text-xs text-primary mt-2 text-center font-medium">
                            ✓ Ready to update
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Drivers License Upload */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-1 rounded-full bg-[#D3BC8D]"></div>
                        <Label className="text-muted-foreground text-base font-semibold">Drivers License</Label>
                      </div>
                      
                      {/* Current Drivers License Previews */}
                      {onboarding?.driversLicenseUrls && Array.isArray(onboarding.driversLicenseUrls) && onboarding.driversLicenseUrls.length > 0 && driversLicenseFiles.length === 0 && (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground font-medium">Current Documents ({onboarding.driversLicenseUrls.length})</p>
                          {onboarding.driversLicenseUrls.length === 1 ? (
                            // Single document - full width to match Insurance Card
                            <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a] rounded-xl border-2 border-border overflow-hidden shadow-lg hover:border-primary/30 transition-all">
                              {(() => {
                                const url = onboarding.driversLicenseUrls[0];
                                // Check if it's a Google Drive file ID
                                const isGoogleDriveId = url && 
                                  !url.includes('/') && 
                                  !url.includes('.') && 
                                  url.length >= 10 && 
                                  /^[a-zA-Z0-9_-]+$/.test(url) &&
                                  !url.startsWith('http');
                                const documentUrl = isGoogleDriveId
                                  ? buildApiUrl(`/api/cars/documents/file-content?fileId=${encodeURIComponent(url)}`)
                                  : url.startsWith('http') ? url : buildApiUrl(url);
                                const isPdf = isGoogleDriveId
                                  ? (url.toLowerCase().includes('pdf') || url.toLowerCase().endsWith('.pdf'))
                                  : isPdfDocument(url);
                                
                                return isPdf ? (
                                  <div className="w-full h-full flex flex-col items-center justify-center p-4">
                                    <div className="relative">
                                      <FileText className="w-16 h-16 text-primary mb-2" />
                                      <div className="absolute -top-1 -right-1 bg-[#D3BC8D]/20 text-primary text-xs px-2 py-0.5 rounded-full font-bold">
                                        PDF
                                      </div>
                                    </div>
                                    <p className="text-primary text-sm font-semibold">PDF Document</p>
                                    <p className="text-muted-foreground text-xs mt-1 truncate max-w-full px-2">{isGoogleDriveId ? 'Google Drive File' : url.split("/").pop()}</p>
                                  </div>
                                ) : (
                                  <img
                                    src={documentUrl}
                                    alt="Drivers License"
                                    className="w-full h-full object-contain p-2"
                                  />
                                );
                              })()}
                            </div>
                          ) : (
                            // Multiple documents - grid layout
                            <div className="grid grid-cols-2 gap-3">
                              {onboarding.driversLicenseUrls.map((url: string, index: number) => {
                                // Check if it's a Google Drive file ID
                                const isGoogleDriveId = url && 
                                  !url.includes('/') && 
                                  !url.includes('.') && 
                                  url.length >= 10 && 
                                  /^[a-zA-Z0-9_-]+$/.test(url) &&
                                  !url.startsWith('http');
                                const documentUrl = isGoogleDriveId
                                  ? buildApiUrl(`/api/cars/documents/file-content?fileId=${encodeURIComponent(url)}`)
                                  : url.startsWith('http') ? url : buildApiUrl(url);
                                const isPdf = isGoogleDriveId
                                  ? (url.toLowerCase().includes('pdf') || url.toLowerCase().endsWith('.pdf'))
                                  : isPdfDocument(url);
                                
                                return (
                                <div key={index} className="relative w-full aspect-[4/3] bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a] rounded-xl border-2 border-border overflow-hidden shadow-lg hover:border-primary/30 transition-all">
                                  {isPdf ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center p-2">
                                      <div className="relative">
                                        <FileText className="w-12 h-12 text-primary mb-1" />
                                        <div className="absolute -top-1 -right-1 bg-[#D3BC8D]/20 text-primary text-xs px-1.5 py-0.5 rounded-full font-bold">
                                          PDF
                                        </div>
                                      </div>
                                      <p className="text-primary text-xs font-semibold">PDF</p>
                                    </div>
                                  ) : (
                                      <img
                                        src={documentUrl}
                                        alt={`License ${index + 1}`}
                                        className="w-full h-full object-contain p-1"
                                      />
                                    )}
                                    <div className="absolute top-1 left-1 bg-background/90 text-primary text-xs px-1.5 py-0.5 rounded font-semibold shadow-lg">
                                      {index + 1}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* New Drivers License Previews */}
                      {driversLicenseFiles.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs text-primary font-semibold">New Documents Selected ({driversLicenseFiles.length})</p>
                          {driversLicenseFiles.length === 1 ? (
                            // Single file - full width to match Insurance Card
                            <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-[#D3BC8D]/10 to-[#D3BC8D]/5 rounded-xl border-2 border-primary/60 overflow-hidden shadow-lg ring-2 ring-[#D3BC8D]/20">
                              {driversLicenseFiles[0].type === 'application/pdf' ? (
                                <div className="w-full h-full flex flex-col items-center justify-center p-4">
                                  <div className="relative">
                                    <FileText className="w-16 h-16 text-primary mb-2" />
                                    <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full font-bold">
                                      PDF
                                    </div>
                                  </div>
                                  <p className="text-primary text-sm font-semibold">PDF Document</p>
                                  <p className="text-muted-foreground text-xs mt-1 truncate max-w-full px-2">{driversLicenseFiles[0].name}</p>
                                </div>
                              ) : driversLicensePreviews[0] && driversLicensePreviews[0] !== 'pdf' ? (
                                <div className="relative w-full h-full">
                                  <img
                                    src={driversLicensePreviews[0]}
                                    alt="Preview"
                                    className="w-full h-full object-contain p-2"
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleRemoveDriversLicense(0)}
                                    className="absolute top-2 right-2 h-8 w-8 bg-red-500/20 text-red-700 border-red-500/50/90 hover:bg-red-500/20 text-red-700 border-red-500/50 text-foreground rounded-full shadow-lg hover:scale-110 transition-transform"
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <p className="text-xs text-muted-foreground">Loading...</p>
                                </div>
                              )}
                            </div>
                          ) : (
                            // Multiple files - grid layout
                            <div className="grid grid-cols-2 gap-3">
                              {driversLicenseFiles.map((file, index) => (
                              <div key={index} className="relative w-full aspect-[4/3] bg-gradient-to-br from-[#D3BC8D]/10 to-[#D3BC8D]/5 rounded-xl border-2 border-primary/60 overflow-hidden shadow-lg ring-2 ring-[#D3BC8D]/20">
                                {file.type === 'application/pdf' ? (
                                  <div className="w-full h-full flex flex-col items-center justify-center p-2">
                                    <div className="relative">
                                      <FileText className="w-12 h-12 text-primary mb-1" />
                                      <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full font-bold">
                                        PDF
                                      </div>
                                    </div>
                                    <p className="text-primary text-xs font-semibold">PDF</p>
                                    <p className="text-muted-foreground text-xs truncate w-full px-1">{file.name}</p>
                                  </div>
                                ) : driversLicensePreviews[index] && driversLicensePreviews[index] !== 'pdf' ? (
                                    <div className="relative w-full h-full">
                                      <img
                                        src={driversLicensePreviews[index]}
                                        alt={`Preview ${index + 1}`}
                                        className="w-full h-full object-contain p-1"
                                      />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleRemoveDriversLicense(index)}
                                        className="absolute top-1 right-1 h-6 w-6 bg-red-500/20 text-red-700 border-red-500/50/90 hover:bg-red-500/20 text-red-700 border-red-500/50 text-foreground rounded-full shadow-lg hover:scale-110 transition-transform"
                                      >
                                        <X className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <p className="text-xs text-muted-foreground">Loading...</p>
                                    </div>
                                  )}
                                  <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded font-bold shadow-lg">
                                    {index + 1}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Stylish Upload Button */}
                      <div className="relative">
                        <label
                          htmlFor="drivers-license-input"
                          className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-primary/40 rounded-xl bg-background/50 hover:border-primary/60 hover:bg-primary/5 transition-all cursor-pointer group"
                        >
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload className="w-8 h-8 text-primary mb-2 group-hover:scale-110 transition-transform" />
                            <p className="mb-2 text-sm font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                              {driversLicenseFiles.length > 0 ? `Change Files (${driversLicenseFiles.length} selected)` : "Click to Upload"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Multiple files allowed (Max 10MB each)
                            </p>
                          </div>
                          <Input
                            id="drivers-license-input"
                            type="file"
                            accept="image/*,application/pdf"
                            multiple
                            onChange={handleDriversLicenseChange}
                            className="hidden"
                          />
                        </label>
                        {driversLicenseFiles.length > 0 && (
                          <p className="text-xs text-primary mt-2 text-center font-medium">
                            ✓ {driversLicenseFiles.length} file(s) ready to update
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsEditModalOpen(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-primary text-primary-foreground hover:bg-primary/80 font-medium"
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? "Updating..." : "Update"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        )}

        {/* Full Screen Image Viewer */}
        {fullScreenImageIndex !== null && car?.photos && car.photos[fullScreenImageIndex] && (
          <div 
            className="fixed inset-0 z-[100] bg-background/98 flex items-center justify-center"
            onClick={() => setFullScreenImageIndex(null)}
          >
            {/* Close Button - Top Right */}
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setFullScreenImageIndex(null);
              }}
              className="fixed top-6 right-6 z-[200] h-12 w-12 bg-background/90 hover:bg-red-500/20 text-red-700 border-red-500/50/90 text-foreground border-2 border-white/60 rounded-full shadow-2xl backdrop-blur-sm transition-all hover:scale-110"
              aria-label="Close full screen view"
            >
              <X className="w-7 h-7" />
            </Button>

            <div className="relative w-full h-full flex items-center justify-center">

              {/* Image Counter - Bottom Center */}
              {car.photos.length > 1 && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[101] bg-background/80 backdrop-blur-sm px-6 py-3 rounded-full border-2 border-white/40 shadow-2xl">
                  <span className="text-foreground text-base font-semibold tracking-wide">
                    {fullScreenImageIndex + 1} / {car.photos.length}
                  </span>
                </div>
              )}

              {/* Full Screen Image - High Resolution Display */}
              {car.photos && car.photos[fullScreenImageIndex] && (
                <img
                  src={getProxiedImageUrl(car.photos[fullScreenImageIndex])}
                  alt={`Car photo ${fullScreenImageIndex + 1}`}
                  className="w-full h-full object-contain"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    maxWidth: '100vw',
                    maxHeight: '100vh',
                  }}
                  onError={(e) => {
                    console.error('Failed to load photo:', car.photos?.[fullScreenImageIndex]);
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
            </div>
          </div>
        )}

        {/* Full Screen Document Viewer Dialog */}
        {fullScreenDocument && (
          <div 
            className="fixed inset-0 z-[100] bg-background/98 flex items-center justify-center"
            onClick={() => setFullScreenDocument(null)}
          >
            {/* Close Button - Top Right Corner */}
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setFullScreenDocument(null);
              }}
              className="fixed top-4 right-4 z-[9999] h-14 w-14 bg-red-500/20 text-red-700 border-red-500/50/90 hover:bg-red-500/20 text-red-700 border-red-500/50 text-foreground border-2 border-white rounded-full shadow-2xl backdrop-blur-sm transition-all hover:scale-110 flex items-center justify-center"
              aria-label="Close full screen view"
              style={{
                position: 'fixed',
                top: '1rem',
                right: '1rem',
                zIndex: 9999,
              }}
            >
              <X className="w-8 h-8" strokeWidth={3} />
            </Button>

            <div className="relative w-full h-full flex items-center justify-center p-8">
              {/* Image Counter - Bottom Center (for multiple drivers licenses) */}
              {fullScreenDocument.type === 'license' && 
               validDriversLicenseUrls.length > 1 && 
               fullScreenDocument.index !== undefined && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[101] bg-background/80 backdrop-blur-sm px-6 py-3 rounded-full border-2 border-white/40 shadow-2xl">
                  <span className="text-foreground text-base font-semibold tracking-wide">
                    {fullScreenDocument.index + 1} / {validDriversLicenseUrls.length}
                  </span>
                </div>
              )}

              {/* Navigation Buttons (for multiple drivers licenses) */}
              {fullScreenDocument.type === 'license' && 
               validDriversLicenseUrls.length > 1 && 
               fullScreenDocument.index !== undefined && (
                <>
                  {/* Previous Button */}
                  {fullScreenDocument.index > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        const prevIndex = fullScreenDocument.index! - 1;
                        const prevUrl = validDriversLicenseUrls[prevIndex];
                        // Check if it's a Google Drive file ID
                        const isGoogleDriveId = prevUrl && 
                          !prevUrl.includes('/') && 
                          !prevUrl.includes('.') && 
                          prevUrl.length >= 10 && 
                          /^[a-zA-Z0-9_-]+$/.test(prevUrl) &&
                          !prevUrl.startsWith('http');
                        const imageUrl = isGoogleDriveId
                          ? buildApiUrl(`/api/cars/documents/file-content?fileId=${encodeURIComponent(prevUrl)}`)
                          : prevUrl.startsWith('http') ? prevUrl : buildApiUrl(prevUrl.startsWith('/') ? prevUrl : `/${prevUrl}`);
                        setFullScreenDocument({ 
                          url: imageUrl, 
                          type: 'license', 
                          index: prevIndex,
                          isPdf: isGoogleDriveId 
                            ? (prevUrl.toLowerCase().includes('pdf') || prevUrl.toLowerCase().endsWith('.pdf'))
                            : isPdfDocument(prevUrl)
                        });
                      }}
                      className="fixed left-6 top-1/2 -translate-y-1/2 z-[200] h-14 w-14 bg-background/90 hover:bg-muted/50D3BC8D]/20 text-foreground border-2 border-white/60 rounded-full shadow-2xl backdrop-blur-sm transition-all hover:scale-110"
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </Button>
                  )}

                  {/* Next Button */}
                  {fullScreenDocument.index < validDriversLicenseUrls.length - 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        const nextIndex = fullScreenDocument.index! + 1;
                        const nextUrl = validDriversLicenseUrls[nextIndex];
                        // Check if it's a Google Drive file ID
                        const isGoogleDriveId = nextUrl && 
                          !nextUrl.includes('/') && 
                          !nextUrl.includes('.') && 
                          nextUrl.length >= 10 && 
                          /^[a-zA-Z0-9_-]+$/.test(nextUrl) &&
                          !nextUrl.startsWith('http');
                        const imageUrl = isGoogleDriveId
                          ? buildApiUrl(`/api/cars/documents/file-content?fileId=${encodeURIComponent(nextUrl)}`)
                          : nextUrl.startsWith('http') ? nextUrl : buildApiUrl(nextUrl.startsWith('/') ? nextUrl : `/${nextUrl}`);
                        setFullScreenDocument({ 
                          url: imageUrl, 
                          type: 'license', 
                          index: nextIndex,
                          isPdf: isGoogleDriveId
                            ? (nextUrl.toLowerCase().includes('pdf') || nextUrl.toLowerCase().endsWith('.pdf'))
                            : isPdfDocument(nextUrl)
                        });
                      }}
                      className="fixed right-6 top-1/2 -translate-y-1/2 z-[200] h-14 w-14 bg-background/90 hover:bg-muted/50D3BC8D]/20 text-foreground border-2 border-white/60 rounded-full shadow-2xl backdrop-blur-sm transition-all hover:scale-110"
                      aria-label="Next image"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </Button>
                  )}
                </>
              )}

              {/* Full Screen Document Display - PDF or Image */}
              {fullScreenDocument.isPdf ? (
                <iframe
                  src={fullScreenDocument.url}
                  className="w-full h-full border-0"
                  style={{
                    maxWidth: '100vw',
                    maxHeight: '100vh',
                  }}
                  onClick={(e) => e.stopPropagation()}
                  title={fullScreenDocument.type === 'insurance' ? 'Insurance Card PDF' : `Drivers License PDF ${fullScreenDocument.index !== undefined ? fullScreenDocument.index + 1 : ''}`}
                />
              ) : (
                <img
                  src={fullScreenDocument.url}
                  alt={fullScreenDocument.type === 'insurance' ? 'Insurance Card' : `Drivers License ${fullScreenDocument.index !== undefined ? fullScreenDocument.index + 1 : ''}`}
                  className="w-full h-full object-contain"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    maxWidth: '100vw',
                    maxHeight: '100vh',
                  }}
                  onError={(e) => {
                    console.error('Failed to load image in full screen viewer:', fullScreenDocument.url);
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
