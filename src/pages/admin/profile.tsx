import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLinks } from "@/components/admin/AdminPageLinks";
import { ClientPageLinks } from "@/components/client/ClientPageLinks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Folder, Download, ExternalLink, Pencil, X, Loader2, History } from "lucide-react";
import { ProfileSkeleton } from "@/components/ui/skeletons";
import { buildApiUrl } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Client-editable fields — deliberately excludes email, which stays admin-only. */
type ProfileEditForm = {
  phoneOwner: string;
  birthday: string;
  tshirtSize: string;
  heardAboutUs: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
};

function toProfileEditForm(onboarding: any): ProfileEditForm {
  return {
    phoneOwner: onboarding?.phoneOwner ?? "",
    birthday: onboarding?.birthday ?? "",
    tshirtSize: onboarding?.tshirtSize ?? "",
    heardAboutUs: onboarding?.heardAboutUs ?? "",
    emergencyContactName: onboarding?.emergencyContactName ?? "",
    emergencyContactPhone: onboarding?.emergencyContactPhone ?? "",
    streetAddress: onboarding?.streetAddress ?? "",
    city: onboarding?.city ?? "",
    state: onboarding?.state ?? "",
    zipCode: onboarding?.zipCode ?? "",
  };
}

interface ProfileEditHistoryEntry {
  id: number;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  actorRole: string | null;
  actorEmail: string | null;
  createdAt: string;
}

interface ClientProfileResponse {
  success: boolean;
  data: any;
}

export default function ClientProfilePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<ProfileEditForm | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const {
    data,
    isLoading,
    error,
  } = useQuery<ClientProfileResponse>({
    queryKey: ["/api/client/profile"],
    queryFn: async () => {
      const response = await fetch(buildApiUrl("/api/client/profile"), {
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          (errorData as any).error || "Failed to load client profile"
        );
      }

      return response.json();
    },
    retry: false,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (form: ProfileEditForm) => {
      const res = await fetch(buildApiUrl("/api/client/profile"), {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || "Failed to update profile");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Profile updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/client/profile"] });
      setIsEditing(false);
      setEditForm(null);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const { data: historyRes, isLoading: historyLoading } = useQuery<{ success: boolean; data: ProfileEditHistoryEntry[] }>({
    queryKey: ["/api/client/profile/edit-history"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/client/profile/edit-history"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch edit history");
      return res.json();
    },
    enabled: showHistory,
  });

  useEffect(() => {
    if (error) {
      console.error("❌ [CLIENT PROFILE] Error fetching profile:", error);
      toast({
        title: "Error loading profile",
        description:
          error instanceof Error ? error.message : "Failed to load profile",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const profile = data?.data;
  const onboarding = profile?.onboarding;
  const bankingInfo = profile?.bankingInfo;
  const signedContracts: any[] = profile?.signedContracts || [];
  const cars: any[] = profile?.cars || [];


  // Debug: Log banking info to console
  useEffect(() => {
    if (bankingInfo) {
      console.log("🏦 [PROFILE PAGE] Banking Info received:", {
        id: bankingInfo.id,
        bankName: bankingInfo.bankName,
        routingNumber: bankingInfo.routingNumber ? '***' : null,
        accountNumber: bankingInfo.accountNumber ? '***' : null,
        taxClassification: bankingInfo.taxClassification,
        ssn: bankingInfo.ssn ? '***' : null,
        ein: bankingInfo.ein ? '***' : null,
        businessName: bankingInfo.businessName,
        isDefault: bankingInfo.isDefault,
      });
    } else {
      console.log("⚠️ [PROFILE PAGE] No banking info in profile data");
    }
  }, [bankingInfo]);

  const formatValue = (value: any): string => {
    if (value === null || value === undefined || value === "") {
      return "Not provided";
    }
    return String(value);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch {
      return "N/A";
    }
  };

  const formatFullDateTime = (dateStr: string | null | undefined): string => {
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

  if (isLoading) {
    return (
      <AdminLayout>
        <ProfileSkeleton />
      </AdminLayout>
    );
  }

  if (!profile) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <Folder className="w-10 h-10 text-gray-600" />
          <p className="text-muted-foreground">
            We could not load your profile. Please try again later.
          </p>
        </div>
      </AdminLayout>
    );
  }

                      const startEditing = () => {
                        setEditForm(toProfileEditForm(onboarding));
                        setIsEditing(true);
                      };
                      const cancelEditing = () => {
                        setIsEditing(false);
                        setEditForm(null);
                      };
                      const setEditField = (field: keyof ProfileEditForm, value: string) => {
                        setEditForm((prev) => (prev ? { ...prev, [field]: value } : prev));
                      };
                      const editableField = (key: keyof ProfileEditForm, displayValue: string, type: string = "text") =>
                        isEditing && editForm ? (
                          <Input
                            type={type}
                            value={editForm[key]}
                            onChange={(e) => setEditField(key, e.target.value)}
                            className="h-8 text-sm mt-1"
                          />
                        ) : (
                          <span className="text-foreground">{displayValue}</span>
                        );

                      return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-4xl font-serif text-primary italic">My Profile</h1>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-primary/30 text-primary"
            onClick={() => setShowHistory(true)}
          >
            <History className="w-4 h-4 mr-2" />
            Edit History
          </Button>
        </div>

        {/* Profile Details */}
        <Card className="bg-background border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-primary text-xl">
              Profile Information
            </CardTitle>
            {onboarding && (
              !isEditing ? (
                <Button type="button" variant="outline" size="sm" className="border-primary/30 text-primary" onClick={startEditing}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-border"
                    onClick={cancelEditing}
                    disabled={updateProfileMutation.isPending}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => editForm && updateProfileMutation.mutate(editForm)}
                    disabled={updateProfileMutation.isPending}
                  >
                    {updateProfileMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save
                  </Button>
                </div>
              )
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {!onboarding ? (
              <div className="text-center py-8 text-muted-foreground">
                No onboarding submission found for this profile
              </div>
            ) : (
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
                        {formatValue(onboarding.firstNameOwner)}{" "}
                        {formatValue(onboarding.lastNameOwner)}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block mb-1">Email:</span>
                      <span className="text-foreground">
                        {formatValue(onboarding.emailOwner)}
                      </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block mb-1">Phone:</span>
                                {editableField("phoneOwner", formatValue(onboarding.phoneOwner))}
                    </div>
                    <div>
                      <span className="text-muted-foreground block mb-1">
                        Date of Birth:
                      </span>
                      {editableField("birthday", formatValue(onboarding.birthday), "date")}
                    </div>
                    <div>
                      <span className="text-muted-foreground block mb-1">
                        T-Shirt Size:
                      </span>
                      {editableField("tshirtSize", formatValue(onboarding.tshirtSize))}
                    </div>
                              <div>
                      <span className="text-muted-foreground block mb-1">
                        Representative:
                      </span>
                      <span className="text-foreground">
                        {formatValue(onboarding.representative)}
                      </span>
                              </div>
                              <div>
                      <span className="text-muted-foreground block mb-1">
                        How Did You Hear About Us:
                      </span>
                      {editableField("heardAboutUs", formatValue(onboarding.heardAboutUs))}
                              </div>
                              <div>
                      <span className="text-muted-foreground block mb-1">
                        Emergency Contact Name:
                      </span>
                      {editableField("emergencyContactName", formatValue(onboarding.emergencyContactName))}
                              </div>
                              <div>
                      <span className="text-muted-foreground block mb-1">
                        Emergency Contact Phone:
                      </span>
                      {editableField("emergencyContactPhone", formatValue(onboarding.emergencyContactPhone))}
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
                      <span className="text-muted-foreground block mb-1">
                        Street Address:
                      </span>
                      {editableField("streetAddress", formatValue(onboarding.streetAddress))}
                              </div>
                              <div>
                                <span className="text-muted-foreground block mb-1">City:</span>
                      {editableField("city", formatValue(onboarding.city))}
                              </div>
                              <div>
                                <span className="text-muted-foreground block mb-1">State:</span>
                      {editableField("state", formatValue(onboarding.state))}
                              </div>
                              <div>
                                <span className="text-muted-foreground block mb-1">Zip Code:</span>
                      {editableField("zipCode", formatValue(onboarding.zipCode))}
                              </div>
                              <div className="md:col-span-2">
                      <span className="text-muted-foreground block mb-1">
                        Full Address:
                      </span>
                                <span className="text-foreground">
                        {formatAddress(
                          onboarding.city,
                          onboarding.state,
                          onboarding.zipCode
                        )}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Banking Information - read-only for client accounts; no Edit Banking / Edit SSN/EIN */}
                            <div className="bg-card p-4 rounded-lg border border-primary/20">
                              <div className="flex justify-between items-center mb-4 pb-2 border-b border-primary/30">
                                <h3 className="text-lg font-semibold text-primary">
                                  Banking Information (ACH)
                                </h3>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                  {/* Bank Name */}
                                  <div>
                                    <span className="text-muted-foreground block mb-1">Bank Name:</span>
                                    <span className="text-foreground">
                                      {formatValue(bankingInfo?.bankName)}
                                    </span>
                                  </div>
                                  {/* Tax Classification */}
                                  <div>
                                    <span className="text-muted-foreground block mb-1">Tax Classification:</span>
                                    <span className="text-foreground">
                                      {formatValue(bankingInfo?.taxClassification)}
                                    </span>
                                  </div>
                                  {/* Routing Number */}
                                  <div>
                                    <span className="text-muted-foreground block mb-1">Routing Number:</span>
                                    <span className="text-foreground font-mono">
                                      {formatValue(bankingInfo?.routingNumber)}
                                    </span>
                                  </div>
                                  {/* Account Number */}
                                  <div>
                                    <span className="text-muted-foreground block mb-1">Account Number:</span>
                                    <span className="text-foreground font-mono">
                                      {formatValue(bankingInfo?.accountNumber)}
                                    </span>
                                  </div>
                                  {/* Business Name */}
                                  <div>
                                    <span className="text-muted-foreground block mb-1">Business Name:</span>
                                    <span className="text-foreground">
                                      {formatValue(bankingInfo?.businessName)}
                                    </span>
                                  </div>
                                  {/* EIN - read-only for client profile */}
                                  <div>
                                    <span className="text-muted-foreground block mb-1">EIN:</span>
                                    <span className="text-foreground font-mono">
                                      {formatValue(bankingInfo?.ein)}
                                    </span>
                                  </div>
                                  {/* SSN - read-only for client profile */}
                                  <div>
                                    <span className="text-muted-foreground block mb-1">SSN:</span>
                                    <span className="text-foreground font-mono">
                                      {formatValue(bankingInfo?.ssn)}
                                    </span>
                                  </div>
                              </div>
                            </div>

                        </>
                      )}
                    </CardContent>
                  </Card>

        {/* Signed Contracts */}
        <Card className="bg-background border-border">
          <CardHeader>
            <CardTitle className="text-primary text-xl">
              Signed Contract
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {signedContracts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Folder className="w-8 h-8 mb-2 text-gray-600" />
                <p>No signed contracts available yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {signedContracts.map((contract: any, index: number) => (
                  <div
                    key={contract.id ?? index}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-primary/20 rounded-lg p-4"
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
                          {formatFullDateTime(
                            contract.contractSignedAt || contract.createdAt
                          )}
                        </span>
                  </div>
                </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className={cn(
                          contract.contractStatus === "signed"
                            ? "border-green-500/50 text-green-700 bg-green-500/10"
                            : contract.contractStatus === "declined"
                            ? "border-red-500/50 text-red-700 bg-red-500/10"
                            : "border-yellow-500/50 text-yellow-700 bg-yellow-500/10"
                        )}
                      >
                        {formatValue(contract.contractStatus || "signed")}
                      </Badge>
                      {contract.signedContractUrl && (
                        <a
                          href={contract.signedContractUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/80 transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          Download
                        </a>
                      )}
              </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Profile Edit History</DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (historyRes?.data?.length ?? 0) === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No edits recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {historyRes!.data.map((entry) => (
                <div key={entry.id} className="border border-border rounded-lg p-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-foreground">{entry.field}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    <span className="line-through">{entry.oldValue || "—"}</span>
                    {" → "}
                    <span className="text-foreground">{entry.newValue || "—"}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    by {entry.actorEmail || "unknown"} ({entry.actorRole || "unknown"})
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ClientPageLinks />
      <AdminPageLinks />
    </AdminLayout>
  );
}


