import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, List, Loader2, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import {
  CONTRACTOR_POLICY_TITLE,
  ContractorPolicyDocument,
  formatAgreedAt,
  type ContractorPolicyAgreement,
} from "@/components/staff/ContractorPolicy";

/** The employee's signed GLA Contractor Policy 1099, as it was when they agreed. */
export function ContractorPolicyAgreementCard({ employeeId }: { employeeId: number }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/employees", employeeId, "contractor-policy"],
    queryFn: async () =>
      (await api.get<{ data: { agreed: boolean; agreement: ContractorPolicyAgreement | null } }>(
        `/api/employees/${employeeId}/contractor-policy`,
        { fallbackMessage: "Failed to load the contractor policy agreement" },
      )).data,
  });
  const agreement = data?.agreement ?? null;

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-4 space-y-4 text-sm">
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <List className="h-4 w-4 text-primary" />
          <span className="font-bold uppercase text-[13px] text-primary">{CONTRACTOR_POLICY_TITLE}</span>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <p className="text-destructive">{error instanceof Error ? error.message : "Failed to load"}</p>
        ) : agreement ? (
          <>
            <p className="flex items-center gap-2 font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> Agreed
            </p>
            <ul className="grid grid-cols-[150px,1fr] md:grid-cols-[200px,1fr] gap-x-4 gap-y-1 text-muted-foreground">
              <li className="font-bold text-muted-foreground">Signed As:</li>
              <li>{agreement.signatureName}</li>
              <li className="font-bold text-muted-foreground">Agreed At:</li>
              <li>{formatAgreedAt(agreement.agreedAt)}</li>
              <li className="font-bold text-muted-foreground">Submitted From:</li>
              <li>{agreement.source === "onboarding_form" ? "Employee Onboarding Form" : "Employee Portal"}</li>
              <li className="font-bold text-muted-foreground">IP Address:</li>
              <li>{agreement.ipAddress || "Unspecified"}</li>
            </ul>
            <ContractorPolicyDocument policyText={agreement.policyText} documentUrl={agreement.documentUrl} />
          </>
        ) : (
          <p className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <XCircle className="h-4 w-4" />
            Not agreed yet. The employee will be asked to agree before they can clock in.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
