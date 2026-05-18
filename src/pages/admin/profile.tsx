import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLinks } from "@/components/admin/AdminPageLinks";
import { ClientPageLinks } from "@/components/client/ClientPageLinks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Folder, Download, ExternalLink } from "lucide-react";
import { ProfileSkeleton } from "@/components/ui/skeletons";
import { buildApiUrl } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface ClientProfileResponse {
  success: boolean;
  data: any;
}

export default function ClientProfilePage() {
  const { toast } = useToast();

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
        month: "short",
        day: "numeric",
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

                      return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <h1 className="text-4xl font-serif text-primary italic">My Profile</h1>

        {/* Profile Details */}
        <Card className="bg-background border-border">
          <CardHeader>
            <CardTitle className="text-primary text-xl">
              Profile Information
            </CardTitle>
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
                      <span className="text-foreground">
                        {formatValue(onboarding.phoneOwner)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block mb-1">
                        Date of Birth:
                      </span>
                      <span className="text-foreground">
                        {formatValue(onboarding.birthday)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block mb-1">
                        T-Shirt Size:
                      </span>
                      <span className="text-foreground">
                        {formatValue(onboarding.tshirtSize)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block mb-1">SSN:</span>
                      <span className="text-foreground font-mono">
                        {formatValue(onboarding.ssn)}
                      </span>
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
                      <span className="text-foreground">
                        {formatValue(onboarding.heardAboutUs)}
                      </span>
                              </div>
                              <div>
                      <span className="text-muted-foreground block mb-1">
                        Emergency Contact Name:
                      </span>
                      <span className="text-foreground">
                        {formatValue(onboarding.emergencyContactName)}
                      </span>
                              </div>
                              <div>
                      <span className="text-muted-foreground block mb-1">
                        Emergency Contact Phone:
                      </span>
                      <span className="text-foreground">
                        {formatValue(onboarding.emergencyContactPhone)}
                      </span>
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
                      <span className="text-foreground">
                        {formatValue(onboarding.streetAddress)}
                      </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block mb-1">City:</span>
                      <span className="text-foreground">
                        {formatValue(onboarding.city)}
                      </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block mb-1">State:</span>
                      <span className="text-foreground">
                        {formatValue(onboarding.state)}
                      </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block mb-1">Zip Code:</span>
                      <span className="text-foreground">
                        {formatValue(onboarding.zipCode)}
                      </span>
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

      <ClientPageLinks />
      <AdminPageLinks />
    </AdminLayout>
  );
}


