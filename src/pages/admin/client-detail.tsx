import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { AdminLayout } from "@/components/admin/admin-layout";
import { ClientDetailSkeleton } from "@/components/ui/skeletons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Car,
  FileText,
  Mail,
  Phone,
  Calendar,
  User,
  ChevronDown,
  ChevronRight,
  Download,
  Wrench,
  DollarSign,
  Eye,
  Link as LinkIcon,
  ExternalLink,
  Folder,
  ChevronUp,
  Plus,
  Minus,
  Edit,
  Upload,
  Trash2,
} from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import QuickLinks from "@/components/admin/QuickLinks";
import { getOnlineStatusBadge, formatLastLogin } from "@/lib/onlineStatus";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AddEditBankingInfoModal } from "@/components/modals/AddEditBankingInfoModal";

interface ClientDetail {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  bankName?: string;
  bankRoutingNumber?: string;
  bankAccountNumber?: string;
  roleId: number;
  roleName: string;
  isActive: boolean;
  createdAt: string;
  userId?: number | null;
  lastLoginAt?: string | null;
  lastLogoutAt?: string | null;
  status?: number; // 0 = inactive, 1 = active, 3 = blocked
  carCount: number;
  cars: Array<{
    id: number;
    vin: string;
    makeModel: string;
    make?: string;
    model?: string;
    licensePlate?: string;
    year?: number;
    mileage: number;
    status: string;
    createdAt: string;
    tireSize?: string | null;
    oilType?: string | null;
    lastOilChange?: string | null;
    fuelType?: string | null;
    registrationExpiration?: string | null;
    owner?: {
      firstName?: string;
      lastName?: string;
      email?: string | null;
      phone?: string | null;
    } | null;
    contactPhone?: string | null;
  }>;
  onboarding?: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    contractStatus?: "pending" | "sent" | "opened" | "signed" | "declined" | null;
    contractSignedAt?: string | null;
    contractToken?: string | null;
    createdAt: string;
  } | null;
  signedContracts?: Array<{
    id: number;
    firstNameOwner: string;
    lastNameOwner: string;
    emailOwner: string;
    vehicleYear?: string;
    vehicleMake?: string;
    vehicleModel?: string;
    vinNumber?: string;
    licensePlate?: string;
    contractStatus: string;
    contractSignedAt?: string;
    signedContractUrl?: string;
    createdAt: string;
  }>;
}

type Section = "profile" | "cars" | "totals" | "maintenance";

export default function ClientDetailPage() {
  const [, params] = useRoute("/admin/clients/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const clientId = params?.id ? parseInt(params.id, 10) : null;
  const [activeSection, setActiveSection] = useState<Section>("profile");
  const [expandedSections, setExpandedSections] = useState<Set<Section>>(
    new Set(["profile"])
  );
  const [expandedTotals, setExpandedTotals] = useState<Set<string>>(new Set());
  const [quickLinksExpanded, setQuickLinksExpanded] = useState(true);
  const [viewMyCarExpanded, setViewMyCarExpanded] = useState(true);
  const [maintenanceTypeFilter, setMaintenanceTypeFilter] = useState<string>("all");
  const [maintenanceStatusFilter, setMaintenanceStatusFilter] = useState<string>("all");
  const [maintenanceDateFilter, setMaintenanceDateFilter] = useState<string>("");
  
  // Totals filters
  const [selectedCar, setSelectedCar] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("2025");
  const [fromYear, setFromYear] = useState<string>("2025");
  const [toYear, setToYear] = useState<string>("2025");
  
  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  
  // Upload contract modal state
  const [isUploadContractOpen, setIsUploadContractOpen] = useState(false);
  const [uploadContractFormErrors, setUploadContractFormErrors] = useState<{ selectedCarId?: string; contractFile?: string }>({});
  const [uploadContractForm, setUploadContractForm] = useState({
    contractFile: null as File | null,
    selectedCarId: "" as string,
  });
  
  // Add car modal state
  const [isAddCarOpen, setIsAddCarOpen] = useState(false);
  const [addCarFormErrors, setAddCarFormErrors] = useState<{ vin?: string }>({});
  
  // Banking info modal state
  const [isBankingModalOpen, setIsBankingModalOpen] = useState(false);
  const [editingBankingInfo, setEditingBankingInfo] = useState<any>(null);
  const [deletingBankingId, setDeletingBankingId] = useState<number | null>(null);
  
  const [addCarForm, setAddCarForm] = useState({
    vin: "",
    make: "",
    model: "",
    year: "",
    licensePlate: "",
    mileage: "",
    color: "",
    interiorColor: "",
    status: "ACTIVE",
    tireSize: "",
    oilType: "",
    lastOilChange: "",
    fuelType: "",
    gas: "",
    turoLink: "",
    adminTuroLink: "",
    // Extended Vehicle Information
    vehicleTrim: "",
    registrationExpiration: "",
    titleType: "",
    vehicleRecall: "",
    numberOfSeats: "",
    numberOfDoors: "",
    skiRacks: "",
    skiCrossBars: "",
    roofRails: "",
    freeDealershipOilChanges: "",
    oilPackageDetails: "",
    dealershipAddress: "",
    vehicleFeatures: [] as string[],
    // Financial Information
    purchasePrice: "",
    downPayment: "",
    monthlyPayment: "",
    interestRate: "",
    transportCityToCity: "",
    ultimateGoal: "",
    // Insurance Information
    insuranceProvider: "",
    insurancePhone: "",
    policyNumber: "",
    insuranceExpiration: "",
    // Car Login Information
    carManufacturerWebsite: "",
    carManufacturerUsername: "",
    password: "",
  });
  
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<{
    success: boolean;
    data: ClientDetail;
  }>({
    queryKey: ["/api/clients", clientId],
    queryFn: async () => {
      if (!clientId) throw new Error("Invalid client ID");
      const url = buildApiUrl(`/api/clients/${clientId}`);
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch client: ${response.statusText}`);
      }
      const result = await response.json();
      // Log summary including lastLoginAt and lastLogoutAt for debugging
      console.log("✅ [CLIENT DETAIL] Fetched client data:", {
        id: result.data?.id,
        email: result.data?.email,
        name: result.data?.firstName + " " + result.data?.lastName,
        lastLoginAt: result.data?.lastLoginAt,
        lastLogoutAt: result.data?.lastLogoutAt,
        isActive: result.data?.isActive,
        status: result.data?.status,
        userId: result.data?.userId,
      });
      return result;
    },
    enabled: !!clientId,
    retry: false,
    // Poll backend every 2 seconds to get updated lastLoginAt/lastLogoutAt values immediately
    // This ensures login/logout events are reflected within 2 seconds
    refetchInterval: 2000,
    // Refetch when window regains focus
    refetchOnWindowFocus: true,
    // Refetch when browser tab becomes visible
    refetchOnMount: true,
  });

  // Fetch onboarding submission data
  const { data: onboardingData, isLoading: isLoadingOnboarding } = useQuery<{
    success: boolean;
    data: any;
  }>({
    queryKey: ["/api/clients", clientId, "onboarding"],
    queryFn: async () => {
      if (!clientId) throw new Error("Invalid client ID");
      const url = buildApiUrl(`/api/clients/${clientId}/onboarding`);
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
    enabled: !!clientId,
    retry: false,
  });

  // Fetch banking information for the client
  const { data: bankingInfoData, isLoading: isLoadingBankingInfo } = useQuery<any[]>({
    queryKey: [`/api/clients/${clientId}/banking-info`],
    queryFn: async () => {
      if (!clientId) return [];
      const url = buildApiUrl(`/api/clients/${clientId}/banking-info`);
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) {
        console.error("Failed to fetch banking info");
        return [];
      }
      const result = await response.json();
      return result;
    },
    enabled: !!clientId,
    retry: false,
  });

  // Show error toast when query fails
  useEffect(() => {
    if (error) {
      console.error("❌ [CLIENT DETAIL] Error fetching client:", error);
      toast({
        title: "Error loading client",
        description: error instanceof Error ? error.message : "Failed to load client details",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const client = data?.data;

  // Calculate online status badge (moved to top level to avoid hooks violation)
  const onlineStatusBadge = useMemo(() => {
    if (!client) {
      return null;
    }
    
    // Online Status is based ONLY on login/logout activity, NOT on account status
    // No time threshold - status changes immediately based on login/logout events
    const onlineStatus = getOnlineStatusBadge(
      client.lastLoginAt,
      client.lastLogoutAt // lastLogoutAt - if exists and more recent than login, user is offline
    );
    
    return onlineStatus;
  }, [client?.lastLoginAt, client?.lastLogoutAt]);

  // Fetch totals data
  const { data: totalsData, isLoading: totalsLoading } = useQuery<{
    success: boolean;
    data: any;
  }>({
    queryKey: ["/api/clients", clientId, "totals", selectedCar, selectedYear, fromYear, toYear],
    queryFn: async () => {
      if (!clientId) throw new Error("Invalid client ID");
      const url = buildApiUrl(`/api/clients/${clientId}/totals?car=${selectedCar}&year=${selectedYear}&from=${fromYear}&to=${toYear}`);
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) {
        // Return empty data if endpoint doesn't exist yet
        return { success: true, data: null };
      }
      return response.json();
    },
    enabled: !!clientId && activeSection === "totals",
    retry: false,
  });

  const totals = totalsData?.data || null;

  const toggleSection = (section: Section) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const toggleTotalsCategory = (category: string) => {
    setExpandedTotals((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  // Update mutation for editing onboarding data
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!clientId) throw new Error("Invalid client ID");
      
      // Determine which endpoint to use based on whether onboarding data exists
      const hasOnboardingData = onboardingData?.success && onboardingData?.data;
      const endpoint = hasOnboardingData 
        ? `/api/clients/${clientId}/onboarding`
        : `/api/clients/${clientId}`;
      
      // Transform data for the client endpoint if no onboarding data
      // Send all fields so the backend can create/update onboarding record
      const body = hasOnboardingData ? data : {
        firstName: data.firstNameOwner,
        lastName: data.lastNameOwner,
        email: data.emailOwner,
        phone: data.phoneOwner,
        birthday: data.birthday,
        tshirtSize: data.tshirtSize,
        ssn: data.ssn,
        representative: data.representative,
        heardAboutUs: data.heardAboutUs,
        emergencyContactName: data.emergencyContactName,
        emergencyContactPhone: data.emergencyContactPhone,
        streetAddress: data.streetAddress,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        vehicleYear: data.vehicleYear,
        vehicleMake: data.vehicleMake,
        vehicleModel: data.vehicleModel,
        vinNumber: data.vinNumber,
        licensePlate: data.licensePlate,
        vehicleMiles: data.vehicleMiles,
        bankName: data.bankName,
        taxClassification: data.taxClassification,
        bankRoutingNumber: data.routingNumber,
        bankAccountNumber: data.accountNumber,
        businessName: data.businessName,
        ein: data.ein,
        // Financial Information
        purchasePrice: data.purchasePrice,
        downPayment: data.downPayment,
        monthlyPayment: data.monthlyPayment,
        interestRate: data.interestRate,
        transportCityToCity: data.transportCityToCity,
        ultimateGoal: data.ultimateGoal,
        // Insurance Information
        insuranceProvider: data.insuranceProvider,
        insurancePhone: data.insurancePhone,
        policyNumber: data.policyNumber,
        insuranceExpiration: data.insuranceExpiration,
        // Additional Information
        carManufacturerWebsite: data.carManufacturerWebsite,
        carManufacturerUsername: data.carManufacturerUsername,
        // Client Status
        status: data.status,
      };
      
      const response = await fetch(buildApiUrl(endpoint), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update client data");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId, "onboarding"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId] });
      toast({
        title: "Success",
        description: "Client details updated successfully",
      });
      setIsEditModalOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update client details",
        variant: "destructive",
      });
    },
  });

  const CONTRACT_MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

  // Upload contract mutation
  const uploadContractMutation = useMutation({
    mutationFn: async (formData: typeof uploadContractForm) => {
      if (!clientId) throw new Error("Invalid client ID");
      if (!formData.contractFile) throw new Error("Please select a PDF file to upload");
      if (formData.contractFile.size > CONTRACT_MAX_SIZE_BYTES) {
        setUploadContractFormErrors({ contractFile: "You can upload files under 10MB" });
        throw new Error("You can upload files under 10MB");
      }
      if (!formData.selectedCarId) {
        setUploadContractFormErrors({ selectedCarId: "Please select a car" });
        throw new Error("Please select a car");
      }
      
      setUploadContractFormErrors({});

      // Get client data from query cache to ensure we have the latest data
      const clientQueryData = queryClient.getQueryData<{
        success: boolean;
        data: ClientDetail;
      }>(["/api/clients", clientId]);
      
      const client = clientQueryData?.data;
      
      // Check if the selected car has already been onboarded
      const onboardedVins = new Set(
        (client?.signedContracts || [])
          .map((contract: any) => contract.vinNumber?.toUpperCase().trim())
          .filter((vin: string) => vin)
      );
      
      const selectedCar = client?.cars?.find(
        (car: any) => car.id === parseInt(formData.selectedCarId)
      );

      if (!selectedCar) {
        setUploadContractFormErrors({ selectedCarId: "Selected car not found" });
        throw new Error("Selected car not found");
      }
      
      // Verify the selected car is not already onboarded
      const carVin = selectedCar.vin?.toUpperCase().trim();
      if (carVin && onboardedVins.has(carVin)) {
        setUploadContractFormErrors({ selectedCarId: "This car has already been onboarded" });
        throw new Error("This car has already been onboarded. Please select a different car.");
      }

      const requestFormData = new FormData();
      requestFormData.append("contract", formData.contractFile);
      
      // Append vehicle information from selected car
      if (selectedCar.vin) {
        requestFormData.append("vinNumber", selectedCar.vin);
      }
      if (selectedCar.year) {
        requestFormData.append("vehicleYear", selectedCar.year.toString());
      }
      if (selectedCar.make) {
        requestFormData.append("vehicleMake", selectedCar.make);
      }
      if (selectedCar.model) {
        requestFormData.append("vehicleModel", selectedCar.model);
      }
      if (selectedCar.licensePlate) {
        requestFormData.append("licensePlate", selectedCar.licensePlate);
      }

      const response = await fetch(buildApiUrl(`/api/clients/${clientId}/contracts`), {
        method: "POST",
        credentials: "include",
        body: requestFormData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload contract");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId] });
      toast({ title: "Success", description: "Contract uploaded successfully" });
      setIsUploadContractOpen(false);
      setUploadContractFormErrors({});
      setUploadContractForm({
        contractFile: null,
        selectedCarId: "",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload contract",
        variant: "destructive",
      });
    },
  });

  // Resend password email mutation
  const resendPasswordEmailMutation = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error("Invalid client ID");
      const response = await fetch(buildApiUrl(`/api/clients/${clientId}/resend-password-email`), {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send password email");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Password creation email has been sent successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send password email",
        variant: "destructive",
      });
    },
  });

  const handleResendPasswordEmail = () => {
    resendPasswordEmailMutation.mutate();
  };

  // Add car mutation
  const addCarMutation = useMutation({
    mutationFn: async (data: typeof addCarForm) => {
      if (!clientId) throw new Error("Invalid client ID");
      
      // Validate VIN number
      const vinErrors: { vin?: string } = {};
      if (!data.vin || data.vin.trim().length === 0) {
        vinErrors.vin = "VIN number is required";
      } else if (data.vin.trim().length !== 17) {
        vinErrors.vin = "VIN number must be exactly 17 characters";
      }
      
      if (Object.keys(vinErrors).length > 0) {
        setAddCarFormErrors(vinErrors);
        throw new Error(vinErrors.vin || "VIN validation failed");
      }
      
      setAddCarFormErrors({});
      
      const formData = new FormData();
      // Vehicle Information
      formData.append("vin", data.vin);
      formData.append("makeModel", `${data.make} ${data.model}`.trim());
      if (data.make) formData.append("make", data.make);
      if (data.model) formData.append("model", data.model);
      if (data.licensePlate) formData.append("licensePlate", data.licensePlate);
      if (data.year) formData.append("year", data.year);
      if (data.color) formData.append("color", data.color);
      if (data.interiorColor) formData.append("interiorColor", data.interiorColor);
      if (data.mileage) formData.append("mileage", data.mileage);
      formData.append("status", data.status || "ACTIVE");
      // Extended Vehicle Information
      if (data.vehicleTrim) formData.append("vehicleTrim", data.vehicleTrim);
      if (data.registrationExpiration) formData.append("registrationExpiration", data.registrationExpiration);
      if (data.titleType) formData.append("titleType", data.titleType);
      if (data.vehicleRecall) formData.append("vehicleRecall", data.vehicleRecall);
      if (data.numberOfSeats) formData.append("numberOfSeats", data.numberOfSeats);
      if (data.numberOfDoors) formData.append("numberOfDoors", data.numberOfDoors);
      if (data.skiRacks) formData.append("skiRacks", data.skiRacks);
      if (data.skiCrossBars) formData.append("skiCrossBars", data.skiCrossBars);
      if (data.roofRails) formData.append("roofRails", data.roofRails);
      if (data.oilType) formData.append("oilType", data.oilType);
      if (data.lastOilChange) formData.append("lastOilChange", data.lastOilChange);
      if (data.freeDealershipOilChanges) formData.append("freeDealershipOilChanges", data.freeDealershipOilChanges);
      if (data.oilPackageDetails) formData.append("oilPackageDetails", data.oilPackageDetails);
      if (data.dealershipAddress) formData.append("dealershipAddress", data.dealershipAddress);
      if (data.fuelType) formData.append("fuelType", data.fuelType);
      if (data.tireSize) formData.append("tireSize", data.tireSize);
      if (data.vehicleFeatures && Array.isArray(data.vehicleFeatures) && data.vehicleFeatures.length > 0) {
        formData.append("vehicleFeatures", data.vehicleFeatures.join(", "));
      }
      // Financial Information
      if (data.purchasePrice) formData.append("purchasePrice", data.purchasePrice);
      if (data.downPayment) formData.append("downPayment", data.downPayment);
      if (data.monthlyPayment) formData.append("monthlyPayment", data.monthlyPayment);
      if (data.interestRate) formData.append("interestRate", data.interestRate);
      if (data.transportCityToCity) formData.append("transportCityToCity", data.transportCityToCity);
      if (data.ultimateGoal) formData.append("ultimateGoal", data.ultimateGoal);
      // Insurance Information
      if (data.insuranceProvider) formData.append("insuranceProvider", data.insuranceProvider);
      if (data.insurancePhone) formData.append("insurancePhone", data.insurancePhone);
      if (data.policyNumber) formData.append("policyNumber", data.policyNumber);
      if (data.insuranceExpiration) formData.append("insuranceExpiration", data.insuranceExpiration);
      // Car Login Information
      if (data.carManufacturerWebsite) formData.append("carManufacturerWebsite", data.carManufacturerWebsite);
      if (data.carManufacturerUsername) formData.append("carManufacturerUsername", data.carManufacturerUsername);
      if (data.password) formData.append("password", data.password);
      // Car Links
      if (data.turoLink) formData.append("turoLink", data.turoLink);
      if (data.adminTuroLink) formData.append("adminTuroLink", data.adminTuroLink);

      const response = await fetch(buildApiUrl(`/api/clients/${clientId}/cars`), {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add car");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId] });
      toast({ title: "Success", description: "Car added successfully" });
      setIsAddCarOpen(false);
      setAddCarFormErrors({});
      setAddCarForm({ 
        vin: "", 
        make: "", 
        model: "", 
        year: "", 
        licensePlate: "", 
        mileage: "",
        color: "",
        interiorColor: "",
        status: "ACTIVE",
        tireSize: "",
        oilType: "",
        lastOilChange: "",
        fuelType: "",
        gas: "",
        turoLink: "",
        adminTuroLink: "",
        vehicleTrim: "",
        registrationExpiration: "",
        titleType: "",
        vehicleRecall: "",
        numberOfSeats: "",
        numberOfDoors: "",
        skiRacks: "",
        skiCrossBars: "",
        roofRails: "",
        freeDealershipOilChanges: "",
        oilPackageDetails: "",
        dealershipAddress: "",
        vehicleFeatures: [] as string[],
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
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add car",
        variant: "destructive",
      });
    },
  });

  // Delete banking info mutation
  const deleteBankingInfoMutation = useMutation({
    mutationFn: async (bankingInfoId: number) => {
      const response = await fetch(
        buildApiUrl(`/api/clients/banking-info/${bankingInfoId}`),
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete banking information");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId] });
      queryClient.invalidateQueries({
        queryKey: [`/api/clients/${clientId}/banking-info`],
      });
      toast({
        title: "Success",
        description: "Banking information deleted successfully",
      });
      setDeletingBankingId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle edit button click
  const handleEditClick = () => {
    if (onboardingData?.success && onboardingData?.data) {
      // Client has onboarding data - use it
      const data = onboardingData.data;
      setEditFormData({
        firstNameOwner: data.firstNameOwner || "",
        lastNameOwner: data.lastNameOwner || "",
        emailOwner: data.emailOwner || "",
        phoneOwner: data.phoneOwner || "",
        birthday: data.birthday || "",
        tshirtSize: data.tshirtSize || "",
        ssn: data.ssn || "",
        representative: data.representative || "",
        heardAboutUs: data.heardAboutUs || "",
        emergencyContactName: data.emergencyContactName || "",
        emergencyContactPhone: data.emergencyContactPhone || "",
        status: client?.status !== undefined ? (client.status === 0 ? "ACTIVE" : "INACTIVE") : "ACTIVE",
        streetAddress: data.streetAddress || "",
        city: data.city || "",
        state: data.state || "",
        zipCode: data.zipCode || "",
        vehicleYear: data.vehicleYear || "",
        vehicleMake: data.vehicleMake || "",
        vehicleModel: data.vehicleModel || "",
        vinNumber: data.vinNumber || "",
        licensePlate: data.licensePlate || "",
        vehicleMiles: data.vehicleMiles || "",
        bankName: data.bankName || "",
        taxClassification: data.taxClassification || "",
        routingNumber: data.routingNumber || "",
        accountNumber: data.accountNumber || "",
        businessName: data.businessName || "",
        ein: data.ein || "",
        // Financial Information
        purchasePrice: data.purchasePrice || "",
        downPayment: data.downPayment || "",
        monthlyPayment: data.monthlyPayment || "",
        interestRate: data.interestRate || "",
        transportCityToCity: data.transportCityToCity || "",
        ultimateGoal: data.ultimateGoal || "",
        // Insurance Information
        insuranceProvider: data.insuranceProvider || "",
        insurancePhone: data.insurancePhone || "",
        policyNumber: data.policyNumber || "",
        insuranceExpiration: data.insuranceExpiration || "",
        // Additional Information
        carManufacturerWebsite: data.carManufacturerWebsite || "",
        carManufacturerUsername: data.carManufacturerUsername || "",
      });
    } else if (client) {
      // Manually created client - use client data
      setEditFormData({
        firstNameOwner: client?.firstName || "",
        lastNameOwner: client?.lastName || "",
        emailOwner: client?.email || "",
        phoneOwner: client?.phone || "",
        birthday: "",
        tshirtSize: "",
        ssn: "",
        representative: "",
        heardAboutUs: "",
        emergencyContactName: "",
        emergencyContactPhone: "",
        status: client?.status !== undefined ? (client.status === 0 ? "ACTIVE" : "INACTIVE") : "ACTIVE",
        streetAddress: "",
        city: "",
        state: "",
        zipCode: "",
        vehicleYear: "",
        vehicleMake: "",
        vehicleModel: "",
        vinNumber: "",
        licensePlate: "",
        vehicleMiles: "",
        bankName: client?.bankName || "",
        taxClassification: "",
        routingNumber: client?.bankRoutingNumber || "",
        accountNumber: client?.bankAccountNumber || "",
        businessName: "",
        ein: "",
        // Financial Information
        purchasePrice: "",
        downPayment: "",
        monthlyPayment: "",
        interestRate: "",
        transportCityToCity: "",
        ultimateGoal: "",
        // Insurance Information
        insuranceProvider: "",
        insurancePhone: "",
        policyNumber: "",
        insuranceExpiration: "",
        // Additional Information
        carManufacturerWebsite: "",
        carManufacturerUsername: "",
      });
    }
    setIsEditModalOpen(true);
  };

  // Handle edit form submission
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(editFormData);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "N/A";
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <ClientDetailSkeleton />
      </AdminLayout>
    );
  }

  // Test DB connection handler
  const handleTestDB = async () => {
    try {
      const response = await fetch(buildApiUrl(`/api/test-db?clientId=${clientId}`), {
        credentials: "include",
      });
      const result = await response.json();
      if (result.success) {
        toast({
          title: "✅ Database Connection Successful",
          description: result.message || "Successfully connected to database",
        });
      } else {
        toast({
          title: "❌ Database Connection Failed",
          description: result.error || "Failed to connect to database",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "❌ Database Connection Error",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  if (error || !client) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <p className="text-red-700 mb-4">
            {error ? `Failed to load client details: ${error.message}` : "Client not found"}
          </p>
          {clientId && (
            <Button
              onClick={handleTestDB}
              className="bg-blue-500 text-foreground hover:bg-blue-600 mb-2"
            >
              Test DB Connection
            </Button>
          )}
          <Button
            onClick={() => setLocation("/admin/clients")}
            className="bg-primary text-primary-foreground hover:bg-primary/80"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Clients
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const sections: Array<{ id: Section; label: string; icon: any }> = [
    { id: "profile", label: "Profile", icon: User },
    { id: "cars", label: "Cars", icon: Car },
    { id: "totals", label: "Totals", icon: DollarSign },
    { id: "maintenance", label: "Car Maintenance", icon: Wrench },
  ];

  const primaryCar = client.cars && client.cars.length > 0 ? client.cars[0] : null;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => setLocation("/admin/clients")}
            className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Clients</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
          {client.firstName} {client.lastName}
        </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Client Details
            </p>
          </div>
        </div>

        {/* Main Layout: Sidebar + Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar */}
          <div className="lg:col-span-1">
            <Card className="bg-background border-border">
              <CardContent className="p-0">
                <nav className="space-y-1 p-2">
                  {sections.map((section) => {
                    const Icon = section.icon;
                    const isExpanded = expandedSections.has(section.id);
                    const isActive = activeSection === section.id;

                    return (
                      <div key={section.id}>
                        <button
                          onClick={() => {
                            toggleSection(section.id);
                            setActiveSection(section.id);
                          }}
                          className={cn(
                            "w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors",
                            isActive
                              ? "bg-[#D3BC8D]/10 text-black"
                              : "text-muted-foreground hover:bg-card hover:text-primary"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <Icon className="w-4 h-4" />
                            <span className="text-sm font-medium">{section.label}</span>
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Right Content Area */}
          <div className="lg:col-span-3">
            {activeSection === "profile" && (
              <Card className="bg-background border-border">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-primary text-xl">Client Details</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={handleResendPasswordEmail}
                        variant="outline"
                        size="sm"
                        className="text-primary border-primary/30 hover:bg-primary/10"
                        disabled={resendPasswordEmailMutation.isPending}
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        {resendPasswordEmailMutation.isPending ? "Sending..." : "Send Password Email"}
                      </Button>
                      <Button
                        onClick={handleEditClick}
                        variant="outline"
                        size="sm"
                        className="text-primary border-primary/30 hover:bg-primary/10"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isLoadingOnboarding ? (
                    <div className="text-center py-8 text-muted-foreground space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-4 bg-muted/50 rounded animate-pulse w-3/4 mx-auto" />
                      ))}
                    </div>
                  ) : onboardingData?.success && onboardingData?.data ? (
                    (() => {
                      const formatValue = (value: any): string => {
                        if (value === null || value === undefined || value === "")
                          return "Not provided";
                        return String(value);
                      };

                      const formatDate = (dateStr: string | null | undefined): string => {
                        if (!dateStr) return "Not provided";
                        try {
                          return new Date(dateStr).toLocaleString();
                        } catch {
                          return String(dateStr);
                        }
                      };

                      const formatCurrency = (value: string | null): string => {
                        if (!value) return "Not provided";
                        const num = parseFloat(value);
                        if (isNaN(num)) return value;
                        return `$${num.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`;
                      };

                      const formatAddress = (
                        city: string | null | undefined,
                        state: string | null | undefined,
                        zipCode: string | null | undefined
                      ): string => {
                        const parts: string[] = [];
                        if (city) parts.push(city);
                        if (state) parts.push(state);
                        if (zipCode) parts.push(zipCode);
                        return parts.length > 0 ? parts.join(", ") : "Not provided";
                      };

                      const data = onboardingData.data;

                      return (
                        <>
                          {/* Personal Information */}
                          <div className="bg-card p-4 rounded-lg border border-primary/20">
                            <h3 className="text-lg font-semibold text-primary mb-4 pb-2 border-b border-primary/30">
                              Personal Information
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground block mb-1">Full Name:</span>
                                <span className="text-foreground font-medium">
                                  {formatValue(data.firstNameOwner)} {formatValue(data.lastNameOwner)}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block mb-1">Email:</span>
                                <span className="text-foreground">{formatValue(data.emailOwner)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block mb-1">Last Login:</span>
                                <span className="text-foreground">{formatLastLogin(client?.lastLoginAt)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block mb-1">Online Status:</span>
                                <Badge
                                  variant="outline"
                                  className={getOnlineStatusBadge(
                                    client?.lastLoginAt,
                                    client?.lastLogoutAt // lastLogoutAt - if exists and more recent than login, user is offline
                                  ).className}
                                >
                                  {getOnlineStatusBadge(
                                    client?.lastLoginAt,
                                    client?.lastLogoutAt // lastLogoutAt - if exists and more recent than login, user is offline
                                  ).text}
                                </Badge>
                              </div>
                              <div>
                                <span className="text-muted-foreground block mb-1">Phone:</span>
                                <span className="text-foreground">{formatValue(data.phoneOwner)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block mb-1">Date of Birth:</span>
                                <span className="text-foreground">{formatValue(data.birthday)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block mb-1">T-Shirt Size:</span>
                                <span className="text-foreground">{formatValue(data.tshirtSize)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block mb-1">SSN:</span>
                                <span className="text-foreground font-mono">{formatValue(data.ssn)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block mb-1">Representative:</span>
                                <span className="text-foreground">{formatValue(data.representative)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block mb-1">How Did You Hear About Us:</span>
                                <span className="text-foreground">{formatValue(data.heardAboutUs)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block mb-1">Emergency Contact Name:</span>
                                <span className="text-foreground">{formatValue(data.emergencyContactName)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block mb-1">Emergency Contact Phone:</span>
                                <span className="text-foreground">{formatValue(data.emergencyContactPhone)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Address Information */}
                          <div className="bg-card p-4 rounded-lg border border-primary/20">
                            <h3 className="text-lg font-semibold text-primary mb-4 pb-2 border-b border-primary/30">
                              Address Information
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div className="md:col-span-2">
                                <span className="text-muted-foreground block mb-1">Street Address:</span>
                                <span className="text-foreground">{formatValue(data.streetAddress)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block mb-1">City:</span>
                                <span className="text-foreground">{formatValue(data.city)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block mb-1">State:</span>
                                <span className="text-foreground">{formatValue(data.state)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block mb-1">Zip Code:</span>
                                <span className="text-foreground">{formatValue(data.zipCode)}</span>
                              </div>
                              <div className="md:col-span-2">
                                <span className="text-muted-foreground block mb-1">Full Address:</span>
                                <span className="text-foreground">
                                  {formatAddress(data.city, data.state, data.zipCode)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Banking Information */}
                          <div className="bg-card p-4 rounded-lg border border-primary/20">
                            <div className="flex items-center justify-between mb-4 pb-2 border-b border-primary/30">
                              <h3 className="text-lg font-semibold text-primary">
                                Banking Information (ACH)
                              </h3>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-primary border-primary/30 hover:bg-primary/10"
                                onClick={() => {
                                  setEditingBankingInfo(null);
                                  setIsBankingModalOpen(true);
                                }}
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Add Banking Info
                              </Button>
                            </div>
                            {isLoadingBankingInfo ? (
                              <div className="text-center py-6 text-muted-foreground">Loading...</div>
                            ) : bankingInfoData && bankingInfoData.length > 0 ? (
                              <div className="space-y-4">
                                {bankingInfoData.map((bankInfo: any, index: number) => (
                                  <div
                                    key={bankInfo.banking_info_aid}
                                    className="bg-card border border-primary/10 rounded-lg p-4"
                                  >
                                    <div className="flex items-start justify-between mb-3">
                                      <div className="flex items-center gap-2">
                                        <h4 className="text-foreground font-medium">
                                          {bankInfo.banking_info_car_id && (bankInfo.car_make || bankInfo.car_specs)
                                            ? `${[bankInfo.car_make, bankInfo.car_specs].filter(Boolean).join(" ")}${
                                                bankInfo.car_year ? ` ${bankInfo.car_year}` : ""
                                              }${
                                                bankInfo.car_plate_number
                                                  ? ` - #${bankInfo.car_plate_number}`
                                                  : ""
                                              }`
                                            : "Default Banking Info"}
                                        </h4>
                                        {bankInfo.banking_info_is_default === 1 && (
                                          <Badge
                                            variant="outline"
                                            className="border-primary/50 text-primary bg-[#D3BC8D]/10"
                                          >
                                            Default
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="text-muted-foreground hover:text-primary h-8 w-8 p-0"
                                          onClick={() => {
                                            setEditingBankingInfo(bankInfo);
                                            setIsBankingModalOpen(true);
                                          }}
                                        >
                                          <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="text-muted-foreground hover:text-red-700 h-8 w-8 p-0"
                                          onClick={() =>
                                            setDeletingBankingId(bankInfo.banking_info_aid)
                                          }
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                      <div>
                                        <span className="text-muted-foreground block mb-1">Bank Name:</span>
                                        <span className="text-foreground">
                                          {formatValue(bankInfo.banking_info_bank_name)}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground block mb-1">Tax Classification:</span>
                                        <span className="text-foreground">
                                          {formatValue(bankInfo.banking_info_tax_classification)}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground block mb-1">Routing Number:</span>
                                        <span className="text-foreground font-mono">
                                          {formatValue(bankInfo.banking_info_routing_number)}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground block mb-1">Account Number:</span>
                                        <span className="text-foreground font-mono">
                                          {formatValue(bankInfo.banking_info_account_number)}
                                        </span>
                                      </div>
                                      {bankInfo.banking_info_business_name && (
                                        <div>
                                          <span className="text-muted-foreground block mb-1">Business Name:</span>
                                          <span className="text-foreground">
                                            {formatValue(bankInfo.banking_info_business_name)}
                                          </span>
                                        </div>
                                      )}
                                      {bankInfo.banking_info_ein && (
                                        <div>
                                          <span className="text-muted-foreground block mb-1">EIN:</span>
                                          <span className="text-foreground font-mono">
                                            {formatValue(bankInfo.banking_info_ein)}
                                          </span>
                                        </div>
                                      )}
                                      {bankInfo.banking_info_ssn && (
                                        <div>
                                          <span className="text-muted-foreground block mb-1">SSN:</span>
                                          <span className="text-foreground font-mono">
                                            {formatValue(bankInfo.banking_info_ssn)}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                                <DollarSign className="w-8 h-8 mb-2 text-gray-600" />
                                <p>No banking information available yet.</p>
                              </div>
                            )}
                          </div>

                          {/* Signed Contracts Section */}
                          <div className="bg-card p-4 rounded-lg border border-primary/20">
                            <div className="flex items-center justify-between mb-4 pb-2 border-b border-primary/30">
                              <h3 className="text-lg font-semibold text-primary">
                                Signed Contracts
                              </h3>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-primary border-primary/30 hover:bg-primary/10"
                                onClick={() => setIsUploadContractOpen(true)}
                              >
                                <Upload className="w-4 h-4 mr-2" />
                                Upload Contract
                              </Button>
                            </div>
                            {client.signedContracts && client.signedContracts.length > 0 ? (
                              <div className="space-y-3">
                                {client.signedContracts.map((contract, index) => (
                                  <div
                                    key={contract.id ?? index}
                                    className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-primary/10 rounded-lg p-4"
                                  >
                                    <div className="space-y-1 text-sm">
                                      <div className="text-foreground font-medium">
                                        {formatValue(contract.vehicleYear)}{" "}
                                        {formatValue(contract.vehicleMake)}{" "}
                                        {formatValue(contract.vehicleModel)}
                                      </div>
                                      <div className="text-muted-foreground">
                                        Plate:{" "}
                                        <span className="text-foreground">
                                          {formatValue(contract.licensePlate)}
                                        </span>
                                        {" · "}
                                        VIN:{" "}
                                        <span className="text-foreground font-mono text-xs">
                                          {formatValue(contract.vinNumber)}
                                        </span>
                                      </div>
                                      <div className="text-muted-foreground">
                                        Signed on:{" "}
                                        <span className="text-foreground">
                                          {formatDate(contract.contractSignedAt || contract.createdAt)}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <Badge
                                        variant="outline"
                                        className="border-green-500/50 text-green-700 bg-green-500/10"
                                      >
                                        Signed
                                      </Badge>
                                      {contract.signedContractUrl && (
                                        <a
                                          href={buildApiUrl(`/api/contracts/${contract.id}/view`)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/80 transition-colors"
                                        >
                                          <Eye className="w-4 h-4" />
                                          View
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                                <Folder className="w-8 h-8 mb-2 text-gray-600" />
                                <p>No signed contracts available yet.</p>
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()
                  ) : (
                    // Show basic client info when no onboarding data exists (manually created client)
                    <>
                      {/* Basic Client Information */}
                      <div className="bg-card p-4 rounded-lg border border-primary/20">
                        <h3 className="text-lg font-semibold text-primary mb-4 pb-2 border-b border-primary/30">
                          Personal Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground block mb-1">Full Name:</span>
                            <span className="text-foreground font-medium">
                              {client.firstName} {client.lastName}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block mb-1">Email:</span>
                            <span className="text-foreground">{client.email}</span>
                          </div>
                          {client.phone && (
                            <div>
                              <span className="text-muted-foreground block mb-1">Phone:</span>
                              <span className="text-foreground">{client.phone}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-muted-foreground block mb-1">Status:</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                client.isActive
                                  ? "border-green-500/50 text-green-700 bg-green-500/10"
                                  : "border-red-500/50 text-red-700 bg-red-500/10"
                              )}
                            >
                              {client.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <div>
                            <span className="text-muted-foreground block mb-1">Created:</span>
                            <span className="text-foreground">
                              {new Date(client.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block mb-1">Last Login:</span>
                            <span className="text-foreground">
                              {formatLastLogin(client.lastLoginAt)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block mb-1">Online Status:</span>
                            {!client ? (
                              <span className="text-muted-foreground">N/A</span>
                            ) : onlineStatusBadge ? (
                              <Badge
                                variant="outline"
                                className={onlineStatusBadge.className}
                              >
                                {onlineStatusBadge.text}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">N/A</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Banking Information (legacy fallback, only if no ACH records) */}
                      {(!bankingInfoData || bankingInfoData.length === 0) &&
                        (client.bankName || client.bankRoutingNumber || client.bankAccountNumber) && (
                          <div className="bg-card p-4 rounded-lg border border-primary/20">
                            <h3 className="text-lg font-semibold text-primary mb-4 pb-2 border-b border-primary/30">
                              Banking Information
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              {client.bankName && (
                                <div>
                                  <span className="text-muted-foreground block mb-1">Bank Name:</span>
                                  <span className="text-foreground">{client.bankName}</span>
                                </div>
                              )}
                              {client.bankRoutingNumber && (
                                <div>
                                  <span className="text-muted-foreground block mb-1">Routing Number:</span>
                                  <span className="text-foreground font-mono">{client.bankRoutingNumber}</span>
                                </div>
                              )}
                              {client.bankAccountNumber && (
                                <div>
                                  <span className="text-muted-foreground block mb-1">Account Number:</span>
                                  <span className="text-foreground font-mono">{client.bankAccountNumber}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                      {/* Signed Contracts for manually created clients */}
                      <div className="bg-card p-4 rounded-lg border border-primary/20">
                        <div className="flex items-center justify-between mb-4 pb-2 border-b border-primary/30">
                          <h3 className="text-lg font-semibold text-primary">
                            Signed Contracts
                          </h3>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-primary border-primary/30 hover:bg-primary/10"
                            onClick={() => setIsUploadContractOpen(true)}
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Upload Contract
                          </Button>
                        </div>
                        {client.signedContracts && client.signedContracts.length > 0 ? (
                          <div className="space-y-3">
                            {client.signedContracts.map((contract, index) => (
                              <div
                                key={contract.id ?? index}
                                className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-primary/10 rounded-lg p-4"
                              >
                                <div className="space-y-1 text-sm">
                                  <div className="text-foreground font-medium">
                                    {contract.vehicleYear || ""}{" "}
                                    {contract.vehicleMake || ""}{" "}
                                    {contract.vehicleModel || ""}
                                  </div>
                                  <div className="text-muted-foreground">
                                    Plate: <span className="text-foreground">{contract.licensePlate || "N/A"}</span>
                                    {" · "}
                                    VIN: <span className="text-foreground font-mono text-xs">{contract.vinNumber || "N/A"}</span>
                                  </div>
                                  <div className="text-muted-foreground">
                                    Signed on:{" "}
                                    <span className="text-foreground">
                                      {contract.contractSignedAt
                                        ? new Date(contract.contractSignedAt).toLocaleString()
                                        : "N/A"}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <Badge
                                    variant="outline"
                                    className="border-green-500/50 text-green-700 bg-green-500/10"
                                  >
                                    Signed
                                  </Badge>
                                  {contract.signedContractUrl && (
                                    <a
                                      href={buildApiUrl(`/api/contracts/${contract.id}/view`)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/80 transition-colors"
                                    >
                                      <Eye className="w-4 h-4" />
                                      View
                                    </a>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                            <Folder className="w-8 h-8 mb-2 text-gray-600" />
                            <p>No signed contracts available yet.</p>
                          </div>
                        )}
                      </div>

                      <div className="bg-card/50 p-4 rounded-lg border border-primary/10 text-center">
                        <p className="text-muted-foreground text-sm">
                          This client was created manually. Complete onboarding details are not available.
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {activeSection === "cars" && (
              <Card className="bg-background border-border">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-primary text-xl">
                      Assigned Cars ({client.cars.length})
                    </CardTitle>
                    <Button
                      onClick={() => setIsAddCarOpen(true)}
                      variant="outline"
                      size="sm"
                      className="text-primary border-primary/30 hover:bg-primary/10"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Car
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {client.cars.length === 0 ? (
                    <div className="text-center py-8">
                      <Car className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                      <p className="text-muted-foreground mb-4">No cars assigned to this client</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border hover:bg-transparent">
                            <TableHead className="text-center text-foreground font-medium px-4 py-3 w-12">#</TableHead>
                            <TableHead className="text-center text-foreground font-medium px-4 py-3">Status</TableHead>
                            <TableHead className="text-center text-foreground font-medium px-4 py-3">Stats</TableHead>
                            <TableHead className="text-center text-foreground font-medium px-4 py-3">Management</TableHead>
                            <TableHead className="text-center text-foreground font-medium px-4 py-3">Make</TableHead>
                            <TableHead className="text-center text-foreground font-medium px-4 py-3">Year</TableHead>
                            <TableHead className="text-center text-foreground font-medium px-4 py-3">Model/Specs</TableHead>
                            <TableHead className="text-center text-foreground font-medium px-4 py-3">Contact</TableHead>
                            <TableHead className="text-center text-foreground font-medium px-4 py-3">VIN #</TableHead>
                            <TableHead className="text-center text-foreground font-medium px-4 py-3">Plate #</TableHead>
                            <TableHead className="text-center text-foreground font-medium px-4 py-3">Gas</TableHead>
                            <TableHead className="text-center text-foreground font-medium px-4 py-3">Tire Size</TableHead>
                            <TableHead className="text-center text-foreground font-medium px-4 py-3">Oil Type</TableHead>
                            <TableHead className="text-center text-foreground font-medium px-4 py-3">Turo Link</TableHead>
                            <TableHead className="text-center text-foreground font-medium px-4 py-3">Admin Turo Link</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {client.cars.map((car, index) => {
                            // Determine Management value based on owner name
                            const ownerFullName = car.owner 
                              ? `${car.owner.firstName || ''} ${car.owner.lastName || ''}`.trim()
                              : '';
                            const managementValue = ownerFullName === "Jay Barton" ? "Own" : "Manage";

                            return (
                            <TableRow
                              key={car.id}
                              className="border-border hover:bg-muted/50/50 transition-colors"
                            >
                              <TableCell className="text-center text-primary px-4 py-3 align-middle">
                                {index + 1}
                              </TableCell>
                              <TableCell className="text-center px-4 py-3 align-middle">
                                <div className="flex items-center justify-center">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      car.status === "available"
                                        ? "bg-green-500/20 text-green-700 border-green-500/30"
                                        : "bg-gray-500/20 text-gray-700 border-gray-500/30"
                                    )}
                                  >
                                    {car.status === "available" ? "Available" : "Off Fleet"}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell className="text-center px-4 py-3 align-middle">
                                <a
                                  href={`/admin/view-car/${car.id}`}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setLocation(`/admin/view-car/${car.id}`);
                                  }}
                                  className="text-blue-700 hover:underline"
                                >
                                  View Stats
                                </a>
                              </TableCell>
                              <TableCell className="text-center text-foreground px-4 py-3 align-middle">
                                {managementValue}
                              </TableCell>
                              <TableCell className="text-center text-foreground px-4 py-3 align-middle">
                                {car.make || "N/A"}
                              </TableCell>
                              <TableCell className="text-center text-foreground px-4 py-3 align-middle">
                                {car.year || "N/A"}
                              </TableCell>
                              <TableCell className="text-center text-foreground px-4 py-3 align-middle">
                                {car.model || "N/A"}
                              </TableCell>
                              <TableCell className="text-center text-muted-foreground px-4 py-3 align-middle">
                                {car.contactPhone || car.owner?.phone || "N/A"}
                              </TableCell>
                              <TableCell className="text-center text-foreground font-mono text-sm px-4 py-3 align-middle">
                                {car.vin}
                              </TableCell>
                              <TableCell className="text-center text-muted-foreground px-4 py-3 align-middle">
                                {car.licensePlate || "N/A"}
                              </TableCell>
                              <TableCell className="text-center text-muted-foreground px-4 py-3 align-middle">
                                {car.fuelType || "N/A"}
                              </TableCell>
                              <TableCell className="text-center text-muted-foreground px-4 py-3 align-middle">
                                {car.tireSize || "N/A"}
                              </TableCell>
                              <TableCell className="text-center text-muted-foreground px-4 py-3 align-middle">
                                {car.oilType || "N/A"}
                              </TableCell>
                              <TableCell className="text-center px-4 py-3 align-middle">
                                <div className="flex items-center justify-center">
                                  <a
                                    href="#"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-blue-700 hover:underline"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                </div>
                              </TableCell>
                              <TableCell className="text-center px-4 py-3 align-middle">
                                <a
                                  href="#"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-blue-700 hover:underline"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              </TableCell>
                            </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {activeSection === "totals" && (
              <Card className="bg-background border-border">
                <CardHeader>
                  <div className="flex items-center justify-between">
                  <CardTitle className="text-primary text-xl">Totals</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary hover:bg-muted/50D3BC8D]/20"
                      onClick={() => {
                        // Export functionality
                        console.log("Export totals");
                      }}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                  </div>
                  
                  {/* Filters */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                    <Select value={selectedCar} onValueChange={setSelectedCar}>
                      <SelectTrigger className="bg-card border-border text-foreground">
                        <SelectValue placeholder="Car" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border text-foreground">
                        <SelectItem value="all">All cars</SelectItem>
                        {client?.cars?.map((car) => (
                          <SelectItem key={car.id} value={car.id.toString()}>
                            {car.make || ""} {car.model || ""} {car.year || ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                      <SelectTrigger className="bg-card border-border text-foreground">
                        <SelectValue placeholder="Filter" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border text-foreground">
                        <SelectItem value="2025">2025</SelectItem>
                        <SelectItem value="2024">2024</SelectItem>
                        <SelectItem value="2023">2023</SelectItem>
                        <SelectItem value="2022">2022</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={fromYear} onValueChange={setFromYear}>
                      <SelectTrigger className="bg-card border-border text-foreground">
                        <SelectValue placeholder="From" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border text-foreground">
                        <SelectItem value="2025">2025</SelectItem>
                        <SelectItem value="2024">2024</SelectItem>
                        <SelectItem value="2023">2023</SelectItem>
                        <SelectItem value="2022">2022</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={toYear} onValueChange={setToYear}>
                      <SelectTrigger className="bg-card border-border text-foreground">
                        <SelectValue placeholder="To" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border text-foreground">
                        <SelectItem value="2025">2025</SelectItem>
                        <SelectItem value="2024">2024</SelectItem>
                        <SelectItem value="2023">2023</SelectItem>
                        <SelectItem value="2022">2022</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {totalsLoading ? (
                    <div className="flex items-center justify-center py-12 space-y-3 flex-col">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-4 bg-muted/50 rounded animate-pulse w-3/4" />
                      ))}
                    </div>
                  ) : !totals ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Folder className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                      <p>No data available</p>
                    </div>
                  ) : (
                    <Accordion type="multiple" className="w-full space-y-2">
                  {/* CAR MANAGEMENT AND CAR OWNER SPLIT */}
                      <AccordionItem value="split" className="border border-border rounded-lg overflow-hidden bg-card">
                        <AccordionTrigger className="px-4 py-3 hover:bg-muted transition-colors [&>svg]:hidden">
                          <div className="flex items-center gap-2 w-full">
                            <Plus className="w-4 h-4 text-primary group-data-[state=open]:hidden" />
                            <Minus className="w-4 h-4 text-primary hidden group-data-[state=open]:block" />
                      <span className="text-foreground font-medium">CAR MANAGEMENT AND CAR OWNER SPLIT</span>
                    </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4 bg-background">
                          <div className="space-y-2 pt-2">
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span>Car Management Split</span>
                              <span className="text-foreground font-medium">
                                ${totals?.carManagementSplit?.toFixed(2) || "0.00"}
                              </span>
                  </div>
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span>Car Owner Split</span>
                              <span className="text-foreground font-medium">
                                ${totals?.carOwnerSplit?.toFixed(2) || "0.00"}
                              </span>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                  {/* INCOME */}
                      <AccordionItem value="income" className="border border-border rounded-lg overflow-hidden bg-card">
                        <AccordionTrigger className="px-4 py-3 hover:bg-muted transition-colors [&>svg]:hidden">
                          <div className="flex items-center gap-2 w-full">
                            <Plus className="w-4 h-4 text-primary group-data-[state=open]:hidden" />
                            <Minus className="w-4 h-4 text-primary hidden group-data-[state=open]:block" />
                      <span className="text-foreground font-medium">INCOME</span>
                        </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4 bg-background">
                          <div className="space-y-2 pt-2">
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span>Rental Income</span>
                              <span className="text-foreground">${totals?.income?.rentalIncome?.toFixed(2) || "0.00"}</span>
                      </div>
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span>Delivery Income</span>
                              <span className="text-foreground">${totals?.income?.deliveryIncome?.toFixed(2) || "0.00"}</span>
                  </div>
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span>Electric Prepaid Income</span>
                              <span className="text-foreground">${totals?.income?.electricPrepaidIncome?.toFixed(2) || "0.00"}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span>Smoking Fines</span>
                              <span className="text-foreground">${totals?.income?.smokingFines?.toFixed(2) || "0.00"}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span>Gas Prepaid Income</span>
                              <span className="text-foreground">${totals?.income?.gasPrepaidIncome?.toFixed(2) || "0.00"}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span>Miles Income</span>
                              <span className="text-foreground">${totals?.income?.milesIncome?.toFixed(2) || "0.00"}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span>Ski Racks Income</span>
                              <span className="text-foreground">${totals?.income?.skiRacksIncome?.toFixed(2) || "0.00"}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span>Child Seat Income</span>
                              <span className="text-foreground">${totals?.income?.childSeatIncome?.toFixed(2) || "0.00"}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span>Coolers Income</span>
                              <span className="text-foreground">${totals?.income?.coolersIncome?.toFixed(2) || "0.00"}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span>Income Insurance and Client Wrecks</span>
                              <span className="text-foreground">${totals?.income?.incomeInsurance?.toFixed(2) || "0.00"}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span>Other Income</span>
                              <span className="text-foreground">${totals?.income?.otherIncome?.toFixed(2) || "0.00"}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span>Negative Balance Carry Over</span>
                              <span className="text-foreground">${totals?.income?.negativeBalance?.toFixed(2) || "0.00"}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-sm pt-2 border-t border-border">
                              <span className="font-medium">Car Management Total Expenses</span>
                              <span className="text-foreground font-semibold">
                                ${totals?.income?.carManagementTotalExpenses?.toFixed(2) || "0.00"}
                              </span>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span className="font-medium">Car Owner Total Expenses</span>
                              <span className="text-foreground font-semibold">
                                ${totals?.income?.carOwnerTotalExpenses?.toFixed(2) || "0.00"}
                              </span>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span className="font-medium">Car Payment</span>
                              <span className="text-foreground font-semibold">
                                ${totals?.income?.carPayment?.toFixed(2) || "0.00"}
                              </span>
                            </div>
                            <div className="flex justify-between text-primary text-sm font-bold pt-2 border-t border-border">
                              <span>Total Expenses</span>
                              <span>${totals?.income?.totalExpenses?.toFixed(2) || "0.00"}</span>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                  {/* OPERATING EXPENSES */}
                      <AccordionItem value="expenses" className="border border-border rounded-lg overflow-hidden bg-card">
                        <AccordionTrigger className="px-4 py-3 hover:bg-muted transition-colors [&>svg]:hidden">
                          <div className="flex items-center gap-2 w-full">
                            <Plus className="w-4 h-4 text-primary group-data-[state=open]:hidden" />
                            <Minus className="w-4 h-4 text-primary hidden group-data-[state=open]:block" />
                            <span className="text-foreground font-medium">OPERATING EXPENSES (COGS - Per Vehicle)</span>
                        </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4 bg-background">
                          <div className="space-y-2 pt-2">
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span>Auto Body Shop / Wreck</span>
                              <span className="text-foreground">${totals?.expenses?.autoBodyShop?.toFixed(2) || "0.00"}</span>
                      </div>
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span>Alignment</span>
                              <span className="text-foreground">${totals?.expenses?.alignment?.toFixed(2) || "0.00"}</span>
                  </div>
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span>Battery</span>
                              <span className="text-foreground">${totals?.expenses?.battery?.toFixed(2) || "0.00"}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span>Brakes</span>
                              <span className="text-foreground">${totals?.expenses?.brakes?.toFixed(2) || "0.00"}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span>Car Payment</span>
                              <span className="text-foreground">${totals?.expenses?.carPayment?.toFixed(2) || "0.00"}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span>Car Insurance</span>
                              <span className="text-foreground">${totals?.expenses?.carInsurance?.toFixed(2) || "0.00"}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span>Car Seats</span>
                              <span className="text-foreground">${totals?.expenses?.carSeats?.toFixed(2) || "0.00"}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span>Cleaning Supplies / Tools</span>
                              <span className="text-foreground">${totals?.expenses?.cleaningSupplies?.toFixed(2) || "0.00"}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span>Emissions</span>
                              <span className="text-foreground">${totals?.expenses?.emissions?.toFixed(2) || "0.00"}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span>GPS System</span>
                              <span className="text-foreground">${totals?.expenses?.gpsSystem?.toFixed(2) || "0.00"}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span>Keys & Fob</span>
                              <span className="text-foreground">${totals?.expenses?.keysFob?.toFixed(2) || "0.00"}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span>Labor - Cleaning</span>
                              <span className="text-foreground">${totals?.expenses?.laborDetailing?.toFixed(2) || "0.00"}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span>Parking Airport (Reimbursed - GLA - Client Owner Rentals)</span>
                              <span className="text-foreground">${totals?.expenses?.parkingAirport?.toFixed(2) || "0.00"}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span>Uber/Lyft/Lime - Not Reimbursed</span>
                              <span className="text-foreground">${totals?.expenses?.uberNotReimbursed?.toFixed(2) || "0.00"}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span>Uber/Lyft/Lime - Reimbursed</span>
                              <span className="text-foreground">${totals?.expenses?.uberReimbursed?.toFixed(2) || "0.00"}</span>
                            </div>
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span>Gas - Service Run</span>
                              <span className="text-foreground">${totals?.expenses?.gasServiceRun?.toFixed(2) || "0.00"}</span>
                            </div>
                            <div className="flex justify-between text-primary text-sm font-bold pt-2 border-t border-border">
                              <span>Total Operating Expenses (COGS - Per Vehicle)</span>
                              <span>${totals?.expenses?.totalOperatingExpenses?.toFixed(2) || "0.00"}</span>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                  {/* GLA PARKING FEE & LABOR CLEANING */}
                      <AccordionItem value="gla" className="border border-border rounded-lg overflow-hidden bg-card">
                        <AccordionTrigger className="px-4 py-3 hover:bg-muted transition-colors [&>svg]:hidden">
                          <div className="flex items-center gap-2 w-full">
                            <Plus className="w-4 h-4 text-primary group-data-[state=open]:hidden" />
                            <Minus className="w-4 h-4 text-primary hidden group-data-[state=open]:block" />
                      <span className="text-foreground font-medium">GLA PARKING FEE & LABOR CLEANING</span>
                        </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4 bg-background">
                          <div className="space-y-2 pt-2">
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span>GLA Labor - Cleaning</span>
                              <span className="text-foreground">${totals?.gla?.laborCleaning?.toFixed(2) || "0.00"}</span>
                      </div>
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span>GLA Parking Fee</span>
                              <span className="text-foreground">${totals?.gla?.parkingFee?.toFixed(2) || "0.00"}</span>
                  </div>
                            <div className="flex justify-between text-primary text-sm font-bold pt-2 border-t border-border">
                              <span>Total GLA Parking Fee & Labor Cleaning</span>
                              <span>${totals?.gla?.total?.toFixed(2) || "0.00"}</span>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                  {/* HISTORY OF THE CARS */}
                      <AccordionItem value="history" className="border border-border rounded-lg overflow-hidden bg-card">
                        <AccordionTrigger className="px-4 py-3 hover:bg-muted transition-colors [&>svg]:hidden">
                          <div className="flex items-center gap-2 w-full">
                            <Plus className="w-4 h-4 text-primary group-data-[state=open]:hidden" />
                            <Minus className="w-4 h-4 text-primary hidden group-data-[state=open]:block" />
                      <span className="text-foreground font-medium">HISTORY OF THE CARS</span>
                        </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4 bg-background">
                          <div className="space-y-2 pt-2">
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span>Days Rented</span>
                              <span className="text-foreground font-medium">{totals?.history?.daysRented || 0}</span>
                      </div>
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span>Trips Taken</span>
                              <span className="text-foreground font-medium">{totals?.history?.tripsTaken || 0}</span>
                  </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>

                  {/* PAYMENT HISTORY */}
                      <AccordionItem value="payments" className="border border-border rounded-lg overflow-hidden bg-card">
                        <AccordionTrigger className="px-4 py-3 hover:bg-muted transition-colors [&>svg]:hidden">
                          <div className="flex items-center gap-2 w-full">
                            <Plus className="w-4 h-4 text-primary group-data-[state=open]:hidden" />
                            <Minus className="w-4 h-4 text-primary hidden group-data-[state=open]:block" />
                      <span className="text-foreground font-medium">PAYMENT HISTORY</span>
                        </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4 bg-background">
                          <div className="space-y-2 pt-2">
                            <div className="flex justify-between text-muted-foreground text-sm">
                              <span>{fromYear} - {toYear}</span>
                              <span className="text-foreground font-semibold">
                                ${totals?.payments?.total?.toFixed(2) || "0.00"}
                              </span>
                      </div>
                  </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  )}
                </CardContent>
              </Card>
            )}

            {activeSection === "maintenance" && (
              <Card className="bg-background border-border">
                <CardHeader>
                  <CardTitle className="text-primary text-xl">Car Maintenance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Filters */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Select value={maintenanceTypeFilter} onValueChange={setMaintenanceTypeFilter}>
                      <SelectTrigger className="bg-card border-border text-foreground">
                        <SelectValue placeholder="Select a Type" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border text-foreground">
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="oil">Oil Change</SelectItem>
                        <SelectItem value="tire">Tire Service</SelectItem>
                        <SelectItem value="repair">Repair</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={maintenanceStatusFilter} onValueChange={setMaintenanceStatusFilter}>
                      <SelectTrigger className="bg-card border-border text-foreground">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border text-foreground">
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>

                    <Input
                      type="date"
                      value={maintenanceDateFilter}
                      onChange={(e) => setMaintenanceDateFilter(e.target.value)}
                      className="bg-card border-border text-foreground"
                      placeholder="Date to Filter"
                    />
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="text-center text-foreground font-medium px-4 py-3 w-12">#</TableHead>
                          <TableHead className="text-left text-foreground font-medium px-4 py-3">Make</TableHead>
                          <TableHead className="text-left text-foreground font-medium px-4 py-3">Model</TableHead>
                          <TableHead className="text-left text-foreground font-medium px-4 py-3">Year</TableHead>
                          <TableHead className="text-left text-foreground font-medium px-4 py-3">Plate #</TableHead>
                          <TableHead className="text-left text-foreground font-medium px-4 py-3">VIN #</TableHead>
                          <TableHead className="text-left text-foreground font-medium px-4 py-3">Tire Size</TableHead>
                          <TableHead className="text-left text-foreground font-medium px-4 py-3">Maintenance Type</TableHead>
                          <TableHead className="text-left text-foreground font-medium px-4 py-3">Status</TableHead>
                          <TableHead className="text-left text-foreground font-medium px-4 py-3">Schedule Date</TableHead>
                          <TableHead className="text-left text-foreground font-medium px-4 py-3">Date Completed</TableHead>
                          <TableHead className="text-left text-foreground font-medium px-4 py-3">Price</TableHead>
                          <TableHead className="text-left text-foreground font-medium px-4 py-3">Remarks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                      <TableCell colSpan={13} className="text-center py-12">
                            <div className="flex flex-col items-center gap-3">
                              <Folder className="w-12 h-12 text-gray-600" />
                              <p className="text-muted-foreground">No data</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-primary/30 border-2 text-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground text-2xl">Edit Client Details</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Update client onboarding information
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-6 mt-4">
            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-primary border-b border-primary/30 pb-2">
                Personal Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">First Name</Label>
                  <Input
                    value={editFormData.firstNameOwner || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, firstNameOwner: e.target.value })}
                    className="bg-card border-border text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">Last Name</Label>
                  <Input
                    value={editFormData.lastNameOwner || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, lastNameOwner: e.target.value })}
                    className="bg-card border-border text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <Input
                    type="email"
                    value={editFormData.emailOwner || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, emailOwner: e.target.value })}
                    className="bg-card border-border text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">Phone</Label>
                  <Input
                    value={editFormData.phoneOwner || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, phoneOwner: e.target.value })}
                    className="bg-card border-border text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">Date of Birth</Label>
                  <Input
                    type="date"
                    value={editFormData.birthday ? editFormData.birthday.split("T")[0] : ""}
                    onChange={(e) => setEditFormData({ ...editFormData, birthday: e.target.value })}
                    className="bg-card border-border text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">T-Shirt Size</Label>
                  <Select
                    value={editFormData.tshirtSize || ""}
                    onValueChange={(value) => setEditFormData({ ...editFormData, tshirtSize: value })}
                  >
                    <SelectTrigger className="bg-card border-border text-foreground">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      {["XS", "S", "M", "L", "XL", "XXL"].map(
                        (s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-muted-foreground">SSN</Label>
                  <Input
                    value={editFormData.ssn || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, ssn: e.target.value })}
                    className="bg-card border-border text-foreground font-mono"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">Representative</Label>
                  <Input
                    value={editFormData.representative || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, representative: e.target.value })}
                    className="bg-card border-border text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">How Did You Hear About Us</Label>
                  <Select
                    value={editFormData.heardAboutUs || ""}
                    onValueChange={(value) => setEditFormData({ ...editFormData, heardAboutUs: value })}
                  >
                    <SelectTrigger className="bg-card border-border text-foreground">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      <SelectItem value="Friend">Friend</SelectItem>
                      <SelectItem value="Google">Google</SelectItem>
                      <SelectItem value="Social Media">Social Media</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-muted-foreground">Emergency Contact Name</Label>
                  <Input
                    value={editFormData.emergencyContactName || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, emergencyContactName: e.target.value })}
                    className="bg-card border-border text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">Emergency Contact Phone</Label>
                  <Input
                    value={editFormData.emergencyContactPhone || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, emergencyContactPhone: e.target.value })}
                    className="bg-card border-border text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">Client Status</Label>
                  <Select
                    value={editFormData.status || "ACTIVE"}
                    onValueChange={(value) => setEditFormData({ ...editFormData, status: value })}
                  >
                    <SelectTrigger className="bg-card border-border text-foreground">
                      <SelectValue placeholder="Select client status" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Address Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-primary border-b border-primary/30 pb-2">
                Address Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label className="text-muted-foreground">Street Address</Label>
                  <Input
                    value={editFormData.streetAddress || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, streetAddress: e.target.value })}
                    className="bg-card border-border text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">City</Label>
                  <Input
                    value={editFormData.city || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                    className="bg-card border-border text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">State</Label>
                  <Input
                    value={editFormData.state || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, state: e.target.value })}
                    className="bg-card border-border text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">Zip Code</Label>
                  <Input
                    value={editFormData.zipCode || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, zipCode: e.target.value })}
                    className="bg-card border-border text-foreground"
                  />
                </div>
              </div>
            </div>

            {/* Banking Information (ACH) */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-primary border-b border-primary/30 pb-2">
                Banking Information (ACH)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Bank Name</Label>
                  <Input
                    value={editFormData.bankName || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, bankName: e.target.value })}
                    className="bg-card border-border text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">Tax Classification</Label>
                  <Select
                    value={editFormData.taxClassification || ""}
                    onValueChange={(value) => setEditFormData({ ...editFormData, taxClassification: value })}
                  >
                    <SelectTrigger className="bg-card border-border text-foreground">
                      <SelectValue placeholder="Select tax classification" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      <SelectItem value="individual">Individual</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-muted-foreground">Routing Number</Label>
                  <Input
                    value={editFormData.routingNumber || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, routingNumber: e.target.value })}
                    className="bg-card border-border text-foreground font-mono"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">Account Number</Label>
                  <Input
                    value={editFormData.accountNumber || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, accountNumber: e.target.value })}
                    className="bg-card border-border text-foreground font-mono"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">SSN</Label>
                  <Input
                    value={editFormData.ssn || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, ssn: e.target.value })}
                    className="bg-card border-border text-foreground font-mono"
                    placeholder="Enter SSN"
                  />
                </div>
                  <div>
                    <Label className="text-muted-foreground">EIN</Label>
                    <Input
                      value={editFormData.ein || ""}
                      onChange={(e) => setEditFormData({ ...editFormData, ein: e.target.value })}
                      className="bg-card border-border text-foreground font-mono"
                    placeholder="Enter EIN"
                    />
                  </div>
                <div>
                  <Label className="text-muted-foreground">Business Name</Label>
                  <Input
                    value={editFormData.businessName || ""}
                    onChange={(e) => setEditFormData({ ...editFormData, businessName: e.target.value })}
                    className="bg-card border-border text-foreground"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
                className="border-border text-muted-foreground hover:bg-muted/50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/80"
              >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Upload Contract Dialog */}
      <Dialog open={isUploadContractOpen} onOpenChange={(open) => {
        setIsUploadContractOpen(open);
        if (!open) {
          setUploadContractFormErrors({});
          setUploadContractForm({
            contractFile: null,
            selectedCarId: "",
          });
        }
      }}>
        <DialogContent className="max-w-lg bg-card border-primary/30 border-2 text-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground text-xl">Upload Contract</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Manually upload a signed contract for this client. Select the car to associate with this contract.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              uploadContractMutation.mutate(uploadContractForm);
            }}
            className="space-y-4"
          >
            <div>
              <Label className="text-muted-foreground">Select Car *</Label>
              {(() => {
                // Filter out cars that have already been onboarded (have a signed contract)
                const onboardedVins = new Set(
                  (data?.data?.signedContracts || [])
                    .map((contract: any) => contract.vinNumber?.toUpperCase().trim())
                    .filter((vin: string) => vin)
                );
                
                const nonOnboardedCars = (data?.data?.cars || []).filter((car: any) => {
                  const carVin = car.vin?.toUpperCase().trim();
                  return carVin && !onboardedVins.has(carVin);
                });
                
                if (nonOnboardedCars.length === 0) {
                  return (
                    <div className="space-y-2">
                      <div className="bg-card border border-border rounded-md p-3 text-muted-foreground text-sm">
                        No non-onboarded cars available. All cars for this client have already been onboarded.
                      </div>
                      <p className="text-xs text-muted-foreground">You cannot upload a contract when all cars are already onboarded.</p>
                    </div>
                  );
                }
                
                return (
                  <>
                    <Select
                      value={uploadContractForm.selectedCarId}
                      onValueChange={(value) => {
                        setUploadContractForm({ ...uploadContractForm, selectedCarId: value });
                        setUploadContractFormErrors({});
                      }}
                    >
                      <SelectTrigger className="bg-card border-border text-foreground">
                        <SelectValue placeholder="Select a car" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border text-foreground">
                        {nonOnboardedCars.map((car: any) => (
                          <SelectItem key={car.id} value={car.id.toString()}>
                            {car.make || "N/A"} {car.model || ""} {car.year ? `(${car.year})` : ""} - VIN: {car.vin || "N/A"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {uploadContractFormErrors.selectedCarId && (
                      <p className="text-xs text-red-700 mt-1">{uploadContractFormErrors.selectedCarId}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">Select a car that hasn't been onboarded yet</p>
                  </>
                );
              })()}
            </div>
            <div>
              <Label className="text-muted-foreground">Contract PDF File *</Label>
              <div className="mt-2">
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setUploadContractFormErrors((prev) => ({ ...prev, contractFile: undefined }));
                    if (file && file.size > CONTRACT_MAX_SIZE_BYTES) {
                      setUploadContractFormErrors((prev) => ({ ...prev, contractFile: "You can upload files under 10MB" }));
                      setUploadContractForm({ ...uploadContractForm, contractFile: null });
                      e.target.value = "";
                    } else {
                      setUploadContractForm({ ...uploadContractForm, contractFile: file });
                    }
                  }}
                  className="block w-full text-sm text-muted-foreground
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-primary file:text-primary-foreground
                    hover:file:bg-primary/90
                    file:cursor-pointer
                    cursor-pointer
                    bg-card border border-border rounded-md p-2"
                required
              />
                {uploadContractForm.contractFile && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Selected: {uploadContractForm.contractFile.name}
                  </p>
                )}
                {uploadContractFormErrors.contractFile && (
                  <p className="text-xs text-muted-foreground mt-1">{uploadContractFormErrors.contractFile}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">Upload a PDF file from your local device (max 10MB)</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsUploadContractOpen(false)}
                className="border-border text-muted-foreground hover:bg-muted/50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={uploadContractMutation.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/80"
              >
                {uploadContractMutation.isPending ? "Uploading..." : "Upload Contract"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Car Dialog */}
      <Dialog open={isAddCarOpen} onOpenChange={(open) => {
        setIsAddCarOpen(open);
        if (!open) {
          setAddCarFormErrors({});
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-primary/30 border-2 text-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground text-xl">Add Car</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Add a new car for this client
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addCarMutation.mutate(addCarForm);
            }}
            className="space-y-6"
          >
            {/* Vehicle Information Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-primary border-b border-border pb-2">
                Vehicle Information
              </h3>
              <div>
                <Label className="text-muted-foreground">VIN *</Label>
                <Input
                  value={addCarForm.vin}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase().slice(0, 17);
                    setAddCarForm({ ...addCarForm, vin: value });
                    // Clear error when user types
                    if (addCarFormErrors.vin) {
                      setAddCarFormErrors({ ...addCarFormErrors, vin: undefined });
                    }
                  }}
                  placeholder="WDDNG8GB5LA123456"
                  className={cn(
                    "bg-card border-border text-foreground font-mono",
                    addCarFormErrors.vin && "border-red-500"
                  )}
                  maxLength={17}
                  required
                />
                {addCarFormErrors.vin && (
                  <p className="text-sm text-red-500 mt-1">{addCarFormErrors.vin}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Make *</Label>
                  <Input
                    value={addCarForm.make}
                    onChange={(e) => setAddCarForm({ ...addCarForm, make: e.target.value })}
                    placeholder="Mercedes-Benz"
                    className="bg-card border-border text-foreground"
                    required
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">Model *</Label>
                  <Input
                    value={addCarForm.model}
                    onChange={(e) => setAddCarForm({ ...addCarForm, model: e.target.value })}
                    placeholder="S-Class"
                    className="bg-card border-border text-foreground"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Year</Label>
                  <Input
                    type="number"
                    value={addCarForm.year}
                    onChange={(e) => setAddCarForm({ ...addCarForm, year: e.target.value })}
                    placeholder="2024"
                    className="bg-card border-border text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">License Plate</Label>
                  <Input
                    value={addCarForm.licensePlate}
                    onChange={(e) => setAddCarForm({ ...addCarForm, licensePlate: e.target.value })}
                    placeholder="ABC1234"
                    className="bg-card border-border text-foreground"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Exterior Color</Label>
                  <Input
                    value={addCarForm.color}
                    onChange={(e) => setAddCarForm({ ...addCarForm, color: e.target.value })}
                    placeholder="Black"
                    className="bg-card border-border text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">Interior Color</Label>
                  <Input
                    value={addCarForm.interiorColor}
                    onChange={(e) => setAddCarForm({ ...addCarForm, interiorColor: e.target.value })}
                    placeholder="Black"
                    className="bg-card border-border text-foreground"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Mileage</Label>
                  <Input
                    type="number"
                    value={addCarForm.mileage}
                    onChange={(e) => setAddCarForm({ ...addCarForm, mileage: e.target.value })}
                    placeholder="0"
                    className="bg-card border-border text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">Trim</Label>
                  <Input
                    value={addCarForm.vehicleTrim}
                    onChange={(e) => setAddCarForm({ ...addCarForm, vehicleTrim: e.target.value })}
                    className="bg-card border-border text-foreground"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Registration Expiration</Label>
                  <Input
                    type="date"
                    value={addCarForm.registrationExpiration}
                    onChange={(e) => setAddCarForm({ ...addCarForm, registrationExpiration: e.target.value })}
                    className="bg-card border-border text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">Title Type</Label>
                  <Select
                    value={addCarForm.titleType}
                    onValueChange={(value) => setAddCarForm({ ...addCarForm, titleType: value })}
                  >
                    <SelectTrigger className="bg-card border-border text-foreground">
                      <SelectValue placeholder="Select title type" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      <SelectItem value="Clean">Clean</SelectItem>
                      <SelectItem value="Salvage">Salvage</SelectItem>
                      <SelectItem value="Rebuilt">Rebuilt</SelectItem>
                      <SelectItem value="Branded">Branded</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Vehicle Recall</Label>
                  <Select
                    value={addCarForm.vehicleRecall}
                    onValueChange={(value) => setAddCarForm({ ...addCarForm, vehicleRecall: value })}
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
                <div>
                  <Label className="text-muted-foreground">Oil Package Details</Label>
                  <Input
                    value={addCarForm.oilPackageDetails}
                    onChange={(e) => setAddCarForm({ ...addCarForm, oilPackageDetails: e.target.value })}
                    className="bg-card border-border text-foreground"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Number of Seats</Label>
                  <Select
                    value={addCarForm.numberOfSeats}
                    onValueChange={(value) => setAddCarForm({ ...addCarForm, numberOfSeats: value })}
                  >
                    <SelectTrigger className="bg-card border-border text-foreground">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      {[2, 4, 5, 6, 7, 8].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-muted-foreground">Number of Doors</Label>
                  <Select
                    value={addCarForm.numberOfDoors}
                    onValueChange={(value) => setAddCarForm({ ...addCarForm, numberOfDoors: value })}
                  >
                    <SelectTrigger className="bg-card border-border text-foreground">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="4">4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Ski Rack</Label>
                  <Select
                    value={addCarForm.skiRacks}
                    onValueChange={(value) => setAddCarForm({ ...addCarForm, skiRacks: value })}
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
                <div>
                  <Label className="text-muted-foreground">Ski Crossbars</Label>
                  <Select
                    value={addCarForm.skiCrossBars}
                    onValueChange={(value) => setAddCarForm({ ...addCarForm, skiCrossBars: value })}
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Roof Rails</Label>
                  <Select
                    value={addCarForm.roofRails}
                    onValueChange={(value) => setAddCarForm({ ...addCarForm, roofRails: value })}
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
                <div>
                  <Label className="text-muted-foreground">Oil Type</Label>
                  <Input
                    value={addCarForm.oilType}
                    onChange={(e) => setAddCarForm({ ...addCarForm, oilType: e.target.value })}
                    placeholder="5W-30"
                    className="bg-card border-border text-foreground"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Last Oil Change Date</Label>
                  <Input
                    type="date"
                    value={addCarForm.lastOilChange}
                    onChange={(e) => setAddCarForm({ ...addCarForm, lastOilChange: e.target.value })}
                    className="bg-card border-border text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">Free Service Center Oil Change</Label>
                  <Select
                    value={addCarForm.freeDealershipOilChanges}
                    onValueChange={(value) => setAddCarForm({ ...addCarForm, freeDealershipOilChanges: value })}
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
              <div>
                <Label className="text-muted-foreground">Dealership Address</Label>
                <Input
                  value={addCarForm.dealershipAddress}
                  onChange={(e) => setAddCarForm({ ...addCarForm, dealershipAddress: e.target.value })}
                  className="bg-card border-border text-foreground"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Fuel Type</Label>
                  <Select
                    value={addCarForm.fuelType}
                    onValueChange={(value) => setAddCarForm({ ...addCarForm, fuelType: value })}
                  >
                    <SelectTrigger className="bg-card border-border text-foreground">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
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
                </div>
                <div>
                  <Label className="text-muted-foreground">Tire Size</Label>
                  <Input
                    value={addCarForm.tireSize}
                    onChange={(e) => setAddCarForm({ ...addCarForm, tireSize: e.target.value })}
                    placeholder="225/50R17"
                    className="bg-card border-border text-foreground"
                  />
                </div>
              </div>
              <div className="col-span-2">
                <Label className="text-muted-foreground mb-4 block">Features (check all that apply)</Label>
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
                      <div key={feature} className="flex items-center space-x-3">
                        <Checkbox
                          id={`feature-${feature}`}
                          checked={addCarForm.vehicleFeatures.includes(feature)}
                          onCheckedChange={(checked) => {
                            const currentValue = addCarForm.vehicleFeatures || [];
                            if (checked) {
                              setAddCarForm({ ...addCarForm, vehicleFeatures: [...currentValue, feature] });
                            } else {
                              setAddCarForm({ ...addCarForm, vehicleFeatures: currentValue.filter((f) => f !== feature) });
                            }
                          }}
                          className="border-border"
                        />
                        <Label
                          htmlFor={`feature-${feature}`}
                          className="text-muted-foreground text-sm font-normal cursor-pointer"
                        >
                          {feature}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Status *</Label>
                <Select
                  value={addCarForm.status}
                  onValueChange={(value) => setAddCarForm({ ...addCarForm, status: value })}
                >
                  <SelectTrigger className="bg-card border-border text-foreground">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground">
                    <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                    <SelectItem value="INACTIVE">INACTIVE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Financial Information Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-primary border-b border-border pb-2">
                Financial Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Purchase Price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={addCarForm.purchasePrice}
                    onChange={(e) => setAddCarForm({ ...addCarForm, purchasePrice: e.target.value })}
                    placeholder="0.00"
                    className="bg-card border-border text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">Down Payment</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={addCarForm.downPayment}
                    onChange={(e) => setAddCarForm({ ...addCarForm, downPayment: e.target.value })}
                    placeholder="0.00"
                    className="bg-card border-border text-foreground"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Monthly Payment</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={addCarForm.monthlyPayment}
                    onChange={(e) => setAddCarForm({ ...addCarForm, monthlyPayment: e.target.value })}
                    placeholder="0.00"
                    className="bg-card border-border text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">Interest Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={addCarForm.interestRate}
                    onChange={(e) => setAddCarForm({ ...addCarForm, interestRate: e.target.value })}
                    placeholder="0.00"
                    className="bg-card border-border text-foreground"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Transport City to City</Label>
                  <Input
                    value={addCarForm.transportCityToCity}
                    onChange={(e) => setAddCarForm({ ...addCarForm, transportCityToCity: e.target.value })}
                    className="bg-card border-border text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">Ultimate Goal</Label>
                  <Input
                    value={addCarForm.ultimateGoal}
                    onChange={(e) => setAddCarForm({ ...addCarForm, ultimateGoal: e.target.value })}
                    className="bg-card border-border text-foreground"
                  />
                </div>
              </div>
            </div>

            {/* Insurance Information Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-primary border-b border-border pb-2">
                Insurance Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Provider</Label>
                  <Input
                    value={addCarForm.insuranceProvider}
                    onChange={(e) => setAddCarForm({ ...addCarForm, insuranceProvider: e.target.value })}
                    className="bg-card border-border text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">Phone</Label>
                  <Input
                    type="tel"
                    value={addCarForm.insurancePhone}
                    onChange={(e) => setAddCarForm({ ...addCarForm, insurancePhone: e.target.value })}
                    className="bg-card border-border text-foreground"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Policy Number</Label>
                  <Input
                    value={addCarForm.policyNumber}
                    onChange={(e) => setAddCarForm({ ...addCarForm, policyNumber: e.target.value })}
                    className="bg-card border-border text-foreground font-mono"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">Expiration</Label>
                  <Input
                    type="date"
                    value={addCarForm.insuranceExpiration}
                    onChange={(e) => setAddCarForm({ ...addCarForm, insuranceExpiration: e.target.value })}
                    className="bg-card border-border text-foreground"
                  />
                </div>
              </div>
            </div>

            {/* Car Login Information Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-primary border-b border-border pb-2">
                Car Login Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Car Manufacturer Website</Label>
                  <Input
                    type="url"
                    value={addCarForm.carManufacturerWebsite}
                    onChange={(e) => setAddCarForm({ ...addCarForm, carManufacturerWebsite: e.target.value })}
                    placeholder="https://example.com"
                    className="bg-card border-border text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">Manufacturer Username</Label>
                  <Input
                    value={addCarForm.carManufacturerUsername}
                    onChange={(e) => setAddCarForm({ ...addCarForm, carManufacturerUsername: e.target.value })}
                    className="bg-card border-border text-foreground"
                  />
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Password</Label>
                <Input
                  type="password"
                  value={addCarForm.password}
                  onChange={(e) => setAddCarForm({ ...addCarForm, password: e.target.value })}
                  className="bg-card border-border text-foreground font-mono"
                />
              </div>
            </div>

            {/* Car Links Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-primary border-b border-border pb-2">
                Car Links
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Turo Link</Label>
                  <Input
                    value={addCarForm.turoLink}
                    onChange={(e) => setAddCarForm({ ...addCarForm, turoLink: e.target.value })}
                    placeholder="https://turo.com/..."
                    className="bg-card border-border text-foreground"
                  />
                </div>
                <div>
                  <Label className="text-muted-foreground">Admin Turo Link</Label>
                  <Input
                    value={addCarForm.adminTuroLink}
                    onChange={(e) => setAddCarForm({ ...addCarForm, adminTuroLink: e.target.value })}
                    placeholder="https://turo.com/..."
                    className="bg-card border-border text-foreground"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddCarOpen(false)}
                className="border-border text-muted-foreground hover:bg-muted/50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addCarMutation.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/80"
              >
                {addCarMutation.isPending ? "Adding..." : "Add Car"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Banking Info Modal */}
      <AddEditBankingInfoModal
        isOpen={isBankingModalOpen}
        onClose={() => {
          setIsBankingModalOpen(false);
          setEditingBankingInfo(null);
        }}
        clientId={clientId!}
        bankingInfo={editingBankingInfo}
        cars={client?.cars || []}
      />

      {/* Delete Banking Info Confirmation Dialog */}
      <Dialog
        open={deletingBankingId !== null}
        onOpenChange={(open) => !open && setDeletingBankingId(null)}
      >
        <DialogContent className="bg-background border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-primary">Delete Banking Information</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to delete this banking information? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setDeletingBankingId(null)}
              className="border-border text-muted-foreground hover:bg-card"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (deletingBankingId) {
                  deleteBankingInfoMutation.mutate(deletingBankingId);
                }
              }}
              disabled={deleteBankingInfoMutation.isPending}
              className="bg-red-500/20 text-red-700 border-red-500/50 text-foreground hover:bg-red-500/30 text-red-700"
            >
              {deleteBankingInfoMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
