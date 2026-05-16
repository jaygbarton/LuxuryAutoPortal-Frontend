import { useState, useEffect, useRef } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { ClientPageLinks } from "@/components/client/ClientPageLinks";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ContractManagement from "./ContractManagement";
import CarOnboarding from "./CarOnboarding";
import CarOffboarding from "./CarOffboarding";
import CarIssueFormSubmission from "./forms/CarIssueFormSubmission";
import CarOnboardingForm from "@/components/forms/CarOnboardingForm";
import CarOffboardingForm from "@/components/forms/CarOffboardingForm";
import ExpenseFormSubmission from "./forms/ExpenseFormSubmission";
import ExpenseFormMySubmissions from "./forms/ExpenseFormMySubmissions";
import ExpenseFormApprovalDashboard from "./forms/ExpenseFormApprovalDashboard";
import CommissionFormSubmission from "./forms/CommissionFormSubmission";
import CommissionFormMySubmissions from "./forms/CommissionFormMySubmissions";
import CommissionFormApprovalDashboard from "./forms/CommissionFormApprovalDashboard";
import ReferralFormSubmission from "./forms/ReferralFormSubmission";
import ReferralFormMySubmissions from "./forms/ReferralFormMySubmissions";
import ReferralFormApprovalDashboard from "./forms/ReferralFormApprovalDashboard";
import DocumentUpdateSubmission from "./forms/DocumentUpdateSubmission";
import DocumentUpdateMySubmissions from "./forms/DocumentUpdateMySubmissions";
import DocumentUpdateApprovalDashboard from "./forms/DocumentUpdateApprovalDashboard";
import {
  EmployeeOnboardingFormContent,
  EmployeeContract1099Content,
  EmployeeOffboardingContent,
} from "./forms/EmployeeOnboardingProcess";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  FileText,
  ClipboardList,
  Car,
  LogOut,
  UserPlus,
  Search,
  Loader2,
  Eye,
  Send,
  FileCheck,
  ExternalLink,
  Download,
  Share2,
  CheckCircle,
  XCircle,
  X,
  Upload,
  DollarSign,
  Users,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/lib/queryClient";
import {
  TablePagination,
  ItemsPerPage,
} from "@/components/ui/table-pagination";

interface FormItem {
  id: string;
  title: string;
  icon: any;
  comingSoon?: boolean;
  externalUrl?: string | null;
}

interface FormSection {
  id: string;
  title: string;
  icon: any;
  items: FormItem[];
}

interface OnboardingSubmission {
  id: number;
  firstNameOwner: string;
  lastNameOwner: string;
  emailOwner: string;
  phoneOwner: string;
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
  vinNumber?: string;
  licensePlate?: string;
  createdAt: string;
  status: string;
  contractStatus?: "pending" | "sent" | "opened" | "signed" | "declined" | null;
  contractSignedAt?: string | null;
  signedContractUrl?: string | null;
  isOffboarded?: boolean;
  carOffboardAt?: string | null;
  carOffboardReason?: string | null;
  [key: string]: any; // For full submission details
}

// QR Code Section Component
function QRCodeSection() {
  const qrRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Get the current URL and remove /admin/forms if present, replace with /onboarding
  const onboardingUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/onboarding`
      : "/onboarding";

  /**
   * Copy text to clipboard with a safe fallback for environments where
   * `navigator.clipboard` is unavailable (older browsers / non-secure contexts).
   */
  const copyToClipboard = async (text: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    // Fallback: temporary textarea + execCommand
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  };

  /**
   * Client requirement: button should copy the onboarding link (not share UI).
   */
  const handleShare = async () => {
    try {
      await copyToClipboard(onboardingUrl);
      toast({
        title: "Link copied",
        description: "Onboarding form URL copied to clipboard.",
      });
    } catch (error) {
      console.error("Failed to copy onboarding link:", error);
      toast({
        title: "Copy failed",
        description: "Could not copy the link. Please copy it manually.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadQR = () => {
    if (!qrRef.current) return;

    const svgElement = qrRef.current.querySelector("svg");
    if (!svgElement) return;

    try {
      // Convert SVG to canvas then to PNG
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const img = new Image();
      const svgBlob = new Blob([svgData], {
        type: "image/svg+xml;charset=utf-8",
      });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        // Higher resolution for better quality
        const scale = 2;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        // Fill with white background
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw the QR code
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Convert to blob and download
        canvas.toBlob((blob) => {
          if (blob) {
            const downloadUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = downloadUrl;
            link.download = "Golden-Luxury-Auto-Onboarding-QR.png";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(downloadUrl);

            toast({
              title: "QR Code downloaded",
              description: "The QR code has been saved to your downloads.",
            });
          }
          URL.revokeObjectURL(url);
        }, "image/png");
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        toast({
          title: "Download failed",
          description: "Failed to generate QR code image.",
          variant: "destructive",
        });
      };

      img.src = url;
    } catch (error) {
      console.error("Error downloading QR code:", error);
      toast({
        title: "Download failed",
        description: "An error occurred while downloading the QR code.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="bg-background border-primary/30 border-2">
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Left side: Title, subtitle, and QR code */}
          <div className="flex-1 flex flex-col items-center lg:items-start">
            <div className="mb-4 text-center lg:text-left">
              <h2 className="text-xl font-semibold text-primary mb-2">
                Client Onboarding Form LYC
              </h2>
              <p className="text-sm text-muted-foreground">
                Fill out for new clients or share the QR code for them to
                complete
              </p>
            </div>

            {/* QR Code */}
            <div ref={qrRef} className="bg-white p-4 rounded-lg shadow-lg mb-4">
              <QRCodeSVG
                value={onboardingUrl}
                size={200}
                level="H"
                includeMargin={false}
              />
            </div>

            {/* Download Button */}
            <Button
              onClick={handleDownloadQR}
              className="w-full lg:w-auto bg-primary text-primary-foreground hover:bg-primary/80"
            >
              <Download className="w-4 h-4 mr-2" />
              Download QR Code
            </Button>
          </div>

          {/* Right side: Share section */}
          <div className="flex-1 flex flex-col justify-center items-center lg:items-start">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-foreground mb-2">
                Share with New Clients
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Send the onboarding form link directly to your clients via
                email, SMS, or messaging apps.
              </p>

              {/* Client requirement: show the actual link next to the copy button */}
              <div className="flex flex-col sm:flex-row gap-3 w-full items-stretch">
                <Button
                  onClick={handleShare}
                  className="bg-primary text-primary-foreground hover:bg-primary/80 font-medium w-full sm:w-auto whitespace-nowrap"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Click to Copy the Link
                </Button>

                <Input
                  value={onboardingUrl}
                  readOnly
                  className="bg-card border-border text-primary w-full"
                  onFocus={(e) => e.currentTarget.select()}
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FormsPage() {
  const [expandedSections, setExpandedSections] = useState<string[]>([
    "client-onboarding",
    "employee-onboarding-process",
    "employee-forms",
    "commissions-forms",
  ]);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubmission, setSelectedSubmission] =
    useState<OnboardingSubmission | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [showSensitiveData, setShowSensitiveData] = useState(false);
  const [showAccessConfirmation, setShowAccessConfirmation] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [submissionToDecline, setSubmissionToDecline] =
    useState<OnboardingSubmission | null>(null);
  const [fullScreenDocument, setFullScreenDocument] = useState<{
    url: string;
    type: "insurance" | "license";
    index?: number;
    isPdf?: boolean;
  } | null>(null);
  const [insuranceCardFile, setInsuranceCardFile] = useState<File | null>(null);
  const [insuranceCardPreview, setInsuranceCardPreview] = useState<
    string | null
  >(null);
  const [driversLicenseFiles, setDriversLicenseFiles] = useState<File[]>([]);
  const [driversLicensePreviews, setDriversLicensePreviews] = useState<
    string[]
  >([]);
  const [page, setPage] = useState(1);

  // Load items per page from localStorage, default to 10
  const [itemsPerPage, setItemsPerPage] = useState<ItemsPerPage>(() => {
    const saved = localStorage.getItem("submissions_limit");
    return (saved ? parseInt(saved) : 10) as ItemsPerPage;
  });

  // Save to localStorage when itemsPerPage changes
  useEffect(() => {
    localStorage.setItem("submissions_limit", itemsPerPage.toString());
  }, [itemsPerPage]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch form visibility for current user's role
  const { data: formVisibilityData } = useQuery<{
    roleId: number;
    roleName: string;
    isAdmin: boolean;
    isEmployee: boolean;
    isClient: boolean;
    formVisibility: Record<
      string,
      { isVisible: boolean; externalUrl?: string | null }
    >;
  }>({
    queryKey: ["/api/admin/form-visibility"],
    queryFn: async () => {
      const response = await fetch(buildApiUrl("/api/admin/form-visibility"), {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch form visibility");
      return response.json();
    },
    retry: false,
  });

  // Auto-expand Approval Dashboard for admins so data is visible immediately
  useEffect(() => {
    if (formVisibilityData?.isAdmin) {
      setExpandedItems((prev) =>
        prev.includes("approval-dashboard")
          ? prev
          : [...prev, "approval-dashboard"],
      );
    }
  }, [formVisibilityData?.isAdmin]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId],
    );
  };

  const toggleItem = (itemId: string) => {
    if (
      itemId === "lyc" ||
      itemId === "contract" ||
      itemId === "car-on" ||
      itemId === "car-off" ||
      itemId === "expense-receipt" ||
      itemId === "approval-dashboard" ||
      itemId === "employee-onboarding-form" ||
      itemId === "employee-contract-1099" ||
      itemId === "employee-offboarding" ||
      itemId === "commission-form-submit" ||
      itemId === "commission-form-my-submissions" ||
      itemId === "commission-form-approval" ||
      itemId === "referral-form-submit" ||
      itemId === "referral-form-my-submissions" ||
      itemId === "referral-form-approval" ||
      itemId === "document-update-submit" ||
      itemId === "document-update-my-submissions" ||
      itemId === "document-update-approval" ||
      itemId === "car-issue-submit"
    ) {
      setExpandedItems((prev) =>
        prev.includes(itemId)
          ? prev.filter((id) => id !== itemId)
          : [...prev, itemId],
      );
    }
  };

  // Fetch submissions for LYC form
  const {
    data: submissionsData,
    isLoading: isLoadingSubmissions,
    error: submissionsError,
  } = useQuery<{
    success: boolean;
    data: OnboardingSubmission[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>({
    queryKey: ["onboarding-submissions", searchQuery, page, itemsPerPage],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: itemsPerPage.toString(),
      });
      if (searchQuery) {
        params.append("search", searchQuery);
      }
      const url = buildApiUrl(
        `/api/onboarding/submissions?${params.toString()}`,
      );
      console.log("🔍 [FORMS PAGE] Fetching submissions from:", url);

      const response = await fetch(url, {
        credentials: "include", // Include cookies for session authentication
      });

      console.log(
        "📥 [FORMS PAGE] Response status:",
        response.status,
        response.statusText,
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Failed to fetch submissions" }));
        console.error("❌ [FORMS PAGE] API error:", errorData);
        throw new Error(
          errorData.error ||
            `Failed to fetch submissions: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();
      // console.log("✅ [FORMS PAGE] Submissions received:", {
      //   success: data.success,
      //   count: data.data?.length || 0,
      //   total: data.pagination?.total || 0,
      // });
      return data;
    },
    enabled: expandedItems.includes("lyc"), // Only fetch when LYC item is expanded
    retry: 1,
    refetchInterval: 8000, // Poll every 8 seconds for real-time updates
    refetchOnWindowFocus: true,
  });

  // Track signed contract IDs for toast notifications using ref to avoid re-renders
  const previousSignedIdsRef = useRef<Set<number>>(new Set());

  // Check for new signed contracts and show toast (useEffect to prevent infinite re-renders)
  useEffect(() => {
    if (!submissionsData?.data) return;

    const currentSignedIds = new Set(
      submissionsData.data
        .filter((s: OnboardingSubmission) => s.contractStatus === "signed")
        .map((s: OnboardingSubmission) => s.id),
    );

    const previousSignedIds = previousSignedIdsRef.current;

    // Find newly signed contracts
    if (previousSignedIds.size > 0) {
      const newSignedIds = Array.from(currentSignedIds).filter(
        (id) => !previousSignedIds.has(id),
      );

      newSignedIds.forEach((id) => {
        const submission = submissionsData.data.find(
          (s: OnboardingSubmission) => s.id === id,
        );
        if (submission) {
          toast({
            title: "🎉 New Contract Signed!",
            description: `${submission.firstNameOwner} ${submission.lastNameOwner} has signed their contract.`,
            duration: 5000,
          });
        }
      });
    }

    // Update ref with current IDs
    previousSignedIdsRef.current = currentSignedIds;
  }, [submissionsData?.data]);

  // Approve/Reject submission mutation
  const approvalMutation = useMutation({
    mutationFn: async ({
      id,
      action,
      reason,
    }: {
      id: number;
      action: "approve" | "reject";
      reason?: string;
    }) => {
      const response = await fetch(
        buildApiUrl(`/api/onboarding/submissions/${id}/${action}`),
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason }),
        },
      );
      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: `Failed to ${action} submission` }));
        throw new Error(error.error || `Failed to ${action} submission`);
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      if (variables.action === "approve") {
        toast({
          title: "✅ Submission Approved",
          description: "Email and Slack notifications sent. Status updated.",
        });
      } else {
        toast({
          title: "Submission Declined",
          description: "Email and Slack notifications sent. Status updated.",
        });
      }
      // Close decline modal if open
      setShowDeclineModal(false);
      setDeclineReason("");
      setSubmissionToDecline(null);
      // Update the submission in the table cache so the row remains with new status (data stays in table)
      const newStatus =
        variables.action === "approve" ? "approved" : "rejected";
      queryClient.setQueriesData(
        { queryKey: ["onboarding-submissions"] },
        (
          old:
            | {
                data?: OnboardingSubmission[];
                pagination?: { total: number };
                success?: boolean;
              }
            | undefined,
        ) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: old.data.map((s) =>
              s.id === variables.id ? { ...s, status: newStatus } : s,
            ),
          };
        },
      );
      // Invalidate cars list so cars page updates (car status changes when approved)
      queryClient.invalidateQueries({ queryKey: ["/api/cars"] });
      // Invalidate sidebar badges (car counts may change)
      queryClient.invalidateQueries({ queryKey: ["sidebar-badges"] });
    },
    onError: (error: Error, variables) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Fetch full submission details for viewing
  const { data: submissionDetails } = useQuery<{
    success: boolean;
    data: OnboardingSubmission;
  }>({
    queryKey: ["onboarding-submission", selectedSubmission?.id],
    queryFn: async () => {
      const response = await fetch(
        buildApiUrl(`/api/onboarding/submissions/${selectedSubmission?.id}`),
        {
          credentials: "include",
        },
      );
      if (!response.ok) throw new Error("Failed to fetch submission details");
      return response.json();
    },
    enabled: !!selectedSubmission?.id && isDetailsOpen,
  });

  const handleViewDetails = async (submission: OnboardingSubmission) => {
    setSelectedSubmission(submission);
    setShowSensitiveData(false); // Reset sensitive data visibility
    setIsDetailsOpen(true);
    // Reset file uploads when opening details
    setInsuranceCardFile(null);
    setInsuranceCardPreview(null);
    setDriversLicenseFiles([]);
    setDriversLicensePreviews([]);
  };

  // Handle insurance card file selection
  const handleInsuranceCardChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      setInsuranceCardFile(file);
      // Generate preview
      if (file.type === "application/pdf") {
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
  const handleDriversLicenseChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      setDriversLicenseFiles(fileArray);
      // Generate previews
      const previews: string[] = [];
      let loadedCount = 0;
      fileArray.forEach((file) => {
        if (file.type === "application/pdf") {
          previews.push("");
          loadedCount++;
          if (loadedCount === fileArray.length) {
            setDriversLicensePreviews(previews);
          }
        } else {
          const reader = new FileReader();
          reader.onloadend = () => {
            previews.push(reader.result as string);
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
    const input = document.getElementById(
      "insurance-card-input-forms",
    ) as HTMLInputElement;
    if (input) input.value = "";
  };

  // Remove drivers license file
  const handleRemoveDriversLicense = (index: number) => {
    const newFiles = driversLicenseFiles.filter((_, i) => i !== index);
    const newPreviews = driversLicensePreviews.filter((_, i) => i !== index);
    setDriversLicenseFiles(newFiles);
    setDriversLicensePreviews(newPreviews);
    if (newFiles.length === 0) {
      const input = document.getElementById(
        "drivers-license-input-forms",
      ) as HTMLInputElement;
      if (input) input.value = "";
    }
  };

  // Mutation to update documents
  const updateDocumentsMutation = useMutation({
    mutationFn: async (submissionId: number) => {
      const formData = new FormData();

      if (insuranceCardFile) {
        formData.append("insuranceCard", insuranceCardFile);
      }

      if (driversLicenseFiles.length > 0) {
        driversLicenseFiles.forEach((file) => {
          formData.append("driversLicense", file);
        });
      }

      const response = await fetch(
        buildApiUrl(`/api/onboarding/submissions/${submissionId}/documents`),
        {
          method: "PUT",
          body: formData,
          credentials: "include",
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update documents");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Documents updated successfully",
      });
      // Reset file uploads
      setInsuranceCardFile(null);
      setInsuranceCardPreview(null);
      setDriversLicenseFiles([]);
      setDriversLicensePreviews([]);
      // Refetch submission details
      queryClient.invalidateQueries({
        queryKey: ["onboarding-submission", selectedSubmission?.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/onboarding/submissions"],
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update documents",
        variant: "destructive",
      });
    },
  });

  // Mutation to log sensitive data access
  const logAccessMutation = useMutation({
    mutationFn: async (submissionId: number) => {
      const response = await fetch(
        buildApiUrl(`/api/onboarding/submissions/${submissionId}/log-access`),
        {
          method: "POST",
          credentials: "include",
        },
      );
      if (!response.ok) throw new Error("Failed to log access");
      return response.json();
    },
    onSuccess: () => {
      setShowSensitiveData(true);
      setShowAccessConfirmation(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to log access",
        variant: "destructive",
      });
    },
  });

  const handleRequestSensitiveData = () => {
    setShowAccessConfirmation(true);
  };

  const handleConfirmViewSensitiveData = () => {
    if (selectedSubmission?.id) {
      logAccessMutation.mutate(selectedSubmission.id);
    }
  };

  // Helper function to calculate age from date of birth
  const getAgeOrBirthYear = (birthday: string | null | undefined): string => {
    if (!birthday) return "Not provided";
    try {
      const birthDate = new Date(birthday);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < birthDate.getDate())
      ) {
        return `Age ${age - 1}`;
      }
      return `Age ${age}`;
    } catch {
      // If parsing fails, try to extract just the year
      const yearMatch = birthday.match(/\d{4}/);
      if (yearMatch) {
        return `Birth Year: ${yearMatch[0]}`;
      }
      return "Not provided";
    }
  };

  // Helper function to format address (city, state ZIP only)
  const formatAddress = (
    city: string | null | undefined,
    state: string | null | undefined,
    zipCode: string | null | undefined,
  ): string => {
    const parts: string[] = [];
    if (city) parts.push(city);
    if (state) parts.push(state);
    if (zipCode) parts.push(zipCode);
    return parts.length > 0 ? parts.join(", ") : "Not provided";
  };

  // Helper function to mask SSN (show last 4 or masked)
  const maskSSN = (ssn: string | null | undefined): string => {
    if (!ssn) return "Not provided";
    if (showSensitiveData) return ssn;
    if (ssn.length >= 4) {
      return `•••-••-${ssn.slice(-4)}`;
    }
    return "•••-••-••••";
  };

  // Helper function to mask account/routing number
  const maskAccountInfo = (value: string | null | undefined): string => {
    if (!value) return "Not provided";
    if (showSensitiveData) return value;
    if (value.length >= 3) {
      return `••••••${value.slice(-3)}`;
    }
    return "•••••••••";
  };

  // Filter form items based on visibility
  const getFormSections = (): FormSection[] => {
    const allItems: FormItem[] = [
      { id: "lyc", title: "Client Onboarding Form LYC", icon: FileText },
      { id: "contract", title: "Contract / Agreement", icon: FileText },
      { id: "car-on", title: "Car On-boarding", icon: Car },
      { id: "car-off", title: "Car Off-boarding", icon: LogOut },
    ];

    const expenseReceiptItem: FormItem = {
      id: "expense-receipt",
      title: "Income & Expense Receipt Submission",
      icon: DollarSign,
    };
    const approvalDashboardItem: FormItem = {
      id: "approval-dashboard",
      title: "Approval Dashboard",
      icon: FileCheck,
    };

    const employeeOnboardingItems: FormItem[] = [
      {
        id: "employee-onboarding-form",
        title: "Employee Onboarding Form",
        icon: UserPlus,
      },
      {
        id: "employee-contract-1099",
        title: "Contract GLA Contractor Policy 1099",
        icon: FileText,
      },
      {
        id: "employee-offboarding",
        title: "Employee Offboarding Form",
        icon: LogOut,
      },
    ];

    const commissionSubmitItem: FormItem = {
      id: "commission-form-submit",
      title: "Submit Commission Form",
      icon: DollarSign,
    };
    const commissionMySubmissionsItem: FormItem = {
      id: "commission-form-my-submissions",
      title: "My Commission Submissions",
      icon: FileText,
    };
    const commissionApprovalItem: FormItem = {
      id: "commission-form-approval",
      title: "Commission Form Approval Dashboard",
      icon: FileCheck,
    };

    const referralSubmitItem: FormItem = {
      id: "referral-form-submit",
      title: "Submit Referral Form",
      icon: UserPlus,
    };
    const referralMySubmissionsItem: FormItem = {
      id: "referral-form-my-submissions",
      title: "My Referral Submissions",
      icon: FileText,
    };
    const referralApprovalItem: FormItem = {
      id: "referral-form-approval",
      title: "Referral Form Approval Dashboard",
      icon: FileCheck,
    };

    const documentUpdateSubmitItem: FormItem = {
      id: "document-update-submit",
      title: "Submit License / Registration / Insurance Update",
      icon: UserPlus,
    };
    const documentUpdateMySubmissionsItem: FormItem = {
      id: "document-update-my-submissions",
      title: "My Document Submissions",
      icon: FileText,
    };
    const documentUpdateApprovalItem: FormItem = {
      id: "document-update-approval",
      title: "License / Registration / Insurance Approval Dashboard",
      icon: FileCheck,
    };

    // Admin: Client Onboarding + Employee Onboarding Process + Income & Expenses Form + Commissions Form
    // Admins can both submit receipts (same form as employees) and review via Approval Dashboard.
    const carIssueSubmitItem: FormItem = {
      id: "car-issue-submit",
      title: "Car Issue Report",
      icon: Car,
    };

    if (formVisibilityData?.isAdmin) {
      return [
        {
          id: "client-onboarding",
          title: "Client Onboarding Form",
          icon: ClipboardList,
          items: allItems,
        },
        {
          id: "employee-onboarding-process",
          title: "Employee Onboarding Process",
          icon: UserPlus,
          items: employeeOnboardingItems,
        },
        {
          id: "employee-forms",
          title: "Income & Expenses Form",
          icon: DollarSign,
          items: [expenseReceiptItem, approvalDashboardItem],
        },
        {
          id: "commissions-forms",
          title: "Commissions Form",
          icon: DollarSign,
          items: [
            commissionSubmitItem,
            commissionMySubmissionsItem,
            commissionApprovalItem,
          ],
        },
        {
          id: "referral-forms",
          title: "Referral Form",
          icon: Users,
          items: [
            referralSubmitItem,
            referralMySubmissionsItem,
            referralApprovalItem,
          ],
        },
        {
          id: "document-updates",
          title: "License & Registration or Insurance Updates",
          icon: FileText,
          items: [
            documentUpdateSubmitItem,
            documentUpdateMySubmissionsItem,
            documentUpdateApprovalItem,
          ],
        },
        {
          id: "car-issue-forms",
          title: "Car Issue Form",
          icon: Car,
          items: [carIssueSubmitItem],
        },
      ];
    }

    // Employee (non-admin): expense receipt submission + commission submission + view-only submissions
    if (formVisibilityData?.isEmployee) {
      return [
        {
          id: "employee-forms",
          title: "Income & Expenses Form",
          icon: DollarSign,
          items: [expenseReceiptItem],
        },
        {
          id: "commissions-forms",
          title: "Commissions Form",
          icon: DollarSign,
          items: [commissionSubmitItem, commissionMySubmissionsItem],
        },
        {
          id: "car-issue-forms",
          title: "Car Issue Form",
          icon: Car,
          items: [carIssueSubmitItem],
        },
      ];
    }

    // Client: show only Client Onboarding Form section (no Employee Forms)
    if (formVisibilityData?.isClient) {
      const onboardingUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/onboarding`
          : "/onboarding";

      // Always include Client Onboarding Form LYC as a link to /onboarding for clients
      const lycItem: FormItem = {
        id: "lyc",
        title: "Client Onboarding Form LYC",
        icon: FileText,
        externalUrl: onboardingUrl,
      };

      const visibleItems: FormItem[] = [lycItem];

      // Add other form items based on form_visibility
      allItems
        .filter((item) => item.id !== "lyc") // LYC already added above
        .forEach((item) => {
          const formNameMap: Record<string, string> = {
            contract: "Contract / Agreement",
            "car-on": "Car On-boarding",
            "car-off": "Car Off-boarding",
          };
          const formName = formNameMap[item.id];
          if (!formName) return;
          const visibility = formVisibilityData?.formVisibility?.[formName];
          if (!visibility || !visibility.isVisible) return;
          visibleItems.push({
            ...item,
            externalUrl: visibility.externalUrl ?? null,
          } as FormItem);
        });

      return [
        {
          id: "client-onboarding",
          title: "Client Onboarding Form",
          icon: ClipboardList,
          items: visibleItems,
        },
        {
          id: "referral-forms",
          title: "Referral Form",
          icon: Users,
          items: [referralSubmitItem, referralMySubmissionsItem],
        },
        {
          id: "document-updates",
          title: "License & Registration or Insurance Updates",
          icon: FileText,
          items: [documentUpdateSubmitItem, documentUpdateMySubmissionsItem],
        },
      ];
    }

    // Other non-admin roles (e.g. no role flags set), filter based on form visibility
    // Do NOT show Employee Onboarding Forms to non-admin/non-employee roles
    const visibleItems: FormItem[] = allItems
      .map((item) => {
        const formNameMap: Record<string, string> = {
          lyc: "Client Onboarding Form LYC",
          contract: "Contract / Agreement",
          "car-on": "Car On-boarding",
          "car-off": "Car Off-boarding",
        };
        const formName = formNameMap[item.id];
        if (!formName) return null;
        const visibility = formVisibilityData?.formVisibility?.[formName];
        if (!visibility || !visibility.isVisible) return null;
        return {
          ...item,
          externalUrl: visibility.externalUrl ?? null,
        } as FormItem;
      })
      .filter((item): item is FormItem => item !== null);

    return [
      {
        id: "client-onboarding",
        title: "Client Onboarding Form",
        icon: ClipboardList,
        items: visibleItems,
      },
    ];
  };

  const formSections = getFormSections();

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-full">
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-primary">Forms</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage client onboarding, employee onboarding, and expense forms
          </p>
        </div>
        <Card className="bg-card border-primary/20 max-w-full overflow-hidden">
          <CardContent className="p-0 max-w-full overflow-hidden">
            {formSections.map((section) => {
              const SectionIcon = section.icon;
              const isExpanded = expandedSections.includes(section.id);

              // For client users, clicking "Client Onboarding Form" header redirects to /onboarding
              const isClientOnboardingRedirect =
                formVisibilityData?.isClient &&
                section.id === "client-onboarding";
              const onboardingRedirectUrl =
                typeof window !== "undefined"
                  ? `${window.location.origin}/onboarding`
                  : "/onboarding";

              return (
                <div key={section.id}>
                  {isClientOnboardingRedirect ? (
                    <a
                      href={onboardingRedirectUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-card transition-colors"
                      data-testid={`button-section-${section.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <SectionIcon className="w-5 h-5 text-primary" />
                        <span className="text-primary font-semibold text-base">
                          {section.title}
                        </span>
                        <ExternalLink className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </a>
                  ) : (
                    <button
                      onClick={() => toggleSection(section.id)}
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-card transition-colors"
                      data-testid={`button-section-${section.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <SectionIcon className="w-5 h-5 text-primary" />
                        <span className="text-primary font-semibold text-base">
                          {section.title}
                        </span>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      )}
                    </button>
                  )}

                  {(isExpanded || isClientOnboardingRedirect) && (
                    <div className="bg-card max-w-full">
                      {section.items.map((item) => {
                        const ItemIcon = item.icon;
                        const isItemExpanded = expandedItems.includes(item.id);
                        const canExpand =
                          (item.id === "lyc" ||
                            item.id === "contract" ||
                            item.id === "car-on" ||
                            item.id === "car-off" ||
                            item.id === "expense-receipt" ||
                            item.id === "approval-dashboard" ||
                            item.id === "employee-onboarding-form" ||
                            item.id === "employee-contract-1099" ||
                            item.id === "employee-offboarding" ||
                            item.id === "commission-form-submit" ||
                            item.id === "commission-form-my-submissions" ||
                            item.id === "commission-form-approval" ||
                            item.id === "referral-form-submit" ||
                            item.id === "referral-form-my-submissions" ||
                            item.id === "referral-form-approval" ||
                            item.id === "document-update-submit" ||
                            item.id === "document-update-my-submissions" ||
                            item.id === "document-update-approval" ||
                            item.id === "car-issue-submit") &&
                          !item.comingSoon;

                        return (
                          <div key={item.id}>
                            {item.externalUrl ? (
                              // External link - redirect for clients
                              <a
                                href={item.externalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                  "w-full flex items-center justify-between px-5 py-3.5 transition-colors border-t border-border",
                                  "hover:bg-card cursor-pointer",
                                )}
                                data-testid={`button-form-${item.id}`}
                              >
                                <div className="flex items-center gap-3 pl-6">
                                  <ItemIcon className="w-4 h-4 text-primary" />
                                  <span className="text-sm text-primary">
                                    {item.title}
                                  </span>
                                  <ExternalLink className="w-3 h-3 text-muted-foreground ml-1" />
                                </div>
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              </a>
                            ) : (
                              // Internal form - expandable
                              <button
                                className={cn(
                                  "w-full flex items-center justify-between px-5 py-3.5 transition-colors border-t border-border",
                                  item.comingSoon
                                    ? "cursor-default"
                                    : "hover:bg-card cursor-pointer",
                                )}
                                disabled={item.comingSoon}
                                onClick={() => canExpand && toggleItem(item.id)}
                                data-testid={`button-form-${item.id}`}
                              >
                                <div className="flex items-center gap-3 pl-6">
                                  <ItemIcon
                                    className={cn(
                                      "w-4 h-4",
                                      item.comingSoon
                                        ? "text-muted-foreground"
                                        : "text-primary",
                                    )}
                                  />
                                  <span
                                    className={cn(
                                      "text-sm font-medium",
                                      item.comingSoon
                                        ? "text-muted-foreground"
                                        : "text-primary",
                                    )}
                                  >
                                    {item.title}
                                  </span>
                                  {item.comingSoon && (
                                    <Badge
                                      variant="outline"
                                      className="bg-muted/30 text-muted-foreground border-border text-xs ml-2"
                                    >
                                      Coming soon
                                    </Badge>
                                  )}
                                </div>
                                {canExpand ? (
                                  isItemExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                  )
                                ) : (
                                  <ChevronRight
                                    className={cn(
                                      "w-4 h-4",
                                      item.comingSoon
                                        ? "text-gray-700"
                                        : "text-muted-foreground",
                                    )}
                                  />
                                )}
                              </button>
                            )}

                            {/* Expanded content for Contract Management */}
                            {isItemExpanded && item.id === "contract" && (
                              <div className="bg-card border-t border-border px-5 py-4">
                                <ContractManagement />
                              </div>
                            )}

                            {/* Expanded content for Car On-boarding */}
                            {isItemExpanded && item.id === "car-on" && (
                              <div className="bg-card border-t border-border px-3 sm:px-5 py-4 space-y-6 max-w-full">
                                {/* Show form for clients, table for admins */}
                                {formVisibilityData?.isAdmin ||
                                formVisibilityData?.isEmployee ? (
                                  <CarOnboarding />
                                ) : (
                                  <CarOnboardingForm />
                                )}
                              </div>
                            )}

                            {/* Expanded content for Car Off-boarding */}
                            {isItemExpanded && item.id === "car-off" && (
                              <div className="bg-card border-t border-border px-3 sm:px-5 py-4 space-y-6 max-w-full">
                                {/* Show form for clients, table for admins */}
                                {formVisibilityData?.isAdmin ||
                                formVisibilityData?.isEmployee ? (
                                  <CarOffboarding />
                                ) : (
                                  <CarOffboardingForm />
                                )}
                              </div>
                            )}

                            {/* Expanded content for Income & Expense Receipt Submission (employees and admins) */}
                            {isItemExpanded &&
                              item.id === "expense-receipt" && (
                                <div className="bg-card border-t border-border px-3 sm:px-5 py-4 space-y-6 max-w-full">
                                  <ExpenseFormSubmission />
                                  <ExpenseFormMySubmissions />
                                </div>
                              )}

                            {/* Expanded content for Approval Dashboard (admins only) */}
                            {isItemExpanded &&
                              item.id === "approval-dashboard" && (
                                <div className="bg-card border-t border-border px-3 sm:px-5 py-4 space-y-6 min-w-0 max-w-full overflow-hidden">
                                  <ExpenseFormApprovalDashboard
                                    isAdmin={true}
                                  />
                                </div>
                              )}

                            {/* Expanded content for Employee Onboarding Form */}
                            {isItemExpanded &&
                              item.id === "employee-onboarding-form" && (
                                <div className="bg-card border-t border-border px-3 sm:px-5 py-4 space-y-6 max-w-full">
                                  <EmployeeOnboardingFormContent />
                                </div>
                              )}

                            {/* Expanded content for Contract GLA Contractor Policy 1099 */}
                            {isItemExpanded &&
                              item.id === "employee-contract-1099" && (
                                <div className="bg-card border-t border-border px-3 sm:px-5 py-4 space-y-6 max-w-full">
                                  <EmployeeContract1099Content />
                                </div>
                              )}

                            {/* Expanded content for Employee Offboarding Form */}
                            {isItemExpanded &&
                              item.id === "employee-offboarding" && (
                                <div className="bg-card border-t border-border px-3 sm:px-5 py-4 space-y-6 max-w-full">
                                  <EmployeeOffboardingContent />
                                </div>
                              )}

                            {/* Expanded content for Commission Form Submit */}
                            {isItemExpanded &&
                              item.id === "commission-form-submit" && (
                                <div className="bg-card border-t border-border px-3 sm:px-5 py-4 max-w-full">
                                  <CommissionFormSubmission />
                                </div>
                              )}

                            {/* Expanded content for Commission Form My Submissions */}
                            {isItemExpanded &&
                              item.id === "commission-form-my-submissions" && (
                                <div className="bg-card border-t border-border px-3 sm:px-5 py-4 max-w-full">
                                  <CommissionFormMySubmissions />
                                </div>
                              )}

                            {/* Expanded content for Commission Form Approval Dashboard (admins only) */}
                            {isItemExpanded &&
                              item.id === "commission-form-approval" && (
                                <div className="bg-card border-t border-border px-3 sm:px-5 py-4 min-w-0 max-w-full overflow-hidden">
                                  <CommissionFormApprovalDashboard />
                                </div>
                              )}

                            {/* Expanded content for Referral Form Submit */}
                            {isItemExpanded &&
                              item.id === "referral-form-submit" && (
                                <div className="bg-card border-t border-border px-3 sm:px-5 py-4 max-w-full">
                                  <ReferralFormSubmission />
                                </div>
                              )}

                            {/* Expanded content for Referral Form My Submissions */}
                            {isItemExpanded &&
                              item.id === "referral-form-my-submissions" && (
                                <div className="bg-card border-t border-border px-3 sm:px-5 py-4 max-w-full">
                                  <ReferralFormMySubmissions />
                                </div>
                              )}

                            {/* Expanded content for Referral Form Approval Dashboard (admins only) */}
                            {isItemExpanded &&
                              item.id === "referral-form-approval" && (
                                <div className="bg-card border-t border-border px-3 sm:px-5 py-4 min-w-0 max-w-full overflow-hidden">
                                  <ReferralFormApprovalDashboard />
                                </div>
                              )}

                            {/* Expanded content for License/Registration/Insurance Update submission */}
                            {isItemExpanded &&
                              item.id === "document-update-submit" && (
                                <div className="bg-card border-t border-border px-3 sm:px-5 py-4 max-w-full">
                                  <DocumentUpdateSubmission />
                                </div>
                              )}

                            {/* Expanded content for Document Update My Submissions */}
                            {isItemExpanded &&
                              item.id === "document-update-my-submissions" && (
                                <div className="bg-card border-t border-border px-3 sm:px-5 py-4 max-w-full">
                                  <DocumentUpdateMySubmissions />
                                </div>
                              )}

                            {/* Expanded content for Document Update Approval Dashboard (admins only) */}
                            {isItemExpanded &&
                              item.id === "document-update-approval" && (
                                <div className="bg-card border-t border-border px-3 sm:px-5 py-4 min-w-0 max-w-full overflow-hidden">
                                  <DocumentUpdateApprovalDashboard />
                                </div>
                              )}

                            {/* Expanded content for Car Issue Form */}
                            {isItemExpanded &&
                              item.id === "car-issue-submit" && (
                                <div className="bg-card border-t border-border px-3 sm:px-5 py-4 max-w-full">
                                  <CarIssueFormSubmission />
                                </div>
                              )}

                            {/* Expanded content for LYC form */}
                            {isItemExpanded && item.id === "lyc" && (
                              <div className="bg-card border-t border-border px-3 sm:px-5 py-4 space-y-6 max-w-full">
                                {/* QR Code Section */}
                                <QRCodeSection />

                                <div className="mb-4">
                                  <h3 className="text-sm font-medium text-foreground mb-3">
                                    Recent Submissions
                                  </h3>
                                  <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                      type="text"
                                      placeholder="Search by name, email, phone, or vehicle..."
                                      value={searchQuery}
                                      onChange={(e) =>
                                        setSearchQuery(e.target.value)
                                      }
                                      className="pl-10 bg-card border-border text-foreground placeholder:text-gray-600"
                                    />
                                  </div>
                                </div>

                                {isLoadingSubmissions ? (
                                  <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                                  </div>
                                ) : submissionsError ? (
                                  <div className="text-center py-8 text-red-700">
                                    <p className="mb-2">
                                      Error loading submissions
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {submissionsError.message}
                                    </p>
                                  </div>
                                ) : submissionsData?.data &&
                                  submissionsData.data.length > 0 ? (
                                  <div className="w-full overflow-hidden">
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-sm table-auto">
                                        <thead>
                                          <tr className="border-b border-border">
                                            <th className="text-left py-3 px-2 sm:px-3 text-foreground font-medium text-xs whitespace-nowrap">
                                              Name
                                            </th>
                                            <th className="text-left py-3 px-2 sm:px-3 text-muted-foreground font-medium text-xs hidden md:table-cell whitespace-nowrap">
                                              Email
                                            </th>
                                            <th className="text-left py-3 px-2 sm:px-3 text-muted-foreground font-medium text-xs hidden lg:table-cell whitespace-nowrap">
                                              Phone
                                            </th>
                                            <th className="text-left py-3 px-2 sm:px-3 text-foreground font-medium text-xs whitespace-nowrap">
                                              Vehicle
                                            </th>
                                            <th className="text-left py-3 px-2 sm:px-3 text-muted-foreground font-medium text-xs hidden xl:table-cell whitespace-nowrap">
                                              VIN#
                                            </th>
                                            <th className="text-left py-3 px-2 sm:px-3 text-muted-foreground font-medium text-xs hidden xl:table-cell whitespace-nowrap">
                                              Plate #
                                            </th>
                                            <th className="text-left py-3 px-2 sm:px-3 text-muted-foreground font-medium text-xs hidden lg:table-cell whitespace-nowrap">
                                              Submitted
                                            </th>
                                            <th className="text-left py-3 px-2 sm:px-3 text-foreground font-medium text-xs whitespace-nowrap">
                                              Status
                                            </th>
                                            <th className="text-left py-3 px-2 sm:px-3 text-muted-foreground font-medium text-xs hidden md:table-cell whitespace-nowrap">
                                              Contract
                                            </th>
                                            <th className="text-left py-3 px-2 sm:px-3 text-muted-foreground font-medium text-xs hidden 2xl:table-cell whitespace-nowrap">
                                              Car Onboarding Date
                                            </th>
                                            <th className="text-left py-3 px-2 sm:px-3 text-muted-foreground font-medium text-xs hidden 2xl:table-cell whitespace-nowrap">
                                              Car Offboarding Date
                                            </th>
                                            <th className="text-left py-3 px-2 sm:px-3 text-foreground font-medium text-xs whitespace-nowrap">
                                              Actions
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {submissionsData.data.map(
                                            (submission) => (
                                              <tr
                                                key={submission.id}
                                                className="border-b border-border hover:bg-card transition-colors"
                                              >
                                                <td
                                                  className="py-3 px-2 sm:px-3 text-foreground text-xs sm:text-sm max-w-[120px] truncate"
                                                  title={`${submission.firstNameOwner} ${submission.lastNameOwner}`}
                                                >
                                                  {submission.firstNameOwner}{" "}
                                                  {submission.lastNameOwner}
                                                </td>
                                                <td
                                                  className="py-3 px-2 sm:px-3 text-muted-foreground text-xs sm:text-sm hidden md:table-cell max-w-[150px] truncate"
                                                  title={submission.emailOwner}
                                                >
                                                  {submission.emailOwner}
                                                </td>
                                                <td
                                                  className="py-3 px-2 sm:px-3 text-muted-foreground text-xs sm:text-sm hidden lg:table-cell max-w-[120px] truncate"
                                                  title={submission.phoneOwner}
                                                >
                                                  {submission.phoneOwner}
                                                </td>
                                                <td
                                                  className="py-3 px-2 sm:px-3 text-muted-foreground text-xs sm:text-sm max-w-[150px] truncate"
                                                  title={`${submission.vehicleMake} ${submission.vehicleModel} ${submission.vehicleYear}`}
                                                >
                                                  {submission.vehicleMake}{" "}
                                                  {submission.vehicleModel}{" "}
                                                  {submission.vehicleYear}
                                                </td>
                                                <td
                                                  className="py-3 px-2 sm:px-3 text-muted-foreground font-mono text-xs hidden xl:table-cell max-w-[120px] truncate"
                                                  title={
                                                    submission.vinNumber ||
                                                    "N/A"
                                                  }
                                                >
                                                  {submission.vinNumber || (
                                                    <span className="text-muted-foreground">
                                                      N/A
                                                    </span>
                                                  )}
                                                </td>
                                                <td
                                                  className="py-3 px-2 sm:px-3 text-muted-foreground font-mono text-xs hidden xl:table-cell max-w-[100px] truncate"
                                                  title={
                                                    submission.licensePlate ||
                                                    "N/A"
                                                  }
                                                >
                                                  {submission.licensePlate || (
                                                    <span className="text-muted-foreground">
                                                      N/A
                                                    </span>
                                                  )}
                                                </td>
                                                <td className="py-3 px-2 sm:px-3 text-muted-foreground text-xs sm:text-sm hidden lg:table-cell whitespace-nowrap">
                                                  {new Date(
                                                    submission.createdAt,
                                                  ).toLocaleDateString()}
                                                </td>
                                                <td className="py-3 px-2 sm:px-3 whitespace-nowrap">
                                                  <Badge
                                                    variant="outline"
                                                    className={cn(
                                                      "text-xs",
                                                      submission.status ===
                                                        "pending"
                                                        ? "border-yellow-500/50 text-yellow-800 bg-yellow-500/20 font-semibold"
                                                        : submission.status ===
                                                            "approved"
                                                          ? "border-green-500/50 text-green-700 bg-green-500/20 font-semibold"
                                                          : submission.status ===
                                                              "rejected"
                                                            ? "border-red-500/50 text-red-700 bg-red-500/20 font-semibold"
                                                            : "border-gray-500/50 text-gray-700 bg-gray-500/20 font-semibold",
                                                    )}
                                                  >
                                                    {submission.status ||
                                                      "pending"}
                                                  </Badge>
                                                </td>
                                                <td className="py-3 px-2 sm:px-3 hidden md:table-cell whitespace-nowrap">
                                                  <div className="flex items-center gap-2">
                                                    {submission.contractStatus ===
                                                      "sent" && (
                                                      <Badge
                                                        variant="outline"
                                                        className="border-blue-500/50 text-blue-700 bg-blue-500/10 text-xs"
                                                      >
                                                        Sent
                                                      </Badge>
                                                    )}
                                                    {submission.contractStatus ===
                                                      "opened" && (
                                                      <Badge
                                                        variant="outline"
                                                        className="border-blue-500/50 text-blue-700 bg-blue-500/10 text-xs"
                                                      >
                                                        Sent
                                                      </Badge>
                                                    )}
                                                    {submission.contractStatus ===
                                                      "signed" && (
                                                      <>
                                                        <Badge
                                                          variant="outline"
                                                          className="border-green-500/50 text-green-700 bg-green-500/10 text-xs"
                                                        >
                                                          Signed
                                                        </Badge>
                                                        <Button
                                                          size="sm"
                                                          variant="outline"
                                                          className="h-7 px-2 bg-green-500/10 border-green-500/30 text-green-700 hover:bg-green-500/20"
                                                          onClick={() => {
                                                            // Use proxy endpoint for authenticated access
                                                            window.open(
                                                              buildApiUrl(
                                                                `/api/contracts/${submission.id}/view`,
                                                              ),
                                                              "_blank",
                                                            );
                                                          }}
                                                        >
                                                          <ExternalLink className="w-3 h-3 mr-1" />
                                                          View PDF
                                                        </Button>
                                                      </>
                                                    )}
                                                    {submission.contractStatus ===
                                                      "declined" && (
                                                      <Badge
                                                        variant="outline"
                                                        className="border-red-500/50 text-red-700 bg-red-500/10 text-xs"
                                                      >
                                                        Declined
                                                      </Badge>
                                                    )}
                                                    {(!submission.contractStatus ||
                                                      submission.contractStatus ===
                                                        "pending") && (
                                                      <Badge
                                                        variant="outline"
                                                        className="border-yellow-500/50 text-yellow-800 bg-yellow-500/20 text-xs font-semibold"
                                                      >
                                                        Pending
                                                      </Badge>
                                                    )}
                                                  </div>
                                                </td>
                                                <td className="py-3 px-2 sm:px-3 text-muted-foreground text-xs sm:text-sm hidden 2xl:table-cell whitespace-nowrap">
                                                  {submission.contractSignedAt ? (
                                                    new Date(
                                                      submission.contractSignedAt,
                                                    ).toLocaleDateString()
                                                  ) : (
                                                    <span className="text-muted-foreground">
                                                      Not signed
                                                    </span>
                                                  )}
                                                </td>
                                                <td className="py-3 px-2 sm:px-3 text-muted-foreground text-xs sm:text-sm hidden 2xl:table-cell whitespace-nowrap">
                                                  {submission.carOffboardAt ? (
                                                    new Date(
                                                      submission.carOffboardAt,
                                                    ).toLocaleDateString()
                                                  ) : (
                                                    <span className="text-muted-foreground">
                                                      N/A
                                                    </span>
                                                  )}
                                                </td>
                                                <td className="py-3 px-2 sm:px-3 whitespace-nowrap">
                                                  <div className="flex items-center gap-2">
                                                    <Button
                                                      size="sm"
                                                      variant="ghost"
                                                      className="h-8 w-8 p-0 hover:bg-muted/50"
                                                      onClick={() =>
                                                        handleViewDetails(
                                                          submission,
                                                        )
                                                      }
                                                      title="View Details"
                                                    >
                                                      <Eye className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                                                    </Button>

                                                    {/* Always show Approve/Decline buttons for consistent layout */}
                                                    {/* Allow approval if contract is signed OR if contract status is null/empty (imported submissions) */}
                                                    <Button
                                                      size="sm"
                                                      variant="ghost"
                                                      className="h-8 w-8 p-0 text-[#d4af37]"
                                                      onClick={() => {
                                                        approvalMutation.mutate(
                                                          {
                                                            id: submission.id,
                                                            action: "approve",
                                                          },
                                                        );
                                                      }}
                                                      disabled={
                                                        (submission.contractStatus !==
                                                          "signed" &&
                                                          submission.contractStatus !==
                                                            null &&
                                                          submission.contractStatus !==
                                                            undefined) ||
                                                        submission.status ===
                                                          "approved" ||
                                                        submission.status ===
                                                          "rejected" ||
                                                        approvalMutation.isPending
                                                      }
                                                      title={
                                                        submission.contractStatus !==
                                                          "signed" &&
                                                        submission.contractStatus !==
                                                          null &&
                                                        submission.contractStatus !==
                                                          undefined
                                                          ? "Contract must be signed before approval"
                                                          : submission.status ===
                                                              "approved"
                                                            ? "Already approved"
                                                            : submission.status ===
                                                                "rejected"
                                                              ? "Already rejected"
                                                              : "Approve submission"
                                                      }
                                                    >
                                                      <CheckCircle className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                      size="sm"
                                                      variant="ghost"
                                                      className="h-8 w-8 p-0 text-red-700"
                                                      onClick={() => {
                                                        setSubmissionToDecline(
                                                          submission,
                                                        );
                                                        setShowDeclineModal(
                                                          true,
                                                        );
                                                      }}
                                                      disabled={
                                                        (submission.contractStatus !==
                                                          "signed" &&
                                                          submission.contractStatus !==
                                                            null &&
                                                          submission.contractStatus !==
                                                            undefined) ||
                                                        submission.status ===
                                                          "approved" ||
                                                        submission.status ===
                                                          "rejected" ||
                                                        approvalMutation.isPending
                                                      }
                                                      title={
                                                        submission.contractStatus !==
                                                          "signed" &&
                                                        submission.contractStatus !==
                                                          null &&
                                                        submission.contractStatus !==
                                                          undefined
                                                          ? "Contract must be signed before decline"
                                                          : submission.status ===
                                                              "approved"
                                                            ? "Already approved"
                                                            : submission.status ===
                                                                "rejected"
                                                              ? "Already declined"
                                                              : "Decline submission"
                                                      }
                                                    >
                                                      <XCircle className="w-4 h-4" />
                                                    </Button>
                                                  </div>
                                                </td>
                                              </tr>
                                            ),
                                          )}
                                        </tbody>
                                      </table>
                                    </div>

                                    {/* Pagination */}
                                    {submissionsData.pagination && (
                                      <TablePagination
                                        totalItems={
                                          submissionsData.pagination.total
                                        }
                                        itemsPerPage={itemsPerPage}
                                        currentPage={page}
                                        onPageChange={(newPage) => {
                                          setPage(newPage);
                                          window.scrollTo({
                                            top: 0,
                                            behavior: "smooth",
                                          });
                                          window.scrollTo({
                                            top: 0,
                                            behavior: "smooth",
                                          });
                                        }}
                                        onItemsPerPageChange={(newLimit) => {
                                          setItemsPerPage(newLimit);
                                          setPage(1); // Reset to first page when changing limit
                                        }}
                                        isLoading={isLoadingSubmissions}
                                      />
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-center py-8 text-muted-foreground">
                                    No submissions found
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <ClientPageLinks />
      </div>

      {/* Submission Details Dialog */}
      <Dialog
        open={isDetailsOpen}
        onOpenChange={(open) => {
          setIsDetailsOpen(open);
          if (!open) {
            setShowSensitiveData(false);
            setShowAccessConfirmation(false);
          }
        }}
      >
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-card border-primary/30 border-2 text-foreground">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-foreground text-2xl">
                  Complete Submission Details
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Full onboarding form submission information - All data from
                  database
                </DialogDescription>
              </div>
              {!showSensitiveData && (
                <Button
                  onClick={handleRequestSensitiveData}
                  variant="outline"
                  className="bg-yellow-500/10 border-yellow-500/50 text-yellow-700 hover:bg-yellow-500/20"
                >
                  View Full Sensitive Information
                </Button>
              )}
            </div>
          </DialogHeader>

          {/* Confirmation Dialog for Sensitive Data Access */}
          <Dialog
            open={showAccessConfirmation}
            onOpenChange={setShowAccessConfirmation}
          >
            <DialogContent className="bg-card border-primary/30 border-2 text-foreground max-w-md">
              <DialogHeader>
                <DialogTitle className="text-foreground text-xl">
                  Access Sensitive Data
                </DialogTitle>
                <DialogDescription className="text-muted-foreground mt-2">
                  This action is logged. Continue?
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-3 mt-4">
                <Button
                  onClick={() => setShowAccessConfirmation(false)}
                  variant="outline"
                  className="border-border text-muted-foreground hover:bg-muted/50"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmViewSensitiveData}
                  disabled={logAccessMutation.isPending}
                  className="bg-yellow-500/20 border-yellow-500/50 text-yellow-700 hover:bg-yellow-500/30"
                >
                  {logAccessMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Logging...
                    </>
                  ) : (
                    "Continue"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {submissionDetails?.data ? (
            <div className="space-y-6 mt-4">
              {/* Helper function to display value or "Not provided" */}
              {(() => {
                const formatValue = (value: any): string => {
                  if (value === null || value === undefined || value === "")
                    return "Not provided";
                  return String(value);
                };

                const formatDate = (
                  dateStr: string | null | undefined,
                ): string => {
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

                const data = submissionDetails.data;

                // Helper function to check if a URL is a PDF
                const isPdfDocument = (url: string): boolean => {
                  if (!url) return false;
                  const lowerUrl = url.toLowerCase();
                  return lowerUrl.endsWith(".pdf") || lowerUrl.includes(".pdf");
                };

                // Parse driversLicenseUrls if it's a string
                let driversLicenseUrlsArray: string[] = [];
                if (data.driversLicenseUrls) {
                  if (typeof data.driversLicenseUrls === "string") {
                    try {
                      const parsed = JSON.parse(data.driversLicenseUrls);
                      driversLicenseUrlsArray = Array.isArray(parsed)
                        ? parsed
                        : [];
                    } catch {
                      driversLicenseUrlsArray = [];
                    }
                  } else if (Array.isArray(data.driversLicenseUrls)) {
                    driversLicenseUrlsArray = data.driversLicenseUrls;
                  }
                }

                return (
                  <>
                    {/* Personal Information */}
                    <div className="bg-card p-4 rounded-lg border border-primary/20">
                      <h3 className="text-lg font-semibold text-primary mb-4 pb-2 border-b border-primary/30">
                        Personal Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Full Name:
                          </span>
                          <span className="text-foreground font-medium">
                            {formatValue(data.firstNameOwner)}{" "}
                            {formatValue(data.lastNameOwner)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Email:
                          </span>
                          <span className="text-foreground">
                            {formatValue(data.emailOwner)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Phone:
                          </span>
                          <span className="text-foreground">
                            {formatValue(data.phoneOwner)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Date of Birth:
                          </span>
                          <span className="text-foreground">
                            {showSensitiveData
                              ? formatValue(data.birthday)
                              : getAgeOrBirthYear(data.birthday)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            T-Shirt Size:
                          </span>
                          <span className="text-foreground">
                            {formatValue(data.tshirtSize)}
                          </span>
                        </div>
                        {showSensitiveData && (
                          <div>
                            <span className="text-muted-foreground block mb-1">
                              SSN:
                            </span>
                            <span className="text-foreground font-mono">
                              {maskSSN(data.ssn)}
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Representative:
                          </span>
                          <span className="text-foreground">
                            {formatValue(data.representative)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            How Did You Hear About Us:
                          </span>
                          <span className="text-foreground">
                            {formatValue(data.heardAboutUs)}
                          </span>
                        </div>
                        {showSensitiveData && (
                          <>
                            <div>
                              <span className="text-muted-foreground block mb-1">
                                Emergency Contact Name:
                              </span>
                              <span className="text-foreground">
                                {formatValue(data.emergencyContactName)}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block mb-1">
                                Emergency Contact Phone:
                              </span>
                              <span className="text-foreground">
                                {formatValue(data.emergencyContactPhone)}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Address Information */}
                    <div className="bg-card p-4 rounded-lg border border-primary/20">
                      <h3 className="text-lg font-semibold text-primary mb-4 pb-2 border-b border-primary/30">
                        Address Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            T-Shirt Size:
                          </span>
                          <span className="text-foreground">
                            {formatValue(data.tshirtSize)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            First Name:
                          </span>
                          <span className="text-foreground font-medium">
                            {formatValue(data.firstNameOwner)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Last Name:
                          </span>
                          <span className="text-foreground font-medium">
                            {formatValue(data.lastNameOwner)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Phone:
                          </span>
                          <span className="text-foreground">
                            {formatValue(data.phoneOwner)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Email:
                          </span>
                          <span className="text-foreground">
                            {formatValue(data.emailOwner)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Representative:
                          </span>
                          <span className="text-foreground">
                            {formatValue(data.representative)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            How Did You Hear About Us:
                          </span>
                          <span className="text-foreground">
                            {formatValue(data.heardAboutUs)}
                          </span>
                        </div>
                        {showSensitiveData && (
                          <div>
                            <span className="text-muted-foreground block mb-1">
                              Date of Birth:
                            </span>
                            <span className="text-foreground">
                              {formatValue(data.birthday)}
                            </span>
                          </div>
                        )}
                        {showSensitiveData && (
                          <div className="md:col-span-2">
                            <span className="text-muted-foreground block mb-1">
                              Street Address:
                            </span>
                            <span className="text-foreground">
                              {formatValue(data.streetAddress)}
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            City:
                          </span>
                          <span className="text-foreground">
                            {formatValue(data.city)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            State:
                          </span>
                          <span className="text-foreground">
                            {formatValue(data.state)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Zip Code:
                          </span>
                          <span className="text-foreground">
                            {formatValue(data.zipCode)}
                          </span>
                        </div>
                        {showSensitiveData && (
                          <>
                            <div>
                              <span className="text-muted-foreground block mb-1">
                                Emergency Contact Name:
                              </span>
                              <span className="text-foreground">
                                {formatValue(data.emergencyContactName)}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block mb-1">
                                Emergency Contact Phone:
                              </span>
                              <span className="text-foreground">
                                {formatValue(data.emergencyContactPhone)}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Vehicle Information */}
                    <div className="bg-card p-4 rounded-lg border border-primary/20">
                      <h3 className="text-lg font-semibold text-primary mb-4 pb-2 border-b border-primary/30">
                        Vehicle Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Year:
                          </span>
                          <span className="text-foreground">
                            {formatValue(data.vehicleYear)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Make:
                          </span>
                          <span className="text-foreground">
                            {formatValue(data.vehicleMake)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Model:
                          </span>
                          <span className="text-foreground">
                            {formatValue(data.vehicleModel)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Trim:
                          </span>
                          <span className="text-foreground">
                            {formatValue(data.vehicleTrim)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            VIN Number:
                          </span>
                          <span className="text-foreground font-mono text-xs">
                            {formatValue(data.vinNumber)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            License Plate:
                          </span>
                          <span className="text-foreground">
                            {formatValue(data.licensePlate)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Mileage:
                          </span>
                          <span className="text-foreground">
                            {formatValue(data.vehicleMiles)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Exterior Color:
                          </span>
                          <span className="text-foreground">
                            {formatValue(data.exteriorColor)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Interior Color:
                          </span>
                          <span className="text-foreground">
                            {formatValue(data.interiorColor)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Title Type:
                          </span>
                          <span className="text-foreground">
                            {formatValue(data.titleType)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Registration Expiration:
                          </span>
                          <span className="text-foreground">
                            {formatValue(data.registrationExpiration)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Fuel Type:
                          </span>
                          <span className="text-foreground">
                            {formatValue(data.fuelType)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Vehicle Recall:
                          </span>
                          <span className="text-foreground">
                            {formatValue(data.vehicleRecall)}
                          </span>
                        </div>
                        {data.vehicleFeatures && (
                          <div className="md:col-span-2">
                            <span className="text-muted-foreground block mb-2">
                              Features:
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {(() => {
                                let featuresArray: string[] = [];
                                try {
                                  if (
                                    typeof data.vehicleFeatures === "string"
                                  ) {
                                    const parsed = JSON.parse(
                                      data.vehicleFeatures,
                                    );
                                    featuresArray = Array.isArray(parsed)
                                      ? parsed
                                      : [];
                                  } else if (
                                    Array.isArray(data.vehicleFeatures)
                                  ) {
                                    featuresArray = data.vehicleFeatures;
                                  }
                                } catch {
                                  featuresArray = [];
                                }
                                return featuresArray.length > 0 ? (
                                  featuresArray.map(
                                    (feature: string, index: number) => (
                                      <Badge
                                        key={index}
                                        variant="outline"
                                        className="border-primary/50 text-primary bg-[#D3BC8D]/10 text-xs"
                                      >
                                        {feature}
                                      </Badge>
                                    ),
                                  )
                                ) : (
                                  <span className="text-muted-foreground text-sm">
                                    No features selected
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Does Your Vehicle Have Free Dealership Oil Changes?:
                          </span>
                          <span className="text-foreground">
                            {formatValue(data.freeDealershipOilChanges)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            If Yes, For How Many Years of Oil Changes OR What
                            Oil Package:
                          </span>
                          <span className="text-foreground">
                            {data.freeDealershipOilChanges === "Yes"
                              ? formatValue(data.oilPackageDetails)
                              : "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Vehicle Recall Missing Error - Prominent overlay */}
                    {(!data.vehicleRecall ||
                      data.vehicleRecall.trim() === "" ||
                      data.vehicleRecall === "Not provided") && (
                      <div className="relative my-4 z-20">
                        <div className="bg-white border-4 border-red-500 rounded-lg p-6 shadow-2xl flex items-center justify-center">
                          <p className="text-red-500 text-xl font-semibold text-center m-0">
                            Vehicle Recall is missing
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Financial Information */}
                    <div
                      className={`bg-card p-4 rounded-lg border border-primary/20 ${!data.vehicleRecall || data.vehicleRecall.trim() === "" || data.vehicleRecall === "Not provided" ? "opacity-30" : ""}`}
                    >
                      <h3 className="text-lg font-semibold text-primary mb-4 pb-2 border-b border-primary/30">
                        Financial Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Plate #:
                          </span>
                          <span className="text-foreground font-medium">
                            {formatCurrency(data.purchasePrice)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Down Payment:
                          </span>
                          <span className="text-foreground font-medium">
                            {formatCurrency(data.downPayment)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Monthly Payment:
                          </span>
                          <span className="text-foreground font-medium">
                            {formatCurrency(data.monthlyPayment)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Interest Rate:
                          </span>
                          <span className="text-foreground">
                            {formatValue(data.interestRate)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Transport City to City:
                          </span>
                          <span className="text-foreground">
                            {formatValue(data.transportCityToCity)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Ultimate Goal:
                          </span>
                          <span className="text-foreground">
                            {formatValue(data.ultimateGoal)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Banking Information */}
                    <div className="bg-card p-4 rounded-lg border border-primary/20">
                      <h3 className="text-lg font-semibold text-primary mb-4 pb-2 border-b border-primary/30">
                        Banking Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Bank Name:
                          </span>
                          <span className="text-foreground">
                            {formatValue(data.bankName)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Tax Classification:
                          </span>
                          <span className="text-foreground">
                            {formatValue(data.taxClassification)}
                          </span>
                        </div>
                        {showSensitiveData && (
                          <>
                            <div>
                              <span className="text-muted-foreground block mb-1">
                                Routing Number:
                              </span>
                              <span className="text-foreground font-mono">
                                {maskAccountInfo(data.routingNumber)}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block mb-1">
                                Account Number:
                              </span>
                              <span className="text-foreground font-mono">
                                {maskAccountInfo(data.accountNumber)}
                              </span>
                            </div>
                          </>
                        )}
                        {data.businessName && (
                          <div>
                            <span className="text-muted-foreground block mb-1">
                              Business Name:
                            </span>
                            <span className="text-foreground">
                              {formatValue(data.businessName)}
                            </span>
                          </div>
                        )}
                        {data.ein && (
                          <div>
                            <span className="text-muted-foreground block mb-1">
                              EIN:
                            </span>
                            <span className="text-foreground font-mono">
                              {showSensitiveData
                                ? formatValue(data.ein)
                                : maskAccountInfo(data.ein)}
                            </span>
                          </div>
                        )}
                        {data.ssn && (
                          <div>
                            <span className="text-muted-foreground block mb-1">
                              SSN:
                            </span>
                            <span className="text-foreground font-mono">
                              {showSensitiveData
                                ? formatValue(data.ssn)
                                : maskAccountInfo(data.ssn)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Insurance Information */}
                    <div className="bg-card p-4 rounded-lg border border-primary/20">
                      <h3 className="text-lg font-semibold text-primary mb-4 pb-2 border-b border-primary/30">
                        Insurance Information
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Provider:
                          </span>
                          <span className="text-foreground">
                            {formatValue(data.insuranceProvider)}
                          </span>
                        </div>
                        {showSensitiveData && (
                          <div>
                            <span className="text-muted-foreground block mb-1">
                              Policy Number:
                            </span>
                            <span className="text-foreground">
                              {formatValue(data.policyNumber)}
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Insurance Phone:
                          </span>
                          <span className="text-foreground">
                            {formatValue(data.insurancePhone)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Insurance Expiration:
                          </span>
                          <span className="text-foreground">
                            {formatValue(data.insuranceExpiration)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Contract Status */}
                    <div className="bg-card p-4 rounded-lg border border-primary/20">
                      <h3 className="text-lg font-semibold text-primary mb-4 pb-2 border-b border-primary/30">
                        Contract Status & Details
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Contract Status:
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "mt-1",
                              data.contractStatus === "signed"
                                ? "border-green-500/50 text-green-700 bg-green-500/20 font-semibold"
                                : data.contractStatus === "sent"
                                  ? "border-blue-500/50 text-blue-700 bg-blue-500/20 font-semibold"
                                  : data.contractStatus === "opened"
                                    ? "border-yellow-500/50 text-yellow-800 bg-yellow-500/20 font-semibold"
                                    : data.contractStatus === "declined"
                                      ? "border-red-500/50 text-red-700 bg-red-500/20 font-semibold"
                                      : "border-yellow-500/50 text-yellow-800 bg-yellow-500/20 font-semibold",
                            )}
                          >
                            {formatValue(data.contractStatus || "Not sent")}
                          </Badge>
                        </div>
                        {showSensitiveData && (
                          <div>
                            <span className="text-muted-foreground block mb-1">
                              Contract Token:
                            </span>
                            <span className="text-foreground font-mono text-xs break-all">
                              {formatValue(data.contractToken)}
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Contract Sent At:
                          </span>
                          <span className="text-foreground">
                            {formatDate(data.contractSentAt)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Contract Signed At:
                          </span>
                          <span className="text-foreground">
                            {formatDate(data.contractSignedAt)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Reminder Count:
                          </span>
                          <span className="text-foreground font-medium">
                            {data.reminderCount || 0} / 3
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Last Reminder Sent:
                          </span>
                          <span className="text-foreground">
                            {formatDate(data.lastReminderSentAt)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Next Reminder Due:
                          </span>
                          <span className="text-foreground">
                            {formatDate(data.nextReminderDueAt)}
                          </span>
                        </div>
                        {data.contractStatus === "signed" && (
                          <div className="md:col-span-2">
                            <Button
                              onClick={() => {
                                // Use proxy endpoint for authenticated access
                                window.open(
                                  buildApiUrl(`/api/contracts/${data.id}/view`),
                                  "_blank",
                                );
                              }}
                              className="bg-primary text-primary-foreground hover:bg-primary/80"
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Download Signed PDF
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Health Insurance Card & Driver's License */}
                    <div className="bg-card p-4 rounded-lg border border-primary/20">
                      <div className="flex items-center justify-between mb-4 pb-2 border-b border-primary/30">
                        <h3 className="text-lg font-semibold text-primary">
                          Documents
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Health Insurance Card */}
                        <div className="space-y-4">
                          <h4 className="text-base font-semibold text-muted-foreground">
                            Insurance Card
                          </h4>

                          {/* Insurance Card Display */}
                          {data.insuranceCardUrl ? (
                            (() => {
                              const documentUrl =
                                data.insuranceCardUrl.startsWith("http")
                                  ? data.insuranceCardUrl
                                  : buildApiUrl(data.insuranceCardUrl);
                              const isPdf = isPdfDocument(
                                data.insuranceCardUrl,
                              );

                              return (
                                <div
                                  className="relative group cursor-pointer"
                                  onClick={() => {
                                    setFullScreenDocument({
                                      url: documentUrl,
                                      type: "insurance",
                                      isPdf,
                                    });
                                  }}
                                >
                                  <div
                                    className={`relative w-full aspect-[4/3] bg-background rounded-lg border-2 transition-all overflow-hidden shadow-lg ${
                                      isPdf
                                        ? "border-primary/50 hover:border-primary shadow-[#D3BC8D]/20"
                                        : "border-primary/30 hover:border-primary shadow-[#D3BC8D]/20"
                                    }`}
                                  >
                                    {isPdf ? (
                                      <div className="w-full h-full flex flex-col items-center justify-center p-4">
                                        <FileText className="w-16 h-16 text-primary mb-2" />
                                        <p className="text-primary text-sm font-semibold">
                                          PDF Document
                                        </p>
                                        <p className="text-muted-foreground text-xs mt-1">
                                          Click to open in PDF viewer
                                        </p>
                                      </div>
                                    ) : (
                                      <img
                                        src={documentUrl}
                                        alt="Insurance Card"
                                        className="w-full h-full object-contain p-2"
                                        onError={(e) => {
                                          console.error(
                                            "Failed to load insurance card image:",
                                            data.insuranceCardUrl,
                                          );
                                          const target =
                                            e.target as HTMLImageElement;
                                          target.style.display = "none";
                                          const parent =
                                            target.parentElement?.parentElement;
                                          if (
                                            parent &&
                                            !parent.querySelector(
                                              ".error-message",
                                            )
                                          ) {
                                            const errorDiv =
                                              document.createElement("div");
                                            errorDiv.className =
                                              "error-message text-sm text-muted-foreground absolute inset-0 flex items-center justify-center";
                                            errorDiv.textContent =
                                              "Failed to load image";
                                            parent.appendChild(errorDiv);
                                          }
                                        }}
                                      />
                                    )}
                                    <div className="absolute inset-0 bg-background/0 group-hover:bg-background/10 transition-colors flex items-center justify-center">
                                      <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-background/70 text-foreground px-4 py-2 rounded-lg text-sm font-medium">
                                        {isPdf
                                          ? "Click to open PDF"
                                          : "Click to view full screen"}
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
                            })()
                          ) : (
                            <div className="w-full aspect-[4/3] bg-background rounded-lg border border-border flex items-center justify-center">
                              <p className="text-sm text-muted-foreground">
                                No insurance card uploaded
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Driver's License */}
                        <div className="space-y-4">
                          <h4 className="text-base font-semibold text-muted-foreground">
                            Driver License
                          </h4>

                          {/* Driver's License Display */}
                          {driversLicenseUrlsArray.length > 0 ? (
                            <div className="space-y-4">
                              {driversLicenseUrlsArray.map(
                                (url: string, index: number) => {
                                  const documentUrl = url.startsWith("http")
                                    ? url
                                    : buildApiUrl(url);
                                  const isPdf = isPdfDocument(url);

                                  return (
                                    <div
                                      key={index}
                                      className="relative group cursor-pointer"
                                      onClick={() =>
                                        setFullScreenDocument({
                                          url: documentUrl,
                                          type: "license",
                                          index,
                                          isPdf,
                                        })
                                      }
                                    >
                                      <div
                                        className={`relative w-full aspect-[4/3] bg-background rounded-lg border-2 transition-all overflow-hidden shadow-lg ${
                                          isPdf
                                            ? "border-primary/50 hover:border-primary shadow-[#D3BC8D]/20"
                                            : "border-primary/30 hover:border-primary shadow-[#D3BC8D]/20"
                                        }`}
                                      >
                                        {isPdf ? (
                                          <div className="w-full h-full flex flex-col items-center justify-center p-4">
                                            <FileText className="w-16 h-16 text-primary mb-2" />
                                            <p className="text-primary text-sm font-semibold">
                                              PDF Document
                                            </p>
                                            <p className="text-muted-foreground text-xs mt-1">
                                              Click to open in PDF viewer
                                            </p>
                                          </div>
                                        ) : (
                                          <img
                                            src={documentUrl}
                                            alt={`Driver's License ${index + 1}`}
                                            className="w-full h-full object-contain p-2"
                                            onError={(e) => {
                                              console.error(
                                                "Failed to load drivers license image:",
                                                url,
                                              );
                                              const target =
                                                e.target as HTMLImageElement;
                                              target.style.display = "none";
                                              const parent =
                                                target.parentElement
                                                  ?.parentElement;
                                              if (
                                                parent &&
                                                !parent.querySelector(
                                                  ".error-message",
                                                )
                                              ) {
                                                const errorDiv =
                                                  document.createElement("div");
                                                errorDiv.className =
                                                  "error-message text-sm text-muted-foreground absolute inset-0 flex items-center justify-center";
                                                errorDiv.textContent =
                                                  "Failed to load image";
                                                parent.appendChild(errorDiv);
                                              }
                                            }}
                                          />
                                        )}
                                        <div className="absolute inset-0 bg-background/0 group-hover:bg-background/10 transition-colors flex items-center justify-center">
                                          <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-background/70 text-foreground px-4 py-2 rounded-lg text-sm font-medium">
                                            {isPdf
                                              ? "Click to open PDF"
                                              : "Click to view full screen"}
                                          </div>
                                        </div>
                                        {isPdf && (
                                          <div className="absolute top-2 right-2 bg-[#D3BC8D]/90 text-black text-xs px-2 py-1 rounded font-semibold">
                                            PDF
                                          </div>
                                        )}
                                        {driversLicenseUrlsArray.length > 1 && (
                                          <div className="absolute top-2 left-2 bg-background/80 text-foreground text-xs px-2 py-1 rounded">
                                            {index + 1} /{" "}
                                            {driversLicenseUrlsArray.length}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                },
                              )}
                            </div>
                          ) : (
                            <div className="w-full aspect-[4/3] bg-background rounded-lg border border-border flex items-center justify-center">
                              <p className="text-sm text-muted-foreground">
                                No driver's license uploaded
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Timestamps */}
                    <div className="bg-card p-4 rounded-lg border border-primary/20">
                      <h3 className="text-lg font-semibold text-primary mb-4 pb-2 border-b border-primary/30">
                        Timestamps
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Created At:
                          </span>
                          <span className="text-foreground">
                            {formatDate(data.createdAt)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block mb-1">
                            Last Updated:
                          </span>
                          <span className="text-foreground">
                            {formatDate(data.updatedAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Decline Reason Modal */}
      <Dialog open={showDeclineModal} onOpenChange={setShowDeclineModal}>
        <DialogContent className="bg-background border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-primary">
              Decline Submission
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Please provide a reason for declining this submission. The client
              will receive an email with this reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {submissionToDecline && (
              <div className="text-sm text-muted-foreground">
                <p>
                  <span className="text-muted-foreground">Client:</span>{" "}
                  {submissionToDecline.firstNameOwner}{" "}
                  {submissionToDecline.lastNameOwner}
                </p>
                <p>
                  <span className="text-muted-foreground">Email:</span>{" "}
                  {submissionToDecline.emailOwner}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="decline-reason" className="text-muted-foreground">
                Reason for Decline <span className="text-red-700">*</span>
              </Label>
              <Textarea
                id="decline-reason"
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Enter reason for declining this submission..."
                className="bg-card border-border text-foreground placeholder:text-gray-600 min-h-[100px]"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeclineModal(false);
                  setDeclineReason("");
                  setSubmissionToDecline(null);
                }}
                className="border-border text-muted-foreground hover:bg-muted/50"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!declineReason.trim()) {
                    toast({
                      title: "Reason Required",
                      description: "Please provide a reason for declining.",
                      variant: "destructive",
                    });
                    return;
                  }
                  if (submissionToDecline) {
                    approvalMutation.mutate({
                      id: submissionToDecline.id,
                      action: "reject",
                      reason: declineReason.trim(),
                    });
                  }
                }}
                disabled={!declineReason.trim() || approvalMutation.isPending}
                className="bg-red-500 hover:bg-red-500/20 text-red-700 border-red-500/50 text-foreground"
              >
                {approvalMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Declining...
                  </>
                ) : (
                  "Decline Submission"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
              position: "fixed",
              top: "1rem",
              right: "1rem",
              zIndex: 9999,
            }}
          >
            <X className="w-8 h-8" strokeWidth={3} />
          </Button>

          <div className="relative w-full h-full flex items-center justify-center p-8">
            {/* Image Counter - Bottom Center (for multiple drivers licenses) */}
            {fullScreenDocument.type === "license" &&
              submissionDetails?.data?.driversLicenseUrls &&
              fullScreenDocument.index !== undefined &&
              (() => {
                let driversLicenseUrlsArray: string[] = [];
                if (submissionDetails.data.driversLicenseUrls) {
                  if (
                    typeof submissionDetails.data.driversLicenseUrls ===
                    "string"
                  ) {
                    try {
                      const parsed = JSON.parse(
                        submissionDetails.data.driversLicenseUrls,
                      );
                      driversLicenseUrlsArray = Array.isArray(parsed)
                        ? parsed
                        : [];
                    } catch {
                      driversLicenseUrlsArray = [];
                    }
                  } else if (
                    Array.isArray(submissionDetails.data.driversLicenseUrls)
                  ) {
                    driversLicenseUrlsArray =
                      submissionDetails.data.driversLicenseUrls;
                  }
                }
                return driversLicenseUrlsArray.length > 1 ? (
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[101] bg-background/80 backdrop-blur-sm px-6 py-3 rounded-full border-2 border-white/40 shadow-2xl">
                    <span className="text-foreground text-base font-semibold tracking-wide">
                      {fullScreenDocument.index + 1} /{" "}
                      {driversLicenseUrlsArray.length}
                    </span>
                  </div>
                ) : null;
              })()}

            {/* Navigation Buttons (for multiple drivers licenses) */}
            {fullScreenDocument.type === "license" &&
              submissionDetails?.data?.driversLicenseUrls &&
              fullScreenDocument.index !== undefined &&
              (() => {
                let driversLicenseUrlsArray: string[] = [];
                if (submissionDetails.data.driversLicenseUrls) {
                  if (
                    typeof submissionDetails.data.driversLicenseUrls ===
                    "string"
                  ) {
                    try {
                      const parsed = JSON.parse(
                        submissionDetails.data.driversLicenseUrls,
                      );
                      driversLicenseUrlsArray = Array.isArray(parsed)
                        ? parsed
                        : [];
                    } catch {
                      driversLicenseUrlsArray = [];
                    }
                  } else if (
                    Array.isArray(submissionDetails.data.driversLicenseUrls)
                  ) {
                    driversLicenseUrlsArray =
                      submissionDetails.data.driversLicenseUrls;
                  }
                }
                return driversLicenseUrlsArray.length > 1 ? (
                  <>
                    {/* Previous Button */}
                    {fullScreenDocument.index > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          const prevIndex = fullScreenDocument.index! - 1;
                          const prevUrl = driversLicenseUrlsArray[prevIndex];
                          const imageUrl = prevUrl.startsWith("http")
                            ? prevUrl
                            : buildApiUrl(prevUrl);
                          const isPdf =
                            prevUrl.toLowerCase().endsWith(".pdf") ||
                            prevUrl.toLowerCase().includes(".pdf");
                          setFullScreenDocument({
                            url: imageUrl,
                            type: "license",
                            index: prevIndex,
                            isPdf,
                          });
                        }}
                        className="fixed left-6 top-1/2 -translate-y-1/2 z-[200] h-14 w-14 bg-background/90 hover:bg-muted/50D3BC8D]/20 text-foreground border-2 border-white/60 rounded-full shadow-2xl backdrop-blur-sm transition-all hover:scale-110"
                        aria-label="Previous image"
                      >
                        <ChevronLeft className="w-6 h-6" />
                      </Button>
                    )}

                    {/* Next Button */}
                    {fullScreenDocument.index <
                      driversLicenseUrlsArray.length - 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          const nextIndex = fullScreenDocument.index! + 1;
                          const nextUrl = driversLicenseUrlsArray[nextIndex];
                          const imageUrl = nextUrl.startsWith("http")
                            ? nextUrl
                            : buildApiUrl(nextUrl);
                          const isPdf =
                            nextUrl.toLowerCase().endsWith(".pdf") ||
                            nextUrl.toLowerCase().includes(".pdf");
                          setFullScreenDocument({
                            url: imageUrl,
                            type: "license",
                            index: nextIndex,
                            isPdf,
                          });
                        }}
                        className="fixed right-6 top-1/2 -translate-y-1/2 z-[200] h-14 w-14 bg-background/90 hover:bg-muted/50D3BC8D]/20 text-foreground border-2 border-white/60 rounded-full shadow-2xl backdrop-blur-sm transition-all hover:scale-110"
                        aria-label="Next image"
                      >
                        <ChevronRight className="w-6 h-6" />
                      </Button>
                    )}
                  </>
                ) : null;
              })()}

            {/* Full Screen Document Display - PDF or Image */}
            {fullScreenDocument.isPdf ? (
              <iframe
                src={fullScreenDocument.url}
                className="w-full h-full border-0"
                style={{
                  maxWidth: "100vw",
                  maxHeight: "100vh",
                }}
                onClick={(e) => e.stopPropagation()}
                title={
                  fullScreenDocument.type === "insurance"
                    ? "Insurance Card PDF"
                    : `Driver's License PDF ${fullScreenDocument.index !== undefined ? fullScreenDocument.index + 1 : ""}`
                }
              />
            ) : (
              <img
                src={fullScreenDocument.url}
                alt={
                  fullScreenDocument.type === "insurance"
                    ? "Insurance Card"
                    : `Driver's License ${fullScreenDocument.index !== undefined ? fullScreenDocument.index + 1 : ""}`
                }
                className="w-full h-full object-contain"
                onClick={(e) => e.stopPropagation()}
                style={{
                  maxWidth: "100vw",
                  maxHeight: "100vh",
                }}
                onError={(e) => {
                  console.error(
                    "Failed to load image in full screen viewer:",
                    fullScreenDocument.url,
                  );
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
