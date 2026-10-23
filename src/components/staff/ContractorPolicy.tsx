/**
 * GLA Contractor Policy 1099 – shared by the Employee Onboarding Form, the
 * staff/admin Time Sheet (clock-in is blocked until the employee agrees) and
 * the employee profile. The backend refuses clock-in with
 * `code: "CONTRACTOR_POLICY_REQUIRED"` until an agreement is on file.
 */
import { useId, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FileText, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { getActiveTimezone } from "@/hooks/use-timezone";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const CONTRACTOR_POLICY_TITLE = "GLA Contractor Policy 1099";
export const CONTRACTOR_POLICY_REQUIRED = "CONTRACTOR_POLICY_REQUIRED";

export interface ContractorPolicy {
  title: string;
  policyText: string;
  documentUrl: string;
  updatedAt: string | null;
}

export interface ContractorPolicyAgreement {
  id: number;
  employeeId: number;
  signatureName: string;
  agreedAt: string;
  source: "onboarding_form" | "portal";
  policyText: string;
  documentUrl: string;
  ipAddress: string | null;
}

interface MyContractorPolicy {
  hasEmployee: boolean;
  agreed: boolean;
  agreement: ContractorPolicyAgreement | null;
  policy: ContractorPolicy;
}

/** True when a clock-in response was refused for a missing agreement. */
export function isContractorPolicyRequired(json: unknown): boolean {
  return (json as { code?: unknown } | null)?.code === CONTRACTOR_POLICY_REQUIRED;
}

export function formatAgreedAt(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    timeZone: getActiveTimezone(),
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/** Public policy text (the onboarding form is unauthenticated). */
export function useContractorPolicy() {
  return useQuery({
    queryKey: ["/api/contractor-policy"],
    queryFn: async () =>
      (await api.get<{ data: ContractorPolicy }>("/api/contractor-policy", {
        fallbackMessage: "Failed to load the contractor policy",
      })).data,
    staleTime: 5 * 60 * 1000,
  });
}

/** The signed-in employee's agreement status (honours View as Employee). */
export function useMyContractorPolicy(enabled: boolean) {
  return useQuery({
    queryKey: ["/api/me/contractor-policy"],
    queryFn: async () =>
      (await api.get<{ data: MyContractorPolicy }>("/api/me/contractor-policy", {
        fallbackMessage: "Failed to load your contractor policy status",
      })).data,
    enabled,
    retry: false,
  });
}

export function ContractorPolicyDocument({ policyText, documentUrl }: { policyText: string; documentUrl: string }) {
  return (
    <div className="space-y-2">
      {policyText.trim() ? (
        <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-background p-4 text-sm leading-relaxed text-foreground">
          {policyText}
        </div>
      ) : null}
      {documentUrl ? (
        <a
          href={documentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <FileText className="h-4 w-4" />
          Read the full {CONTRACTOR_POLICY_TITLE}
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
    </div>
  );
}

interface AgreementFieldsProps {
  policy: ContractorPolicy | undefined;
  policyLoading?: boolean;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  signature: string;
  onSignatureChange: (value: string) => void;
  checkedError?: string;
  signatureError?: string;
  disabled?: boolean;
}

export function ContractorPolicyAgreementFields({
  policy,
  policyLoading,
  checked,
  onCheckedChange,
  signature,
  onSignatureChange,
  checkedError,
  signatureError,
  disabled,
}: AgreementFieldsProps) {
  const checkboxId = useId();
  const signatureId = useId();
  return (
    <div className="space-y-4">
      {policyLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading policy…
        </div>
      ) : policy ? (
        <ContractorPolicyDocument policyText={policy.policyText} documentUrl={policy.documentUrl} />
      ) : null}
      <div className="space-y-1">
        <div className="flex items-start gap-3">
          <Checkbox
            id={checkboxId}
            checked={checked}
            onCheckedChange={(value) => onCheckedChange(value === true)}
            disabled={disabled}
            className="mt-3 h-5 w-5"
          />
          <Label htmlFor={checkboxId} className="flex min-h-11 flex-1 cursor-pointer items-center py-2 text-sm leading-relaxed">
            I have read and confirm my agreement with the {CONTRACTOR_POLICY_TITLE}.
          </Label>
        </div>
        {checkedError && <p className="text-red-700 text-xs">{checkedError}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor={signatureId} className="text-muted-foreground">
          Type your full name to sign *
        </Label>
        <Input
          id={signatureId}
          value={signature}
          onChange={(e) => onSignatureChange(e.target.value)}
          disabled={disabled}
          autoComplete="name"
          className="bg-card border-border text-foreground"
        />
        {signatureError && <p className="text-red-700 text-xs">{signatureError}</p>}
      </div>
      <p className="text-xs text-muted-foreground">
        A copy of the signed agreement is emailed to you and to Golden Luxury Auto.
      </p>
    </div>
  );
}

interface ContractorPolicyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Runs after the agreement is saved (e.g. to continue the clock-in). */
  onAgreed?: () => void;
}

/** Portal agreement for employees who did not agree on the onboarding form. */
export function ContractorPolicyDialog({ open, onOpenChange, onAgreed }: ContractorPolicyDialogProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const policyQuery = useMyContractorPolicy(open);
  const [checked, setChecked] = useState(false);
  const [signature, setSignature] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  const accept = useMutation({
    mutationFn: () =>
      api.post<{ message?: string }>("/api/me/contractor-policy/accept", {
        agreed: true,
        signatureName: signature.trim(),
      }),
    onSuccess: async (json) => {
      await qc.invalidateQueries({ queryKey: ["/api/me/contractor-policy"] });
      toast({ title: "Agreement submitted", description: json.message ?? "A copy has been emailed to you." });
      onOpenChange(false);
      setChecked(false);
      setSignature("");
      setShowErrors(false);
      onAgreed?.();
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const submit = () => {
    if (!checked || !signature.trim()) {
      setShowErrors(true);
      return;
    }
    accept.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-primary">{CONTRACTOR_POLICY_TITLE}</DialogTitle>
          <DialogDescription>
            You need to agree to the {CONTRACTOR_POLICY_TITLE} before you can log your hours.
          </DialogDescription>
        </DialogHeader>
        <ContractorPolicyAgreementFields
          policy={policyQuery.data?.policy}
          policyLoading={policyQuery.isLoading}
          checked={checked}
          onCheckedChange={setChecked}
          signature={signature}
          onSignatureChange={setSignature}
          checkedError={showErrors && !checked ? "You must confirm your agreement" : undefined}
          signatureError={showErrors && !signature.trim() ? "Required" : undefined}
          disabled={accept.isPending}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={accept.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={accept.isPending}>
            {accept.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Agree and submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Banner on the Time Sheet while the agreement is outstanding. */
export function ContractorPolicyRequiredNotice({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm leading-relaxed">
        <strong>Action required:</strong> Please agree to the {CONTRACTOR_POLICY_TITLE} before you clock in.
      </p>
      <Button size="sm" onClick={onOpen} className="min-h-11 sm:min-h-9">
        Review and agree
      </Button>
    </div>
  );
}

/**
 * Clock-in gate for a Time Sheet page. Call `interceptClockIn` first in the
 * clock-in handler and `interceptRefusal` on its response; each returns true
 * when it opened the agreement instead. Render `gate(continueClockIn)` once.
 */
export function useContractorPolicyGate(enabled: boolean) {
  const query = useMyContractorPolicy(enabled);
  // "clock-in": opened by a clock-in attempt, so agreeing continues it.
  const [mode, setMode] = useState<null | "review" | "clock-in">(null);
  const needsPolicy = query.data?.hasEmployee === true && !query.data.agreed;

  // `policyAgreed` is passed on the continued clock-in, which runs before
  // this render's `needsPolicy` has refreshed.
  const interceptClockIn = (policyAgreed: boolean) => {
    if (!needsPolicy || policyAgreed) return false;
    setMode("clock-in");
    return true;
  };
  const interceptRefusal = (json: unknown) => {
    if (!isContractorPolicyRequired(json)) return false;
    void query.refetch();
    setMode("clock-in");
    return true;
  };
  const gate = (continueClockIn: () => void): ReactNode => (
    <>
      {needsPolicy && <ContractorPolicyRequiredNotice onOpen={() => setMode("review")} />}
      <ContractorPolicyDialog
        open={mode !== null}
        onOpenChange={(o) => !o && setMode(null)}
        onAgreed={mode === "clock-in" ? continueClockIn : undefined}
      />
    </>
  );
  return { needsPolicy, interceptClockIn, interceptRefusal, gate };
}
