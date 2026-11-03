import { useState, useRef, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, X, Check } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import { api } from "@/lib/api";
import ContractFormFiller from "@/components/contract/ContractFormFiller";

interface ContractData {
  id: number;
  firstNameOwner: string;
  lastNameOwner: string;
  emailOwner: string;
  phoneOwner?: string;
  contractStatus: string;
  // Vehicle information
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleTrim?: string;
  vehicleYear?: string;
  vinNumber?: string;
  licensePlate?: string;
  exteriorColor?: string;
  interiorColor?: string;
  fuelType?: string;
  // Additional fields
  vehicleMiles?: string;
}

export default function SignContract() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/sign-contract/:token");

  // Extract token from URL
  const token =
    params?.token ||
    (() => {
      const pathParts = window.location.pathname.split("/").filter(Boolean);
      const signContractIndex = pathParts.indexOf("sign-contract");
      if (signContractIndex >= 0 && pathParts[signContractIndex + 1]) {
        return pathParts[signContractIndex + 1];
      }
      return "";
    })();

  const contractTemplateUrl = buildApiUrl(
    "/contracts/GoldenLuxuryAuto_Contract_Template.pdf"
  );
  const { toast } = useToast();
  const [signedComplete, setSignedComplete] = useState(false);
  const signPdfFnRef = useRef<(() => Promise<Blob>) | null>(null);

  // Validate token
  const {
    data: contractData,
    isLoading: isValidating,
    error: validationError,
  } = useQuery<ContractData>({
    queryKey: ["validateContract", token],
    queryFn: async () => {
      if (!token) throw new Error("No token provided");
      const result = await api.get<{ data: ContractData }>(`/api/contract/validate/${token}`, {
        fallbackMessage: "Invalid or expired contract link",
      });
      return result.data;
    },
    enabled: !!token,
    retry: false,
  });

  // Sign contract mutation
  const signMutation = useMutation({
    mutationFn: async (data: { action: "sign" | "decline"; signedPdfBlob?: Blob; signatureType?: "typed" | "drawn" }) => {
      if (data.action === "sign") {
        const signedPdfBlob = data.signedPdfBlob || (signPdfFnRef.current ? await signPdfFnRef.current() : null);
        
        if (signedPdfBlob) {
          // Generate flattened PDF with all annotations
          
          // Send PDF as FormData with signature type
          const formData = new FormData();
          formData.append('pdfFile', signedPdfBlob, 'signed-contract.pdf');
          formData.append('isFlattenedPdf', 'true');
          if (data.signatureType) {
            formData.append('signatureType', data.signatureType);
          }

          const response = await fetch(buildApiUrl(`/api/contract/sign/${token}`), {
            method: "POST",
            body: formData,
            credentials: "include",
          });

          const result = await response.json();
          if (!response.ok || !result.success) {
            throw new Error(result.error || "Failed to sign contract");
          }
          return result;
        } else {
          // If PDF editor not ready, send empty signature (backend will use template)
          const response = await fetch(buildApiUrl(`/api/contract/sign/${token}`), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              signatureData: "",
              isFlattenedPdf: false,
            }),
            credentials: "include",
          });

          const result = await response.json();
          if (!response.ok || !result.success) {
            throw new Error(result.error || "Failed to sign contract");
          }
          return result;
        }
      } else {
        // Decline
        const response = await fetch(buildApiUrl(`/api/contract/decline/${token}`), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || "Failed to decline contract");
      }
      return result;
      }
    },
    onSuccess: (result, data) => {
      if (data.action === "sign") {
        toast({
          title: "Contract signed successfully!",
          description: "Your contract has been saved. Next, sign in to complete the vehicle drop-off form.",
        });
        setSignedComplete(true);
      } else {
        toast({
          title: "Contract declined",
          description: "The contract has been declined.",
        });
      }
      if (data.action !== "sign") setLocation("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSign = () => {
    // Always allow signing - PDF editor will handle empty annotations gracefully
    signMutation.mutate({ action: "sign" });
  };

  const handleFormSubmit = async (signedPdfBlob: Blob, signatureType: "typed" | "drawn") => {
    await signMutation.mutateAsync({ action: "sign", signedPdfBlob, signatureType });
  };

  const handleDecline = () => {
    if (confirm("Are you sure you want to decline this contract? This action cannot be undone.")) {
      signMutation.mutate({ action: "decline" });
    }
  };

  if (signedComplete) return <div className="min-h-screen bg-background px-4 py-16"><div className="mx-auto max-w-xl space-y-5 rounded-xl border border-primary/30 bg-card p-6 text-center"><h1 className="text-2xl font-semibold">Contract signed</h1><p className="text-muted-foreground">Next, sign in to complete the vehicle drop-off form when you bring your vehicle to the GLA lot. If your vehicle is not listed yet, GLA still needs to finish creating its record.</p><Button onClick={()=>setLocation('/admin/forms?section=client-onboarding&item=car-on')}>Continue to vehicle drop-off</Button><p className="text-sm text-muted-foreground">Use the password setup email from your application approval if you have not created your GLA password yet.</p></div></div>;

  // Loading state
  if (isValidating) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-primary text-lg">Validating contract link...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (validationError || !contractData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card border border-primary/30 rounded-lg p-8 text-center">
          <X className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-primary mb-4">
            Link Expired or Invalid
          </h1>
          <p className="text-muted-foreground mb-6">
            {validationError instanceof Error
              ? validationError.message
              : "The contract link you're trying to access is no longer valid."}
          </p>
          <Button
            onClick={() => setLocation("/")}
            className="bg-[#d4af37] text-[#1a1a1a] hover:bg-primary/90 font-semibold"
          >
            Return to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4 md:px-8">
      {/* Container - Centered with max width */}
      <div className="max-w-[1600px] w-full mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <img 
            src="/logo.svg" 
            alt="Golden Luxury Auto" 
            className="h-20 md:h-24 w-auto mx-auto object-contain mb-3 drop-shadow-[0_0_12px_rgba(234,235,128,0.4)]"
          />
          <p className="text-foreground text-lg">
            Contract Agreement - {contractData.firstNameOwner} {contractData.lastNameOwner}
          </p>
        </div>

        {/* Contract Form Filler - New Component */}
        <ContractFormFiller
          pdfUrl={contractTemplateUrl}
          onboardingData={contractData}
          onSubmit={handleFormSubmit}
          onDecline={handleDecline}
        />
      </div>
    </div>
  );
}
