import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search, Eye, ChevronLeft, ChevronRight, X, Plus, Upload, FileSpreadsheet, Loader2, UserCheck, UserX, Ban, Lock, Download, RefreshCw } from "lucide-react";
import { TableRowSkeleton } from "@/components/ui/skeletons";
import { buildApiUrl } from "@/lib/queryClient";
import { TablePagination, ItemsPerPage } from "@/components/ui/table-pagination";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { getOnlineStatusBadge } from "@/lib/onlineStatus";

interface Client {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  roleId: number;
  roleName: string;
  isActive: boolean;
  status?: number; // 0 = Active (Access), 1 = Inactive (Access), 2 = Inactive (Suspend), 3 = Inactive (Block)
  createdAt: string;
  carCount: number;
  lastLoginAt?: string | null;
  lastLogoutAt?: string | null;
}

const clientSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  // Personal Information (matches Edit Client Details)
  birthday: z.string().optional(),
  tshirtSize: z.string().optional(),
  ssn: z.string().optional(),
  representative: z.string().optional(),
  heardAboutUs: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  // Address Information
  streetAddress: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  bankName: z.string().optional(),
  taxClassification: z.string().optional(),
  bankRoutingNumber: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  businessName: z.string().optional(),
  ein: z.string().optional(),
});

type ClientFormData = z.infer<typeof clientSchema>;

export default function ClientsPage() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  
  // Load items per page from localStorage, default to 10
  const [itemsPerPage, setItemsPerPage] = useState<ItemsPerPage>(() => {
    const saved = localStorage.getItem("clients_limit");
    return (saved ? parseInt(saved) : 10) as ItemsPerPage;
  });

  // Save to localStorage when itemsPerPage changes
  useEffect(() => {
    localStorage.setItem("clients_limit", itemsPerPage.toString());
  }, [itemsPerPage]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importErrors, setImportErrors] = useState<Array<{ row: number; error: string }>>([]);
  const [showImportErrors, setShowImportErrors] = useState(false);
  const [deleteClientId, setDeleteClientId] = useState<number | null>(null);
  const [revokeClientEmail, setRevokeClientEmail] = useState<string | null>(null);
  const [reactivateClientEmail, setReactivateClientEmail] = useState<string | null>(null);
  const [blockClientEmail, setBlockClientEmail] = useState<string | null>(null);
  const [deleteClientEmail, setDeleteClientEmail] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State to force re-render for real-time online status calculation
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update current time every 10 seconds to recalculate online status in real-time
  // This ensures status changes (online -> offline) are reflected immediately
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 10000); // Update every 10 seconds for more responsive status updates

    return () => clearInterval(interval);
  }, []);

  // Refetch query when page becomes visible (using Visibility API)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [queryClient]);

  const { data, isLoading, error, refetch } = useQuery<{
    success: boolean;
    data: Client[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>({
    queryKey: ["/api/clients", searchQuery, statusFilter, page, itemsPerPage],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams();
      // Only include search if it's not empty after trimming
      if (searchQuery && searchQuery.trim()) {
        params.append("search", searchQuery.trim());
      }
      if (statusFilter !== "all") params.append("status", statusFilter);
      params.append("page", page.toString());
      params.append("limit", itemsPerPage.toString());

      const url = buildApiUrl(`/api/clients?${params.toString()}`);
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) {
        // Handle 401 gracefully (expected when not authenticated)
        if (response.status === 401) {
          console.log("🔒 [CLIENTS] Not authenticated (401). Returning empty data.");
          return {
            success: true,
            data: [],
            pagination: { page: 1, limit: itemsPerPage, total: 0, totalPages: 0 },
          };
        }
        const errorData = await response.json().catch(() => ({ error: "Database connection failed" }));
        throw new Error(errorData.error || "Failed to fetch clients");
      }
      return response.json();
    },
    // Retry on database connection errors with exponential backoff
    retry: (failureCount, error) => {
      // Retry up to 3 times for database connection errors
      if (failureCount < 3) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('Database') || errorMessage.includes('connection') || errorMessage.includes('timeout')) {
          console.log(`🔄 [CLIENTS] Retrying database query (attempt ${failureCount + 1}/3)...`);
          return true;
        }
      }
      return false;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff, max 10 seconds
    // Poll backend every 2 seconds to get updated lastLoginAt/lastLogoutAt values immediately
    // This ensures login/logout events are reflected within 2 seconds
    refetchInterval: 2000,
    // Refetch when window regains focus
    refetchOnWindowFocus: true,
    // Refetch when browser tab becomes visible
    refetchOnMount: true,
  });

  const clients = data?.data || [];
  const pagination = data?.pagination;

  // Validate page number when pagination data changes
  useEffect(() => {
    if (pagination && pagination.totalPages > 0) {
      // If current page exceeds total pages, reset to last valid page
      if (page > pagination.totalPages) {
        setPage(pagination.totalPages);
      }
      // Ensure page is at least 1
      if (page < 1) {
        setPage(1);
      }
    }
  }, [pagination, page]);

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      birthday: "",
      tshirtSize: "",
      ssn: "",
      representative: "",
      heardAboutUs: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      status: "INACTIVE",
      streetAddress: "",
      city: "",
      state: "",
      zipCode: "",
      bankName: "",
      taxClassification: "",
      bankRoutingNumber: "",
      bankAccountNumber: "",
      businessName: "",
      ein: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ClientFormData) => {
      const response = await fetch(buildApiUrl("/api/clients"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create client");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      
      // Show appropriate message based on email status
      if (data.emailSent) {
        toast({
          title: "Success",
          description: data.message || "Client created successfully. Password creation email has been sent.",
        });
      } else {
        toast({
          title: "Client Created",
          description: data.message || "Client created successfully, but password email could not be sent. You can resend it from the client detail page.",
          variant: "default",
        });
      }
      
      setIsAddModalOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create client",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(buildApiUrl(`/api/clients/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete client");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Success",
        description: "Client deleted successfully",
      });
      setDeleteClientId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete client",
        variant: "destructive",
      });
    },
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(buildApiUrl("/api/admin/onboarding/import"), {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || error.message || "Failed to import clients");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/submissions"] });
      
      // Handle response structure - data might be nested or flat
      const importData = data.data || data;
      const { total = 0, successful = 0, failed = 0, errors = [] } = importData;
      
      // Show success toast
      toast({
        title: "Import Completed",
        description: `${successful} of ${total} records imported successfully${failed > 0 ? `. ${failed} failed.` : ''}`,
        variant: failed > 0 ? "default" : "default",
      });

      if (failed > 0 && errors.length > 0) {
        // Log errors for debugging (less alarming since we show them in UI)
        console.log("📋 [IMPORT] Import completed with errors:", errors);
        setImportErrors(errors);
        setShowImportErrors(true);
        // Keep modal open if there are errors so user can see them
      } else {
      setIsImportModalOpen(false);
      setImportFile(null);
        setImportErrors([]);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import clients and cars",
        variant: "destructive",
      });
    },
  });

  const handleImport = () => {
    if (!importFile) {
      toast({
        title: "No File Selected",
        description: "Please select an Excel or CSV file to import",
        variant: "destructive",
      });
      return;
    }

    importMutation.mutate(importFile);
  };

  const handleViewClient = (clientId: number) => {
    setLocation(`/admin/clients/${clientId}`);
  };

  const handleDeleteClick = (e: React.MouseEvent, clientId: number, clientName: string) => {
    e.stopPropagation();
    setDeleteClientId(clientId);
  };

  const handleConfirmDelete = () => {
    if (deleteClientId) {
      deleteMutation.mutate(deleteClientId);
    }
  };

  // Helper function to get user ID from email
  const getUserIdByEmail = async (email: string): Promise<number | null> => {
    try {
      const encodedEmail = encodeURIComponent(email);
      const response = await fetch(buildApiUrl(`/api/users/by-email/${encodedEmail}`), {
        credentials: "include",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "User not found" }));
        console.error("Error fetching user ID:", errorData.error);
        return null;
      }
      const data = await response.json();
      if (data.success && data.data) {
        return data.data.id;
      }
      return null;
    } catch (error) {
      console.error("Error fetching user ID:", error);
      return null;
    }
  };

  // Revoke access mutation (suspend - temporary)
  const revokeAccessMutation = useMutation({
    mutationFn: async (email: string) => {
      const userId = await getUserIdByEmail(email);
      if (!userId) {
        // If user doesn't exist in user table, update client table directly
        const response = await fetch(buildApiUrl(`/api/clients/revoke-access`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email }),
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to revoke client access");
        }
        return response.json();
      }
      const response = await fetch(buildApiUrl(`/api/users/${userId}/revoke`), {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to revoke user access");
      }
      return response.json();
    },
    onSuccess: async () => {
      // Immediately invalidate and refetch to update online status
      await queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      await refetch();
      toast({
        title: "Success",
        description: "Client access revoked successfully. The user can no longer log in.",
      });
      setRevokeClientEmail(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to revoke client access",
        variant: "destructive",
      });
    },
  });

  // Block user mutation (permanent block - sets status to 3)
  const blockUserMutation = useMutation({
    mutationFn: async (email: string) => {
      const userId = await getUserIdByEmail(email);
      if (!userId) {
        // If user doesn't exist in user table, update client table directly
        const response = await fetch(buildApiUrl(`/api/clients/block`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email }),
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to block client account");
        }
        return response.json();
      }
      const response = await fetch(buildApiUrl(`/api/users/${userId}/block`), {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to block user account");
      }
      return response.json();
    },
    onSuccess: async () => {
      // Immediately invalidate and refetch to update online status
      await queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      await refetch();
      toast({
        title: "Success",
        description: "Client account permanently blocked successfully. The user cannot register or access their account.",
      });
      setBlockClientEmail(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to block client account",
        variant: "destructive",
      });
    },
  });

  // Reactivate access mutation
  const reactivateAccessMutation = useMutation({
    mutationFn: async (email: string) => {
      const userId = await getUserIdByEmail(email);
      if (!userId) {
        // If user doesn't exist in user table, update client table directly
        const response = await fetch(buildApiUrl(`/api/clients/reactivate-access`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email }),
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to reactivate client access");
        }
        return response.json();
      }
      const response = await fetch(buildApiUrl(`/api/users/${userId}/reactivate`), {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reactivate user access");
      }
      return response.json();
    },
    onSuccess: async () => {
      // Immediately invalidate and refetch to update online status
      await queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      await refetch();
      toast({
        title: "Success",
        description: "Client access reactivated successfully. The user can now log in again.",
      });
      setReactivateClientEmail(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reactivate client access",
        variant: "destructive",
      });
    },
  });

  // Delete user mutation (permanent) - deletes both client and user
  const deleteUserMutation = useMutation({
    mutationFn: async ({ clientId, email }: { clientId: number; email: string }) => {
      // First delete the client
      const clientResponse = await fetch(buildApiUrl(`/api/clients/${clientId}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!clientResponse.ok) {
        const error = await clientResponse.json();
        throw new Error(error.error || "Failed to delete client");
      }

      // Then delete the user account
      const userId = await getUserIdByEmail(email);
      if (userId) {
        const userResponse = await fetch(buildApiUrl(`/api/users/${userId}`), {
          method: "DELETE",
          credentials: "include",
        });
        if (!userResponse.ok) {
          const error = await userResponse.json();
          throw new Error(error.error || "Failed to delete user account");
        }
      }

      return { success: true };
    },
    onSuccess: async () => {
      // Immediately invalidate and refetch to update online status
      await queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      await refetch();
      toast({
        title: "Success",
        description: "Client and user account permanently deleted. All related data has been removed.",
      });
      setDeleteClientEmail(null);
      setDeleteClientId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete client",
        variant: "destructive",
      });
    },
  });

  const handleRevokeAccess = (clientEmail: string) => {
    setRevokeClientEmail(clientEmail);
  };

  const handleConfirmRevoke = () => {
    if (revokeClientEmail) {
      revokeAccessMutation.mutate(revokeClientEmail);
    }
  };

  const handleDeleteUser = (clientId: number, clientEmail: string) => {
    setDeleteClientId(clientId);
    setDeleteClientEmail(clientEmail);
  };

  const handleConfirmDeleteUser = () => {
    if (deleteClientId && deleteClientEmail) {
      deleteUserMutation.mutate({ clientId: deleteClientId, email: deleteClientEmail });
    }
  };

  const handleReactivateAccess = (clientEmail: string) => {
    setReactivateClientEmail(clientEmail);
  };

  const handleConfirmReactivate = () => {
    if (reactivateClientEmail) {
      reactivateAccessMutation.mutate(reactivateClientEmail);
    }
  };

  const handleBlockUser = (email: string) => {
    setBlockClientEmail(email);
  };

  const handleConfirmBlock = () => {
    if (blockClientEmail) {
      blockUserMutation.mutate(blockClientEmail);
    }
  };

  const onSubmit = (data: ClientFormData) => {
    createMutation.mutate(data);
  };

  const formatDate = (dateString: string) => {
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

  return (
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary mb-1 sm:mb-2">Clients</h1>
            <p className="text-muted-foreground text-xs sm:text-sm">Manage your client database</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={() => setIsImportModalOpen(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/80 w-full sm:w-auto"
            >
              <Upload className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Import</span>
              <span className="sm:hidden">Import</span>
            </Button>
            <Button
              onClick={async () => {
                try {
                  // Download Excel file
                  const excelResponse = await fetch(buildApiUrl("/api/admin/onboarding/export?format=xlsx"), {
                    credentials: "include",
                    method: "GET",
                  });
                  
                  if (!excelResponse.ok) {
                    // Check if response is JSON (error response)
                    const contentType = excelResponse.headers.get("content-type");
                    if (contentType && contentType.includes("application/json")) {
                      const errorData = await excelResponse.json();
                      throw new Error(errorData.message || errorData.error || `Failed to download Excel file (${excelResponse.status})`);
                    }
                    throw new Error(`Failed to download Excel file (${excelResponse.status} ${excelResponse.statusText})`);
                  }
                  
                  const excelBlob = await excelResponse.blob();
                  const excelUrl = window.URL.createObjectURL(excelBlob);
                  const excelLink = document.createElement("a");
                  excelLink.href = excelUrl;
                  excelLink.download = "onboarding_submissions_lyc_example.xlsx";
                  document.body.appendChild(excelLink);
                  excelLink.click();
                  document.body.removeChild(excelLink);
                  window.URL.revokeObjectURL(excelUrl);

                  // Download CSV file
                  const csvResponse = await fetch(buildApiUrl("/api/admin/onboarding/export?format=csv"), {
                    credentials: "include",
                    method: "GET",
                  });
                  
                  if (!csvResponse.ok) {
                    // Check if response is JSON (error response)
                    const contentType = csvResponse.headers.get("content-type");
                    if (contentType && contentType.includes("application/json")) {
                      const errorData = await csvResponse.json();
                      throw new Error(errorData.message || errorData.error || `Failed to download CSV file (${csvResponse.status})`);
                    }
                    throw new Error(`Failed to download CSV file (${csvResponse.status} ${csvResponse.statusText})`);
                  }
                  
                  const csvBlob = await csvResponse.blob();
                  const csvUrl = window.URL.createObjectURL(csvBlob);
                  const csvLink = document.createElement("a");
                  csvLink.href = csvUrl;
                  csvLink.download = "onboarding_submissions_lyc_example.csv";
                  document.body.appendChild(csvLink);
                  csvLink.click();
                  document.body.removeChild(csvLink);
                  window.URL.revokeObjectURL(csvUrl);

                  toast({
                    title: "Download Complete",
                    description: "Example Excel and CSV files downloaded successfully",
                  });
                } catch (error: any) {
                  console.error("Download error:", error);
                  toast({
                    title: "Download Failed",
                    description: error.message || "Failed to download example files. Please ensure you are logged in.",
                    variant: "destructive",
                  });
                }
              }}
              className="bg-primary text-primary-foreground hover:bg-primary/80 w-full sm:w-auto"
            >
              <Download className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Download</span>
              <span className="sm:hidden">Download</span>
            </Button>
            <Button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/80 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 sm:mr-2" />
              Add
            </Button>
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
                  placeholder="Search by name, email, phone, or ID..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="pl-10 bg-card border-border text-foreground placeholder:text-gray-600"
                />
              </div>
              <Select value={statusFilter} onValueChange={(value) => {
                setStatusFilter(value);
                setPage(1); // Reset to first page when filter changes
              }}>
                <SelectTrigger className="w-full md:w-[200px] bg-card border-border text-foreground">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              {(searchQuery || statusFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                    setPage(1);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Clients Table */}
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            <div className="overflow-x-auto -mx-3 sm:mx-0">
              <Table className="min-w-[1000px]">
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-center text-foreground font-semibold px-2 sm:px-4 md:px-6 py-3 sm:py-4 w-12 sm:w-16 text-[10px] sm:text-xs">No</TableHead>
                    <TableHead className="text-left text-foreground font-semibold px-2 sm:px-4 md:px-6 py-3 sm:py-4 min-w-[150px] sm:min-w-[200px] text-[10px] sm:text-xs">Full Name</TableHead>
                    <TableHead className="text-left text-foreground font-semibold px-2 sm:px-4 md:px-6 py-3 sm:py-4 min-w-[140px] sm:min-w-[180px] text-[10px] sm:text-xs hidden lg:table-cell">Email</TableHead>
                    <TableHead className="text-left text-foreground font-semibold px-2 sm:px-4 md:px-6 py-3 sm:py-4 min-w-[100px] sm:min-w-[140px] text-[10px] sm:text-xs hidden xl:table-cell">Phone</TableHead>
                    <TableHead className="text-left text-foreground font-semibold px-2 sm:px-4 md:px-6 py-3 sm:py-4 w-24 sm:w-32 text-[10px] sm:text-xs">Role</TableHead>
                    <TableHead className="text-left text-foreground font-semibold px-2 sm:px-4 md:px-6 py-3 sm:py-4 w-20 sm:w-28 text-[10px] sm:text-xs">Status</TableHead>
                    <TableHead className="text-left text-foreground font-semibold px-2 sm:px-4 md:px-6 py-3 sm:py-4 min-w-[100px] sm:min-w-[140px] text-[10px] sm:text-xs hidden md:table-cell">Joined Date</TableHead>
                    <TableHead className="text-left text-foreground font-semibold px-2 sm:px-4 md:px-6 py-3 sm:py-4 min-w-[100px] sm:min-w-[120px] text-[10px] sm:text-xs">Online Status</TableHead>
                    <TableHead className="text-center text-foreground font-semibold px-2 sm:px-4 md:px-6 py-3 sm:py-4 w-24 sm:w-32 text-[10px] sm:text-xs hidden lg:table-cell">Counts of Cars</TableHead>
                    <TableHead className="text-center text-foreground font-semibold px-2 sm:px-4 md:px-6 py-3 sm:py-4 w-20 sm:w-28 text-[10px] sm:text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRowSkeleton colSpan={10} rows={5} />
                  ) : error ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8">
                        <div className="flex flex-col items-center gap-3">
                          <p className="text-red-400">
                            {error instanceof Error ? error.message : "Database connection failed. Please try again."}
                          </p>
                          <Button
                            size="sm"
                            onClick={() => refetch()}
                            className="bg-primary text-primary-foreground hover:bg-primary/80"
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Retry
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : clients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        No clients found. Try adjusting your search or filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    clients.map((client, index) => {
                      const rowNumber = (pagination ? (pagination.page - 1) * pagination.limit : 0) + index + 1;
                      // Calculate online status badge once per client (recalculates on each render due to currentTime state)
                      // Pass account status and logout time to ensure deactivated/blocked/deleted/logged-out clients show as offline
                      // Online Status is based ONLY on login/logout activity, NOT on account status
                      const onlineStatusBadge = getOnlineStatusBadge(
                        client.lastLoginAt,
                        client.lastLogoutAt // lastLogoutAt - if exists and more recent than login, user is offline
                      );
                      return (
                        <TableRow
                          key={client.id}
                          className="border-border group"
                        >
                          <TableCell className="text-center text-primary font-medium px-2 sm:px-4 md:px-6 py-3 sm:py-4 align-middle text-xs sm:text-sm">
                            {rowNumber}
                          </TableCell>
                          <TableCell className="text-left text-foreground font-medium px-2 sm:px-4 md:px-6 py-3 sm:py-4 align-middle text-xs sm:text-sm">
                            {client.firstName} {client.lastName}
                          </TableCell>
                          <TableCell className="text-left text-muted-foreground px-2 sm:px-4 md:px-6 py-3 sm:py-4 align-middle text-xs sm:text-sm hidden lg:table-cell">
                            {client.email}
                          </TableCell>
                          <TableCell className="text-left text-muted-foreground px-2 sm:px-4 md:px-6 py-3 sm:py-4 align-middle text-xs sm:text-sm hidden xl:table-cell">
                            {client.phone || <span className="text-gray-600">N/A</span>}
                          </TableCell>
                          <TableCell className="text-left px-2 sm:px-4 md:px-6 py-3 sm:py-4 align-middle">
                            <Badge
                              variant="outline"
                              className="bg-[#D3BC8D]/10 text-black border-primary/30 text-xs font-medium"
                            >
                              {client.roleName}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-left px-2 sm:px-4 md:px-6 py-3 sm:py-4 align-middle">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs font-medium",
                                client.status === 3
                                  ? "bg-red-500/20 text-red-700 border-red-500/30"
                                  : client.status === 0
                                  ? "bg-green-500/20 text-green-700 border-green-500/30"
                                  : "bg-gray-500/20 text-gray-700 border-gray-500/30"
                              )}
                            >
                              {client.status === 3 ? "Blocked" : client.status === 0 ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-left text-muted-foreground px-2 sm:px-4 md:px-6 py-3 sm:py-4 align-middle text-xs sm:text-sm hidden md:table-cell">
                            {formatDate(client.createdAt)}
                          </TableCell>
                          <TableCell className="text-left px-2 sm:px-4 md:px-6 py-3 sm:py-4 align-middle">
                            <Badge
                              variant="outline"
                              className={cn(onlineStatusBadge.className, "text-xs")}
                            >
                              {onlineStatusBadge.text}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground px-2 sm:px-4 md:px-6 py-3 sm:py-4 align-middle text-xs sm:text-sm hidden lg:table-cell">
                            {client.carCount}
                          </TableCell>
                          <TableCell className="text-center px-2 sm:px-4 md:px-6 py-3 sm:py-4 align-middle">
                            <div className="flex items-center justify-center gap-2">
                              {/* View Client - Eye icon */}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 w-9 p-0 text-primary hover:text-primary/80 hover:bg-primary/10 rounded-full"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewClient(client.id);
                                }}
                                title="View Client Details"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              
                              {/* Grant Access / Suspend - Toggle based on status */}
                              {/* Status 0 = Active (Access) - Show Suspend button */}
                              {client.status === 0 ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-9 w-9 p-0 text-yellow-700 hover:text-yellow-800 hover:bg-yellow-500/10 rounded-full"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRevokeAccess(client.email);
                                  }}
                                  disabled={revokeAccessMutation.isPending || reactivateAccessMutation.isPending}
                                  title="Suspend Access (Temporary)"
                                >
                                  {revokeAccessMutation.isPending && revokeClientEmail === client.email ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                  <Lock className="w-4 h-4" />
                                  )}
                                </Button>
                              ) : client.status === 1 ? (
                                // Status 1 = Inactive (Access) - Show Suspend button
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-9 w-9 p-0 text-yellow-700 hover:text-yellow-800 hover:bg-yellow-500/10 rounded-full"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRevokeAccess(client.email);
                                  }}
                                  disabled={revokeAccessMutation.isPending || reactivateAccessMutation.isPending}
                                  title="Suspend Access (Temporary)"
                                >
                                  {revokeAccessMutation.isPending && revokeClientEmail === client.email ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Lock className="w-4 h-4" />
                                  )}
                                </Button>
                              ) : client.status === 2 ? (
                                // Status 2 = Inactive (Suspend) - Show Grant Access button to reactivate
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-9 w-9 p-0 text-green-700 hover:text-green-800 hover:bg-green-500/10 rounded-full"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReactivateAccess(client.email);
                                  }}
                                  disabled={reactivateAccessMutation.isPending || revokeAccessMutation.isPending}
                                  title="Grant/Reactivate Access"
                                >
                                  {reactivateAccessMutation.isPending && reactivateClientEmail === client.email ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <UserCheck className="w-4 h-4" />
                                  )}
                                </Button>
                              ) : client.status === 3 ? (
                                // Status 3 = Inactive (Block) - Show disabled Suspend button
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-9 w-9 p-0 text-yellow-400 hover:text-yellow-700 hover:bg-yellow-500/10 rounded-full opacity-50 cursor-not-allowed"
                                  disabled={true}
                                  title="Account is blocked - Cannot suspend"
                                >
                                  <Lock className="w-4 h-4" />
                                </Button>
                              ) : null}
                              {/* Status 3 = Inactive (Block) - Buttons shown but disabled (except view) */}
                              
                              {/* Block Account - Ban icon - Show but disable if blocked (status === 3) */}
                              {client.status === 3 ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-9 w-9 p-0 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded-full opacity-50 cursor-not-allowed"
                                  disabled={true}
                                  title="Account is blocked - Cannot perform actions"
                                >
                                  <Ban className="w-4 h-4" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-9 w-9 p-0 text-red-700 hover:text-red-800 hover:bg-red-500/10 rounded-full"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleBlockUser(client.email);
                                  }}
                                  title="Permanently Block Account"
                                >
                                  <Ban className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {pagination && pagination.total > 0 && (
              <TablePagination
                totalItems={pagination.total}
                itemsPerPage={itemsPerPage}
                currentPage={Math.min(page, pagination.totalPages)} // Ensure page doesn't exceed totalPages
                onPageChange={(newPage) => {
                  // Validate page number
                  const validPage = Math.max(1, Math.min(newPage, pagination.totalPages));
                  setPage(validPage);
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

        {/* Add Client Modal */}
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogContent className="bg-card border-border text-foreground max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl font-semibold text-primary">Add New Client</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Create a new client in the system
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
                {/* Personal Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary border-b border-primary/30 pb-2">
                    Personal Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">First Name *</FormLabel>
                          <FormControl>
                            <Input {...field} className="bg-card border-border text-foreground focus:border-primary" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">Last Name *</FormLabel>
                          <FormControl>
                            <Input {...field} className="bg-card border-border text-foreground focus:border-primary" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">Email *</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" className="bg-card border-border text-foreground focus:border-primary" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">Phone</FormLabel>
                          <FormControl>
                            <Input {...field} className="bg-card border-border text-foreground focus:border-primary" />
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
                          <FormLabel className="text-muted-foreground">Date of Birth</FormLabel>
                          <FormControl>
                            <Input {...field} type="date" className="bg-card border-border text-foreground focus:border-primary" />
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
                          <FormLabel className="text-muted-foreground">T-Shirt Size</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                          <FormControl>
                              <SelectTrigger className="bg-card border-border text-foreground focus:border-primary">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                          </FormControl>
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
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="representative"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">Representative</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || undefined}>
                            <FormControl>
                              <SelectTrigger className="bg-card border-border text-foreground focus:border-primary">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-card border-border text-foreground">
                              {["Jay Barton", "Jenn Mason", "Brynn Lunn", "Other"].map((rep) => (
                                <SelectItem key={rep} value={rep}>
                                  {rep}
                                </SelectItem>
                              ))}
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
                          <FormLabel className="text-muted-foreground">How Did You Hear About Us</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                          <FormControl>
                              <SelectTrigger className="bg-card border-border text-foreground focus:border-primary">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                          </FormControl>
                            <SelectContent className="bg-card border-border text-foreground">
                              <SelectItem value="Friend">Friend</SelectItem>
                              <SelectItem value="Google">Google</SelectItem>
                              <SelectItem value="Social Media">Social Media</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="emergencyContactName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">Emergency Contact Name</FormLabel>
                          <FormControl>
                            <Input {...field} className="bg-card border-border text-foreground focus:border-primary" />
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
                          <FormLabel className="text-muted-foreground">Emergency Contact Phone</FormLabel>
                          <FormControl>
                            <Input {...field} className="bg-card border-border text-foreground focus:border-primary" />
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
                          <FormLabel className="text-muted-foreground">Client Status</FormLabel>
                          <Select value={field.value || "INACTIVE"} onValueChange={field.onChange}>
                            <SelectTrigger className="bg-card border-border text-foreground">
                              <SelectValue placeholder="Select client status" />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border text-foreground">
                              <SelectItem value="ACTIVE">Active</SelectItem>
                              <SelectItem value="INACTIVE">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />


                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  </div>
                </div>

                {/* Address Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary border-b border-primary/30 pb-2">
                    Address Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="streetAddress"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel className="text-muted-foreground">Street Address</FormLabel>
                          <FormControl>
                            <Input {...field} className="bg-card border-border text-foreground focus:border-primary" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">City</FormLabel>
                          <FormControl>
                            <Input {...field} className="bg-card border-border text-foreground focus:border-primary" />
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
                          <FormLabel className="text-muted-foreground">State</FormLabel>
                          <FormControl>
                            <Input {...field} className="bg-card border-border text-foreground focus:border-primary" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="zipCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">Zip Code</FormLabel>
                          <FormControl>
                            <Input {...field} className="bg-card border-border text-foreground focus:border-primary" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Banking Information (ACH) */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-primary border-b border-primary/30 pb-2">
                    Banking Information (ACH)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="bankName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">Bank Name</FormLabel>
                          <FormControl>
                            <Input {...field} className="bg-card border-border text-foreground focus:border-primary" />
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
                          <FormLabel className="text-muted-foreground">Tax Classification</FormLabel>
                          <Select value={field.value || ""} onValueChange={field.onChange}>
                            <SelectTrigger className="bg-card border-border text-foreground">
                              <SelectValue placeholder="Select tax classification" />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border text-foreground">
                              <SelectItem value="individual">Individual</SelectItem>
                              <SelectItem value="business">Business</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="bankRoutingNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">Routing Number</FormLabel>
                          <FormControl>
                            <Input {...field} className="bg-card border-border text-foreground font-mono focus:border-primary" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="bankAccountNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">Account Number</FormLabel>
                          <FormControl>
                            <Input {...field} className="bg-card border-border text-foreground font-mono focus:border-primary" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="businessName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">Business Name</FormLabel>
                          <FormControl>
                            <Input {...field} className="bg-card border-border text-foreground focus:border-primary" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="ssn"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">SSN</FormLabel>
                          <FormControl>
                            <Input {...field} className="bg-card border-border text-foreground font-mono focus:border-primary" />
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
                          <FormLabel className="text-muted-foreground">EIN</FormLabel>
                          <FormControl>
                            <Input {...field} className="bg-card border-border text-foreground font-mono focus:border-primary" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setIsAddModalOpen(false);
                      form.reset();
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-primary text-primary-foreground hover:bg-primary/80 font-medium"
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Delete Client Only Confirmation Modal */}
        <Dialog open={deleteClientId !== null && deleteClientEmail === null} onOpenChange={(open) => !open && setDeleteClientId(null)}>
          <DialogContent className="bg-card border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl font-semibold text-red-400">Delete Client</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {deleteClientId && clients.find(c => c.id === deleteClientId) && (
                  <>Are you sure you want to delete <strong>{clients.find(c => c.id === deleteClientId)?.firstName} {clients.find(c => c.id === deleteClientId)?.lastName}</strong>? This action cannot be undone.</>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="ghost"
                onClick={() => setDeleteClientId(null)}
                className="text-muted-foreground hover:text-foreground"
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmDelete}
                className="bg-red-500 text-foreground hover:bg-red-500/20 text-red-700 border-red-500/50"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Confirm Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Revoke Access Confirmation Dialog */}
        <Dialog open={revokeClientEmail !== null} onOpenChange={(open) => !open && setRevokeClientEmail(null)}>
          <DialogContent className="bg-card border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl font-semibold text-yellow-400">Suspend Client Access</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {revokeClientEmail && clients.find(c => c.email === revokeClientEmail) && (
                  <>
                    Are you sure you want to suspend access for <strong className="text-foreground">{clients.find(c => c.email === revokeClientEmail)?.firstName} {clients.find(c => c.email === revokeClientEmail)?.lastName}</strong>?
                    <br /><br />
                    This will temporarily revoke their login access. The client's data will be preserved and can be reactivated later.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-3 mt-4">
              <Button
                variant="outline"
                onClick={() => setRevokeClientEmail(null)}
                className="border-border text-muted-foreground hover:bg-muted/50"
                disabled={revokeAccessMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmRevoke}
                className="bg-yellow-600 text-foreground hover:bg-yellow-700"
                disabled={revokeAccessMutation.isPending}
              >
                {revokeAccessMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Suspend Access
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Block Account Confirmation Dialog */}
        <Dialog open={blockClientEmail !== null} onOpenChange={(open) => !open && setBlockClientEmail(null)}>
          <DialogContent className="bg-card border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl font-semibold text-red-400">Permanently Block Account</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                This will permanently block the client account. The user will not be able to register or access their account.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              <p className="text-muted-foreground mb-4">
                Are you sure you want to permanently block <strong>{blockClientEmail}</strong>?
              </p>
              <p className="text-yellow-400 text-sm mb-4">
                ⚠️ This action cannot be undone. The account will be permanently blocked.
              </p>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setBlockClientEmail(null)}
                className="border-border text-muted-foreground hover:text-foreground"
                disabled={blockUserMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmBlock}
                className="bg-red-500/20 text-red-700 border-red-500/50 text-foreground hover:bg-red-500/30 text-red-700"
                disabled={blockUserMutation.isPending}
              >
                Permanently Block
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Grant/Reactivate Access Confirmation Dialog */}
        <Dialog open={reactivateClientEmail !== null} onOpenChange={(open) => !open && setReactivateClientEmail(null)}>
          <DialogContent className="bg-card border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl font-semibold text-green-400">Grant Client Access</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {reactivateClientEmail && clients.find(c => c.email === reactivateClientEmail) && (
                  <>
                    Are you sure you want to grant access for <strong className="text-foreground">{clients.find(c => c.email === reactivateClientEmail)?.firstName} {clients.find(c => c.email === reactivateClientEmail)?.lastName}</strong>?
                    <br /><br />
                    This will restore their login access. The client will be able to log in and access their account again.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-3 mt-4">
              <Button
                variant="outline"
                onClick={() => setReactivateClientEmail(null)}
                className="border-border text-muted-foreground hover:bg-muted/50"
                disabled={reactivateAccessMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmReactivate}
                className="bg-green-600 text-foreground hover:bg-green-700"
                disabled={reactivateAccessMutation.isPending}
              >
                Grant Access
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete User Confirmation Dialog */}
        <Dialog open={deleteClientEmail !== null && deleteClientId !== null} onOpenChange={(open) => !open && (setDeleteClientEmail(null), setDeleteClientId(null))}>
          <DialogContent className="bg-card border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl font-semibold text-red-400">Permanently Delete Client</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {deleteClientId && deleteClientEmail && clients.find(c => c.id === deleteClientId) && (
                  <>
                    Are you sure you want to permanently delete <strong className="text-foreground">{clients.find(c => c.id === deleteClientId)?.firstName} {clients.find(c => c.id === deleteClientId)?.lastName}</strong>?
                    <br /><br />
                    <span className="text-red-400 font-semibold">Warning:</span> This action cannot be undone. All client data, user account, cars, contracts, and related information will be permanently deleted.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-3 mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteClientEmail(null);
                  setDeleteClientId(null);
                }}
                className="border-border text-muted-foreground hover:bg-muted/50"
                disabled={deleteUserMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmDeleteUser}
                className="bg-red-500/20 text-red-700 border-red-500/50 text-foreground hover:bg-red-500/30 text-red-700"
                disabled={deleteUserMutation.isPending}
              >
                Delete Permanently
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Import Clients and Cars Modal */}
        <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
          <DialogContent className="bg-card border-border text-foreground max-w-[95vw] sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl font-semibold text-primary flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                Import Clients and Cars
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Upload an Excel (.xlsx, .xls) or CSV file to import existing clients and their cars.
                The file should contain the same fields as the client onboarding form.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <label
                  htmlFor="import-file"
                  className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-primary/40 rounded-xl bg-background/50 hover:border-primary/60 hover:bg-primary/5 transition-all cursor-pointer group"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-10 h-10 text-primary mb-3 group-hover:scale-110 transition-transform" />
                    <p className="mb-2 text-sm font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                      {importFile ? importFile.name : "Click to Upload or Drag and Drop"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Excel (.xlsx, .xls) or CSV file (Max 100MB)
                    </p>
                  </div>
                  <input
                    id="import-file"
                    type="file"
                    accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setImportFile(file);
                      }
                    }}
                    className="hidden"
                  />
                </label>
                {importFile && (
                  <div className="flex items-center justify-between p-3 bg-background rounded-lg border border-border">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5 text-primary" />
                      <span className="text-sm text-muted-foreground">{importFile.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({(importFile.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setImportFile(null)}
                      className="text-muted-foreground hover:text-foreground h-8 w-8 p-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="bg-background p-4 rounded-lg border border-border">
                <p className="text-sm text-muted-foreground mb-2">
                  <strong className="text-primary">Note:</strong> The imported data will:
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Create onboarding submissions with "pending" status</li>
                  <li>Use the same fields as the client onboarding form</li>
                  <li>Require approval before creating client accounts and cars</li>
                  <li>Send email to clients to create password after approval</li>
                </ul>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportFile(null);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                  disabled={importMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleImport}
                  className="bg-primary text-primary-foreground hover:bg-primary/80 font-medium"
                  disabled={!importFile || importMutation.isPending}
                >
                  {importMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Import
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Import Warning Dialog */}
        <Dialog open={showImportErrors} onOpenChange={setShowImportErrors}>
          <DialogContent className="bg-card border-border text-foreground max-w-[95vw] sm:max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl font-semibold text-yellow-400">
                Import Warning ({importErrors.length})
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                The following rows failed to import. Please review and fix the issues.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-2 max-h-[60vh] overflow-y-auto">
              {importErrors.map((error, index) => (
                <div
                  key={index}
                  className="bg-card border border-border rounded-lg p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-semibold text-sm">
                      {error.row}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground break-words">
                        <span className="font-medium text-foreground">Row {error.row}:</span> {error.error}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border">
              <Button
                variant="outline"
                onClick={() => {
                  setShowImportErrors(false);
                  setIsImportModalOpen(false);
                  setImportFile(null);
                  setImportErrors([]);
                }}
                className="bg-card border-border text-foreground hover:bg-muted"
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
