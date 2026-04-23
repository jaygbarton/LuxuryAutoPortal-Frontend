import { useEffect, useMemo, useRef, useState } from "react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { QRCodeSVG } from "qrcode.react";
import { TableRowSkeleton } from "@/components/ui/skeletons";
import { TablePagination, ItemsPerPage } from "@/components/ui/table-pagination";
import { cn } from "@/lib/utils";
import {
  Copy,
  Download,
  Eye,
  FileSpreadsheet,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  UserCheck,
  X,
} from "lucide-react";

interface Employee {
  employee_aid: number;
  employee_status: string;
  employee_is_active: number;
  employee_number: string;
  employee_first_name: string;
  employee_last_name: string;
  employee_middle_name: string;
  employee_email: string;
  employee_mobile_number: string;
  employee_telephone: string;
  employee_ssn_ein: string;
  employee_shirt_size: string;
  employee_street: string;
  employee_city: string;
  employee_state: string;
  employee_country: string;
  employee_zip_code: string;
  employee_mother_name: string;
  employee_father_name: string;
  employee_home_contact: string;
  employee_home_address: string;
  employee_emergency_contact_person: string;
  employee_emergency_relationship: string;
  employee_emergency_address: string;
  employee_emergency_number: string;
  employee_birthday: string;
  employee_marital_status: string;
  employee_created: string;
  employee_updated: string;
  employee_hear_about_gla?: string;
  employee_job_pay_work_email?: string | null;
  employee_job_pay_department_name?: string | null;
  employee_job_pay_job_title_name?: string | null;
  fullname?: string;
}

const employeeSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Last name is required"),
  workEmail: z.string().email("Invalid email address").min(1, "Work email is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
  telephone: z.string().optional(),
  birthday: z.string().optional(),
  maritalStatus: z.string().optional(),
  street: z.string().min(1, "Street is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zipCode: z.string().min(1, "ZIP Code is required"),
  country: z.string().min(1, "Country is required"),
  motherName: z.string().optional(),
  fatherName: z.string().optional(),
  homeContact: z.string().optional(),
  homeAddress: z.string().optional(),
  emergencyContactName: z.string().min(1, "Emergency contact name is required"),
  emergencyContactPhoneNumber: z.string().min(1, "Emergency contact phone number is required"),
  emergencyRelationship: z.string().optional(),
  emergencyAddress: z.string().optional(),
  ssnEin: z.string().min(1, "Social Security Number or EIN is required"),
  shirtSize: z.string().optional(),
  hearAboutGla: z.string().optional(),
});

const MARITAL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "single", label: "Single" },
  { value: "married", label: "Married" },
  { value: "divorced", label: "Divorced" },
  { value: "annulled", label: "Annulled" },
  { value: "legally separated", label: "Legally Separated" },
  { value: "widowed", label: "Widowed" },
];

type EmployeeFormData = z.infer<typeof employeeSchema>;

function formatDate(dateString: string) {
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "N/A";
  }
}

function statusBadge(employee: Employee) {
  if (employee.employee_status === "pending") {
    return { text: "Pending", className: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30" };
  }
  if (employee.employee_status === "offboarded" || employee.employee_status === "separated") {
    return { text: "Offboarded", className: "bg-gray-500/20 text-gray-700 border-gray-500/30 font-medium" };
  }
  if (employee.employee_is_active === 1) {
    return { text: "Active", className: "bg-green-500/20 text-green-700 border-green-500/30" };
  }
  return { text: "Inactive", className: "bg-gray-500/20 text-gray-700 border-gray-500/30 font-medium" };
}

export default function EmployeesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all"); // all | pending | active | inactive
  const [page, setPage] = useState(1);

  const [itemsPerPage, setItemsPerPage] = useState<ItemsPerPage>(() => {
    const saved = localStorage.getItem("employees_limit");
    return (saved ? parseInt(saved) : 10) as ItemsPerPage;
  });

  useEffect(() => {
    localStorage.setItem("employees_limit", itemsPerPage.toString());
  }, [itemsPerPage]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importErrors, setImportErrors] = useState<Array<{ row: number; error: string }>>([]);
  const [showImportErrors, setShowImportErrors] = useState(false);
  
  // File upload states for employee form
  const [carInsurancePhotos, setCarInsurancePhotos] = useState<File[]>([]);
  const [driverLicensePhoto, setDriverLicensePhoto] = useState<File | null>(null);

  const [employeeToApprove, setEmployeeToApprove] = useState<Employee | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [employeeToRestore, setEmployeeToRestore] = useState<Employee | null>(null);

  const [location] = useLocation();
  const employeeIdFromUrl = useMemo(() => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const id = params.get("employeeId");
    return id ? parseInt(id, 10) : null;
  }, [location]);

  const formLink = useMemo(() => `${window.location.origin}/employee-form`, []);
  const [isQRDialogOpen, setIsQRDialogOpen] = useState(false);
  const qrRef = useRef<HTMLDivElement | null>(null);
  // Load employees from database (employees + employee_job_pay tables) via GET /api/employees
  const { data, isLoading, error, refetch } = useQuery<{
    success: boolean;
    data: Employee[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>({
    queryKey: ["/api/employees", searchQuery, statusFilter, page, itemsPerPage],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery && searchQuery.trim()) params.append("search", searchQuery.trim());
      if (statusFilter !== "all") params.append("status", statusFilter);
      params.append("page", page.toString());
      params.append("limit", itemsPerPage.toString());
      const url = buildApiUrl(`/api/employees?${params.toString()}`);
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const err = await response.json().catch(() => ({ error: "Failed to fetch employees" }));
          throw new Error(err.error || err.message || "Failed to fetch employees");
        }
        throw new Error(`Failed to fetch employees (${response.status})`);
      }
      return response.json();
    },
    refetchOnWindowFocus: true,
  });

  // When employeeId in URL (e.g. from Slack), navigate to full view page (v1 style)
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (employeeIdFromUrl) {
      setLocation(`/admin/hr/employees/view?employeeId=${employeeIdFromUrl}`);
    }
  }, [employeeIdFromUrl, setLocation]);

  const employees = data?.data || [];
  const pagination = data?.pagination;

  useEffect(() => {
    if (pagination && pagination.totalPages > 0) {
      if (page > pagination.totalPages) setPage(pagination.totalPages);
      if (page < 1) setPage(1);
    }
  }, [pagination, page]);

  const addForm = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      firstName: "",
      middleName: "",
      lastName: "",
      workEmail: "",
      phoneNumber: "",
      telephone: "",
      birthday: "",
      maritalStatus: "",
      street: "",
      city: "",
      state: "",
      zipCode: "",
      country: "",
      motherName: "",
      fatherName: "",
      homeContact: "",
      homeAddress: "",
      emergencyContactName: "",
      emergencyContactPhoneNumber: "",
      emergencyRelationship: "",
      emergencyAddress: "",
      ssnEin: "",
      shirtSize: "",
      hearAboutGla: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: EmployeeFormData) => {
      // Note: Files are stored in state but backend currently expects JSON
      // Files can be uploaded separately or backend can be updated to accept FormData
      const response = await fetch(buildApiUrl("/api/employees"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          firstName: payload.firstName,
          lastName: payload.lastName,
          middleName: payload.middleName || "",
          // Map to adminCreateSchema fields
          personalEmail: payload.workEmail,
          workEmail: payload.workEmail,
          mobileNumber: payload.phoneNumber,
          telephone: payload.telephone || "",
          birthday: payload.birthday || "",
          maritalStatus: payload.maritalStatus || "",
          street: payload.street,
          city: payload.city,
          state: payload.state,
          country: payload.country,
          zipCode: payload.zipCode,
          motherName: payload.motherName || "",
          fatherName: payload.fatherName || "",
          homeContact: payload.homeContact || "",
          homeAddress: payload.homeAddress || "",
          emergencyContactPerson: payload.emergencyContactName,
          emergencyNumber: payload.emergencyContactPhoneNumber,
          emergencyRelationship: payload.emergencyRelationship || "",
          emergencyAddress: payload.emergencyAddress || "",
          ssnEin: payload.ssnEin,
          shirtSize: payload.shirtSize || "",
          hearAboutGla: payload.hearAboutGla || "",
        }),
      });
      
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Failed to create employee" }));
        throw new Error(err.error || err.message || "Failed to create employee");
      }
      
      const result = await response.json();
      
      // TODO: Upload files separately if backend supports file uploads
      // For now, files are stored in state (carInsurancePhotos, driverLicensePhoto)
      // and can be uploaded via a separate endpoint if needed
      
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: "Success", description: "Employee created successfully." });
      setIsAddModalOpen(false);
      addForm.reset();
      setCarInsurancePhotos([]);
      setDriverLicensePhoto(null);
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message || "Failed to create employee", variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (employeeId: number) => {
      const response = await fetch(buildApiUrl(`/api/employees/${employeeId}/status`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "" }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Failed to approve employee" }));
        throw new Error(err.error || err.message || "Failed to approve employee");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: "Approved", description: "Employee approved successfully." });
      setEmployeeToApprove(null);
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message || "Failed to approve employee", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (employeeId: number) => {
      const response = await fetch(buildApiUrl(`/api/employees/${employeeId}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Failed to delete employee" }));
        throw new Error(err.error || err.message || "Failed to delete employee");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: "Deleted", description: "Employee deleted successfully." });
      setEmployeeToDelete(null);
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message || "Failed to delete employee", variant: "destructive" });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (employeeId: number) => {
      const response = await fetch(buildApiUrl(`/api/employees/${employeeId}/restore`), {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Failed to restore employee" }));
        throw new Error(err.error || err.message || "Failed to restore employee");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: "Restored", description: "Employee restored successfully." });
      setEmployeeToRestore(null);
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message || "Failed to restore employee", variant: "destructive" });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(buildApiUrl("/api/admin/employees/import"), {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Failed to import employees" }));
        throw new Error(err.error || err.message || "Failed to import employees");
      }
      return response.json();
    },
    onSuccess: (resp: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      const payload = resp?.data || resp;
      const total = payload.total || 0;
      const successful = payload.successful || 0;
      const failed = payload.failed || 0;
      const errors = payload.errors || [];

      toast({
        title: "Import Completed",
        description: `${successful} of ${total} records imported successfully${failed > 0 ? `. ${failed} failed.` : ""}`,
      });

      if (failed > 0 && errors.length > 0) {
        setImportErrors(errors);
        setShowImportErrors(true);
      } else {
        setIsImportModalOpen(false);
        setImportFile(null);
        setImportErrors([]);
      }
    },
    onError: (e: any) => {
      toast({ title: "Import Failed", description: e.message || "Failed to import employees", variant: "destructive" });
    },
  });

  const handleCopyFormLink = async () => {
    try {
      await navigator.clipboard.writeText(formLink);
      toast({ title: "Copied", description: "Employee onboarding form link copied to clipboard." });
    } catch {
      toast({ title: "Copy Failed", description: "Could not copy link. Please copy manually.", variant: "destructive" });
    }
  };

  // Open QR dialog
  const openQRDialog = () => setIsQRDialogOpen(true);

  // View button opens the form link in a new tab
  const handleViewForm = () => {
    window.open(formLink, "_blank", "noopener,noreferrer");
  };

  // Print QR using standard Google-style print pattern
  const handlePrintQR = () => {
    if (!qrRef.current) return;
    const svgElement = qrRef.current.querySelector("svg");
    if (!svgElement) {
      toast({ title: "Print failed", description: "QR code not found.", variant: "destructive" });
      return;
    }

    try {
      // Clone the SVG to avoid modifying the original
      const clonedSvg = svgElement.cloneNode(true) as SVGElement;

      // Remove any existing print container (cleanup from earlier attempts)
      const existing = document.getElementById("print-qr-container-gla");
      if (existing && existing.parentNode) {
        existing.parentNode.removeChild(existing);
      }

      // Create a temporary container div for printing
      const printContainer = document.createElement("div");
      printContainer.id = "print-qr-container-gla";
      // keep hidden on screen explicitly and mark aria-hidden
      printContainer.style.display = "none";
      printContainer.setAttribute("aria-hidden", "true");

      // Create the print content with proper structure
      const printContent = document.createElement("div");
      printContent.className = "print-qr-content";

      // Add CSS for print styling (embedded directly)
      const styleSheet = document.createElement("style");
      styleSheet.type = "text/css";
      styleSheet.media = "print";
      styleSheet.textContent = `
        @media print {
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          html, body {
            width: 100%;
            height: 100%;
            background: white;
          }

          body {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
          }

          /* Hide everything by default during print */
          body > * {
            display: none !important;
          }

          /* Show only the print container */
          #print-qr-container-gla {
            display: flex !important;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: auto;
            background: white;
          }

          /* Show all children of print container */
          #print-qr-container-gla > * {
            display: block !important;
            visibility: visible !important;
          }

          .print-qr-content {
            text-align: center;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 100%;
          }

          .print-qr-logo {
            display: block;
            margin: 10px auto 8px;
            width: 260px;
            height: auto;
          }

          .print-qr-content svg {
            display: block !important;
            margin: 10px auto;
            width: 420px;
            height: 420px;
            background: white;
            border: none;
            page-break-inside: avoid;
          }

          .print-qr-title {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 18px;
            font-weight: 600;
            color: #111;
            margin: 8px 0 6px;
            text-align: center;
          }

          .print-qr-caption {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 14px;
            color: #111;
            font-weight: 600;
            margin-top: 8px;
            margin-bottom: 8px;
            text-align: center;
          }

          .print-qr-url-label {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 12px;
            color: #666;
            margin-top: 12px;
            text-align: center;
          }

          .print-qr-url {
            font-family: "Courier New", monospace;
            font-size: 11px;
            color: #000;
            margin: 6px 0 24px;
            word-break: break-all;
            max-width: 700px;
            text-align: center;
            line-height: 1.4;
          }

          /* Ensure page breaks and sizing work properly */
          @page {
            size: letter;
            margin: 0.5in;
          }
        }

        @media screen {
          #print-qr-container-gla {
            display: none !important;
          }
        }
      `;

      // Build print content structure matching requested design
      const logoImg = document.createElement("img");
      logoImg.src = "/logo.svg";
      logoImg.alt = "Golden Luxury Auto";
      logoImg.className = "print-qr-logo";

      const title = document.createElement("div");
      title.className = "print-qr-title";
      title.textContent = "Golden Luxury Auto System";

      const qrWrapper = document.createElement("div");
      qrWrapper.className = "print-qr-wrapper";
      qrWrapper.appendChild(clonedSvg);

      const caption = document.createElement("div");
      caption.className = "print-qr-caption";
      caption.textContent = "Scan to view Employee Form";

      const urlLabel = document.createElement("div");
      urlLabel.className = "print-qr-url-label";
      urlLabel.textContent = "Url link:";

      const urlText = document.createElement("div");
      urlText.className = "print-qr-url";
      urlText.textContent = formLink;

      // Append in the desired order (logo, title, QR, caption, url label, url)
      printContent.appendChild(logoImg);
      printContent.appendChild(title);
      printContent.appendChild(qrWrapper);
      printContent.appendChild(caption);
      printContent.appendChild(urlLabel);
      printContent.appendChild(urlText);

      printContainer.appendChild(styleSheet);
      printContainer.appendChild(printContent);

      // Append to body temporarily
      document.body.appendChild(printContainer);

      // Trigger print dialog
      window.print();

      // Clean up after print dialog closes or after a delay
      // Use setTimeout to allow print dialog to complete
      const cleanupTimeout = setTimeout(() => {
        if (printContainer && printContainer.parentNode) {
          document.body.removeChild(printContainer);
        }
      }, 1000);

      // Also try to clean up when print dialog closes (if browser supports beforeprint/afterprint)
      const afterPrintHandler = () => {
        clearTimeout(cleanupTimeout);
        if (printContainer && printContainer.parentNode) {
          document.body.removeChild(printContainer);
        }
        window.removeEventListener("afterprint", afterPrintHandler);
      };

      window.addEventListener("afterprint", afterPrintHandler);

      toast({
        title: "Print dialog opened",
        description: "Select your printer and click Print.",
      });
    } catch (error) {
      console.error("Error printing QR:", error);
      toast({
        title: "Print failed",
        description: "An unexpected error occurred while preparing the print.",
        variant: "destructive",
      });
    }
  };

  const downloadExport = async (format: "xlsx" | "csv", mode: "template" | "data") => {
    try {
      const url = buildApiUrl(`/api/admin/employees/export?format=${format}&mode=${mode}`);
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const err = await response.json().catch(() => ({ error: "Failed to export" }));
          throw new Error(err.error || err.message || "Failed to export");
        }
        throw new Error(`Failed to export (${response.status})`);
      }
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `employees_${mode}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(objectUrl);
      toast({ title: "Download Started", description: `Employees ${mode} ${format.toUpperCase()} downloaded.` });
    } catch (e: any) {
      toast({ title: "Export Failed", description: e.message || "Failed to export", variant: "destructive" });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-serif text-primary italic mb-1 sm:mb-2">
              Employees
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm">
              Manage employees and employee onboarding submissions
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/80 w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 sm:mr-2" />
              Add
            </Button>

            <Button
              onClick={openQRDialog}
              className="bg-primary text-primary-foreground hover:bg-primary/80 w-full sm:w-auto"
            >
              <Copy className="w-4 h-4 sm:mr-2" />
              Form Link
            </Button>

            <Button
              onClick={() => setIsImportModalOpen(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/80 w-full sm:w-auto"
            >
              <Upload className="w-4 h-4 sm:mr-2" />
              Import
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="bg-primary text-primary-foreground hover:bg-primary/80 w-full sm:w-auto"
                >
                  <Download className="w-4 h-4 sm:mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-card border-border text-foreground">
                <DropdownMenuItem onClick={() => downloadExport("xlsx", "template")}>
                  Template (Excel)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadExport("csv", "template")}>
                  Template (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadExport("xlsx", "data")}>
                  Data (Excel)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadExport("csv", "data")}>
                  Data (CSV)
                </DropdownMenuItem>
              </DropdownMenuContent>

            {/* QR Code Dialog */}
            <Dialog open={isQRDialogOpen} onOpenChange={(open) => !open && setIsQRDialogOpen(false)}>
              <DialogContent className="bg-card border-border text-foreground max-w-[95vw] sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Employee Onboarding Form</DialogTitle>
                </DialogHeader>

                <div className="p-4 text-center">
                  <div ref={qrRef} className="bg-white p-4 rounded-lg inline-block mb-4">
                    <QRCodeSVG value={formLink} size={220} level="H" includeMargin={false} />
                  </div>

                  <div className="mb-4">
                    <p className="text-sm text-muted-foreground break-words">{formLink}</p>
                  </div>

                  <div className="flex gap-3 justify-center">
                    <Button onClick={handlePrintQR} className="bg-primary text-primary-foreground hover:bg-primary/80">
                      Print
                    </Button>
                    <Button onClick={handleViewForm} className="bg-primary text-primary-foreground hover:bg-primary/80">
                      View
                    </Button>
                    <Button onClick={handleCopyFormLink} variant="ghost" className="text-muted-foreground hover:text-foreground">
                      Copy Link
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            </DropdownMenu>
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
                  placeholder="Search by name, email, employee #..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="pl-10 bg-card border-border text-foreground placeholder:text-gray-600"
                />
              </div>

              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full md:w-[220px] bg-card border-border text-foreground">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border text-foreground">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="offboarded">Offboarded</SelectItem>
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

        {/* Employees Table */}
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            <div className="overflow-x-auto -mx-3 sm:mx-0">
              <Table className="min-w-[1000px]">
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-center text-foreground font-medium px-2 sm:px-4 md:px-6 py-3 sm:py-4 w-16 text-[10px] sm:text-xs">
                      No
                    </TableHead>
                    <TableHead className="text-left text-foreground font-medium px-2 sm:px-4 md:px-6 py-3 sm:py-4 min-w-[140px] text-[10px] sm:text-xs">
                      Status
                    </TableHead>
                    <TableHead className="text-left text-foreground font-medium px-2 sm:px-4 md:px-6 py-3 sm:py-4 min-w-[140px] text-[10px] sm:text-xs">
                      Employee #
                    </TableHead>
                    <TableHead className="text-left text-foreground font-medium px-2 sm:px-4 md:px-6 py-3 sm:py-4 min-w-[220px] text-[10px] sm:text-xs">
                      Employee Name
                    </TableHead>
                    <TableHead className="text-left text-foreground font-medium px-2 sm:px-4 md:px-6 py-3 sm:py-4 min-w-[240px] text-[10px] sm:text-xs hidden lg:table-cell">
                      Work Email
                    </TableHead>
                    <TableHead className="text-left text-foreground font-medium px-2 sm:px-4 md:px-6 py-3 sm:py-4 min-w-[140px] text-[10px] sm:text-xs hidden lg:table-cell">
                      Mobile
                    </TableHead>
                    <TableHead className="text-left text-foreground font-medium px-2 sm:px-4 md:px-6 py-3 sm:py-4 min-w-[180px] text-[10px] sm:text-xs hidden xl:table-cell">
                      Department
                    </TableHead>
                    <TableHead className="text-left text-foreground font-medium px-2 sm:px-4 md:px-6 py-3 sm:py-4 min-w-[180px] text-[10px] sm:text-xs hidden xl:table-cell">
                      Job Title
                    </TableHead>
                    <TableHead className="text-left text-foreground font-medium px-2 sm:px-4 md:px-6 py-3 sm:py-4 min-w-[140px] text-[10px] sm:text-xs hidden md:table-cell">
                      Created
                    </TableHead>
                    <TableHead className="text-center text-foreground font-medium px-2 sm:px-4 md:px-6 py-3 sm:py-4 w-28 text-[10px] sm:text-xs">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRowSkeleton colSpan={9} rows={5} />
                  ) : error ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        <div className="flex flex-col items-center gap-3">
                          <p className="text-red-700 text-sm break-words max-w-2xl">
                            {error instanceof Error ? error.message : "Failed to fetch employees"}
                          </p>
                          <Button
                            size="sm"
                            onClick={() => refetch()}
                            className="bg-primary text-primary-foreground hover:bg-primary/80"
                          >
                            Retry
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : employees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        No employees found. Try adjusting your search or filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    employees.map((emp, index) => {
                      const rowNumber =
                        (pagination ? (pagination.page - 1) * pagination.limit : 0) + index + 1;
                      const badge = statusBadge(emp);
                      return (
                        <TableRow key={emp.employee_aid} className="border-border group">
                          <TableCell className="text-center text-muted-foreground font-medium px-2 sm:px-4 md:px-6 py-3 sm:py-4 align-middle text-xs sm:text-sm">
                            {rowNumber}
                          </TableCell>
                          <TableCell className="text-left px-2 sm:px-4 md:px-6 py-3 sm:py-4 align-middle">
                            <Badge
                              variant="outline"
                              className={cn("text-xs", badge.className)}
                            >
                              {badge.text}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-left text-muted-foreground px-2 sm:px-4 md:px-6 py-3 sm:py-4 align-middle text-xs sm:text-sm">
                            {emp.employee_number || <span className="text-gray-600">N/A</span>}
                          </TableCell>
                          <TableCell className="text-left text-foreground font-medium px-2 sm:px-4 md:px-6 py-3 sm:py-4 align-middle text-xs sm:text-sm">
                            {emp.employee_last_name}, {emp.employee_first_name}
                          </TableCell>
                          <TableCell className="text-left text-muted-foreground px-2 sm:px-4 md:px-6 py-3 sm:py-4 align-middle text-xs sm:text-sm hidden lg:table-cell">
                            {emp.employee_job_pay_work_email || emp.employee_email || (
                              <span className="text-gray-600">N/A</span>
                            )}
                          </TableCell>
                          <TableCell className="text-left text-muted-foreground px-2 sm:px-4 md:px-6 py-3 sm:py-4 align-middle text-xs sm:text-sm hidden lg:table-cell">
                            {emp.employee_mobile_number || emp.employee_telephone || (
                              <span className="text-gray-600">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-left text-muted-foreground px-2 sm:px-4 md:px-6 py-3 sm:py-4 align-middle text-xs sm:text-sm hidden xl:table-cell">
                            {emp.employee_job_pay_department_name || <span className="text-gray-600">—</span>}
                          </TableCell>
                          <TableCell className="text-left text-muted-foreground px-2 sm:px-4 md:px-6 py-3 sm:py-4 align-middle text-xs sm:text-sm hidden xl:table-cell">
                            {emp.employee_job_pay_job_title_name || <span className="text-gray-600">—</span>}
                          </TableCell>
                          <TableCell className="text-left text-muted-foreground px-2 sm:px-4 md:px-6 py-3 sm:py-4 align-middle text-xs sm:text-sm hidden md:table-cell">
                            {formatDate(emp.employee_created)}
                          </TableCell>
                          <TableCell className="text-center px-2 sm:px-4 md:px-6 py-3 sm:py-4 align-middle">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 w-9 p-0 text-foreground hover:text-primary hover:bg-primary/10 rounded-full"
                                title="View"
                                onClick={() => setLocation(`/admin/hr/employees/view?employeeId=${emp.employee_aid}`)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>

                              {emp.employee_status === "pending" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-9 w-9 p-0 text-green-700 hover:text-green-700 hover:bg-green-500/10 rounded-full"
                                  onClick={() => setEmployeeToApprove(emp)}
                                  title="Approve"
                                >
                                  <UserCheck className="w-4 h-4" />
                                </Button>
                              )}

                              {(emp.employee_status === "offboarded" ||
                                emp.employee_status === "separated" ||
                                (emp.employee_status !== "pending" && emp.employee_is_active === 0)) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-9 w-9 p-0 text-green-700 hover:text-green-700 hover:bg-green-500/10 rounded-full"
                                  onClick={() => setEmployeeToRestore(emp)}
                                  title="Restore"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </Button>
                              )}

                              {/* gla-v3 parity: hard delete only on non-active rows (pending or offboarded/inactive). */}
                              {(emp.employee_status === "pending" ||
                                emp.employee_status === "offboarded" ||
                                emp.employee_status === "separated" ||
                                emp.employee_is_active === 0) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-9 w-9 p-0 text-red-700 hover:text-red-700 hover:bg-red-500/10 rounded-full"
                                  onClick={() => setEmployeeToDelete(emp)}
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
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

            {pagination && pagination.total > 0 && (
              <TablePagination
                totalItems={pagination.total}
                itemsPerPage={itemsPerPage}
                currentPage={Math.min(page, pagination.totalPages)}
                onPageChange={(newPage) => {
                  const validPage = Math.max(1, Math.min(newPage, pagination.totalPages));
                  setPage(validPage);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                onItemsPerPageChange={(newLimit) => {
                  setItemsPerPage(newLimit);
                  setPage(1);
                }}
                isLoading={isLoading}
              />
            )}
          </CardContent>
        </Card>

        {/* Add Employee Modal */}
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogContent className="bg-card border-border text-foreground max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl font-semibold text-primary">Add New Employee</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Create an employee record (this does not submit the public onboarding form)
              </DialogDescription>
            </DialogHeader>

            <Form {...addForm}>
              <form
                onSubmit={addForm.handleSubmit((values) => createMutation.mutate(values))}
                className="space-y-6 mt-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={addForm.control}
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
                    control={addForm.control}
                    name="middleName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Middle Name</FormLabel>
                        <FormControl>
                          <Input {...field} className="bg-card border-border text-foreground focus:border-primary" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={addForm.control}
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
                    control={addForm.control}
                    name="workEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Work Email *</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" className="bg-card border-border text-foreground focus:border-primary" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={addForm.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Phone Number *</FormLabel>
                        <FormControl>
                          <Input {...field} className="bg-card border-border text-foreground focus:border-primary" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={addForm.control}
                    name="telephone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Telephone Number</FormLabel>
                        <FormControl>
                          <Input {...field} className="bg-card border-border text-foreground focus:border-primary" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={addForm.control}
                    name="birthday"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Birth Date</FormLabel>
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
                    control={addForm.control}
                    name="maritalStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Marital Status</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="bg-card border-border text-foreground">
                              <SelectValue placeholder="Select marital status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-card border-border text-foreground">
                            {MARITAL_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Address */}
                  <FormField
                    control={addForm.control}
                    name="street"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel className="text-muted-foreground">Street</FormLabel>
                        <FormControl>
                          <Input {...field} className="bg-card border-border text-foreground focus:border-primary" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={addForm.control}
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
                    control={addForm.control}
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
                    control={addForm.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Country</FormLabel>
                        <FormControl>
                          <Input {...field} className="bg-card border-border text-foreground focus:border-primary" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={addForm.control}
                    name="zipCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">ZIP</FormLabel>
                        <FormControl>
                          <Input {...field} className="bg-card border-border text-foreground focus:border-primary" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Family */}
                  <FormField
                    control={addForm.control}
                    name="motherName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Mother's First Name</FormLabel>
                        <FormControl>
                          <Input {...field} className="bg-card border-border text-foreground focus:border-primary" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={addForm.control}
                    name="fatherName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Father's First Name</FormLabel>
                        <FormControl>
                          <Input {...field} className="bg-card border-border text-foreground focus:border-primary" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={addForm.control}
                    name="homeContact"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Home Contact</FormLabel>
                        <FormControl>
                          <Input {...field} className="bg-card border-border text-foreground focus:border-primary" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={addForm.control}
                    name="homeAddress"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel className="text-muted-foreground">Family Home Address</FormLabel>
                        <FormControl>
                          <Input {...field} className="bg-card border-border text-foreground focus:border-primary" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Emergency */}
                  <FormField
                    control={addForm.control}
                    name="emergencyContactName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Emergency Contact Name *</FormLabel>
                        <FormControl>
                          <Input {...field} className="bg-card border-border text-foreground focus:border-primary" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={addForm.control}
                    name="emergencyContactPhoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Emergency Contact Phone Number *</FormLabel>
                        <FormControl>
                          <Input {...field} className="bg-card border-border text-foreground focus:border-primary" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={addForm.control}
                    name="emergencyRelationship"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Emergency Contact Relationship</FormLabel>
                        <FormControl>
                          <Input {...field} className="bg-card border-border text-foreground focus:border-primary" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={addForm.control}
                    name="emergencyAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Emergency Contact Address</FormLabel>
                        <FormControl>
                          <Input {...field} className="bg-card border-border text-foreground focus:border-primary" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Other */}
                  <FormField
                    control={addForm.control}
                    name="ssnEin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Social Security Number or EIN *</FormLabel>
                        <FormControl>
                          <Input {...field} className="bg-card border-border text-foreground focus:border-primary" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={addForm.control}
                    name="shirtSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Shirt Size</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-card border-border text-foreground">
                              <SelectValue placeholder="Select shirt size" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-card border-border text-foreground">
                            <SelectItem value="Small">Small</SelectItem>
                            <SelectItem value="Medium">Medium</SelectItem>
                            <SelectItem value="Large">Large</SelectItem>
                            <SelectItem value="XLarge">XLarge</SelectItem>
                            <SelectItem value="XXLarge">XXLarge</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={addForm.control}
                    name="hearAboutGla"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">How did you hear about Golden Luxury Auto?</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-card border-border text-foreground">
                              <SelectValue placeholder="Select an option" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-card border-border text-foreground">
                            <SelectItem value="Friend/Refferal">Friend/Refferal</SelectItem>
                            <SelectItem value="KSL Ad">KSL Ad</SelectItem>
                            <SelectItem value="Facebook Ad">Facebook Ad</SelectItem>
                            <SelectItem value="Indeed Ad">Indeed Ad</SelectItem>
                            <SelectItem value="Google Ad">Google Ad</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* File Uploads */}
                  <FormItem className="md:col-span-2">
                    <FormLabel className="text-muted-foreground">Photo of car insurance</FormLabel>
                    <div className="space-y-2">
                      <label
                        htmlFor="car-insurance-upload"
                        className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-primary/40 rounded-xl bg-background/50 hover:border-primary/60 hover:bg-primary/5 transition-all cursor-pointer group"
                      >
                        <div className="flex flex-col items-center justify-center pt-4 pb-4">
                          <Upload className="w-8 h-8 text-primary mb-2 group-hover:scale-110 transition-transform" />
                          <p className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
                            Click to upload or drag and drop
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">Multiple files allowed</p>
                        </div>
                        <input
                          id="car-insurance-upload"
                          type="file"
                          multiple
                          accept="image/*,.pdf"
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            setCarInsurancePhotos((prev) => [...prev, ...files]);
                            e.target.value = ""; // Reset input
                          }}
                          className="hidden"
                        />
                      </label>
                      {carInsurancePhotos.length > 0 && (
                        <div className="space-y-2">
                          {carInsurancePhotos.map((file, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-background rounded-lg border border-border">
                              <div className="flex items-center gap-2">
                                <FileSpreadsheet className="w-4 h-4 text-primary" />
                                <span className="text-sm text-muted-foreground">{file.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  ({(file.size / 1024).toFixed(2)} KB)
                                </span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setCarInsurancePhotos((prev) => prev.filter((_, i) => i !== index));
                                }}
                                className="text-muted-foreground hover:text-foreground h-6 w-6 p-0"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </FormItem>

                  <FormItem className="md:col-span-2">
                    <FormLabel className="text-muted-foreground">Driver license photo</FormLabel>
                    <div className="space-y-2">
                      <label
                        htmlFor="driver-license-upload"
                        className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-primary/40 rounded-xl bg-background/50 hover:border-primary/60 hover:bg-primary/5 transition-all cursor-pointer group"
                      >
                        <div className="flex flex-col items-center justify-center pt-4 pb-4">
                          <Upload className="w-8 h-8 text-primary mb-2 group-hover:scale-110 transition-transform" />
                          <p className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
                            Click to upload or drag and drop
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">Single file</p>
                        </div>
                        <input
                          id="driver-license-upload"
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) setDriverLicensePhoto(file);
                          }}
                          className="hidden"
                        />
                      </label>
                      {driverLicensePhoto && (
                        <div className="flex items-center justify-between p-2 bg-background rounded-lg border border-border">
                          <div className="flex items-center gap-2">
                            <FileSpreadsheet className="w-4 h-4 text-primary" />
                            <span className="text-sm text-muted-foreground">{driverLicensePhoto.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({(driverLicensePhoto.size / 1024).toFixed(2)} KB)
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setDriverLicensePhoto(null)}
                            className="text-muted-foreground hover:text-foreground h-6 w-6 p-0"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </FormItem>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setIsAddModalOpen(false);
                      addForm.reset();
                      setCarInsurancePhotos([]);
                      setDriverLicensePhoto(null);
                    }}
                    className="text-muted-foreground hover:text-foreground"
                    disabled={createMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-primary text-primary-foreground hover:bg-primary/80 font-medium"
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Import Modal */}
        <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
          <DialogContent className="bg-card border-border text-foreground max-w-[95vw] sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl font-semibold text-primary flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                Import Employees
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Upload an Excel (.xlsx, .xls) or CSV file. Use Export → Template to download the correct format.
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
                    <p className="text-xs text-muted-foreground">Excel (.xlsx, .xls) or CSV file (Max 100MB)</p>
                  </div>
                  <input
                    id="import-file"
                    type="file"
                    accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setImportFile(file);
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

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportFile(null);
                    setImportErrors([]);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                  disabled={importMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    if (!importFile) {
                      toast({
                        title: "No File Selected",
                        description: "Please select an Excel or CSV file to import",
                        variant: "destructive",
                      });
                      return;
                    }
                    importMutation.mutate(importFile);
                  }}
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

        {/* Import Errors */}
        <Dialog open={showImportErrors} onOpenChange={setShowImportErrors}>
          <DialogContent className="bg-card border-border text-foreground max-w-[95vw] sm:max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl font-semibold text-yellow-700">
                Import Warning ({importErrors.length})
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                The following rows failed to import. Please review and fix the issues.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-2 max-h-[60vh] overflow-y-auto">
              {importErrors.map((err, idx) => (
                <div key={idx} className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-700 font-semibold text-sm">
                      {err.row}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground break-words">
                        <span className="font-medium text-foreground">Row {err.row}:</span> {err.error}
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

        {/* Approve confirmation */}
        <Dialog open={employeeToApprove !== null} onOpenChange={(open) => !open && setEmployeeToApprove(null)}>
          <DialogContent className="bg-card border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl font-semibold text-green-700">Approve Employee</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {employeeToApprove ? (
                  <>
                    Approve <strong className="text-foreground">{employeeToApprove.employee_last_name}, {employeeToApprove.employee_first_name}</strong>?
                    <br />
                    This will change the employee status from Pending to Approved.
                  </>
                ) : null}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-3 mt-4">
              <Button
                variant="outline"
                onClick={() => setEmployeeToApprove(null)}
                className="border-border text-muted-foreground hover:bg-muted/50"
                disabled={approveMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => employeeToApprove && approveMutation.mutate(employeeToApprove.employee_aid)}
                className="bg-green-600 text-foreground hover:bg-green-700"
                disabled={approveMutation.isPending}
              >
                {approveMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Approving...
                  </>
                ) : (
                  "Approve"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Restore confirmation */}
        <Dialog open={employeeToRestore !== null} onOpenChange={(open) => !open && setEmployeeToRestore(null)}>
          <DialogContent className="bg-card border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl font-semibold text-green-700">Restore Employee</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {employeeToRestore ? (
                  <>
                    Restore <strong className="text-foreground">{employeeToRestore.employee_last_name}, {employeeToRestore.employee_first_name}</strong>?
                    <br />
                    This reactivates the employee and restores their system access.
                  </>
                ) : null}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-3 mt-4">
              <Button
                variant="outline"
                onClick={() => setEmployeeToRestore(null)}
                className="border-border text-muted-foreground hover:bg-muted/50"
                disabled={restoreMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => employeeToRestore && restoreMutation.mutate(employeeToRestore.employee_aid)}
                className="bg-green-600 text-foreground hover:bg-green-700"
                disabled={restoreMutation.isPending}
              >
                {restoreMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Restoring...
                  </>
                ) : (
                  "Restore"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <Dialog open={employeeToDelete !== null} onOpenChange={(open) => !open && setEmployeeToDelete(null)}>
          <DialogContent className="bg-card border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="text-lg sm:text-xl font-semibold text-red-700">Delete Employee</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {employeeToDelete ? (
                  <>
                    Are you sure you want to delete <strong className="text-foreground">{employeeToDelete.employee_last_name}, {employeeToDelete.employee_first_name}</strong>?
                    <br />
                    This action cannot be undone.
                  </>
                ) : null}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-3 mt-4">
              <Button
                variant="outline"
                onClick={() => setEmployeeToDelete(null)}
                className="border-border text-muted-foreground hover:bg-muted/50"
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => employeeToDelete && deleteMutation.mutate(employeeToDelete.employee_aid)}
                className="bg-red-500/20 text-red-700 border-red-500/50 text-foreground hover:bg-red-500/30 text-red-700"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

