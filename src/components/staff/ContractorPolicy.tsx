/**
 * GLA - Independent Contractor or W-2 Employee Waiver – shared by the Employee
 * Onboarding Form, the login prompt, the staff/admin Time Sheet (clock-in is
 * refused until the employee signs) and the employee profile.
 *
 * Admins edit the title, text and link in Settings; saving with "everyone
 * signs again" starts a new version. Nothing is required until the waiver is
 * published (`policy.configured`). The backend refuses clock-in with
 * `code: "CONTRACTOR_POLICY_REQUIRED"` while a signature is outstanding.
 * (The API paths keep the name of the 1099 policy the waiver replaced.)
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import SignatureCanvas from "react-signature-canvas";
import { ExternalLink, FileText, Loader2, PenTool, Type } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { getActiveTimezone } from "@/hooks/use-timezone";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Shown until the waiver loads; the live title comes from Settings. */
export const DEFAULT_WAIVER_TITLE = "GLA - Independent Contractor or W-2 Employee Waiver";
export const CONTRACTOR_POLICY_REQUIRED = "CONTRACTOR_POLICY_REQUIRED";

export interface ContractorPolicy {
  title: string;
  policyText: string;
  documentUrl: string;
  version: number;
  configured: boolean;
  updatedAt: string | null;
}

export type SignatureType = "typed" | "drawn";

export interface ContractorPolicyAgreement {
  id: number;
  employeeId: number;
  signatureName: string;
  signatureType: SignatureType;
  signatureImage: string | null;
  agreedAt: string;
  source: "onboarding_form" | "portal";
  policyVersion: number;
  policyTitle: string;
  policyText: string;
  documentUrl: string;
  ipAddress: string | null;
  /** policyText with the signer's name, date and signature in its blanks (filled by the server). */
  signedDocument?: SignedWaiverPart[];
}

export type SignedWaiverPart =
  | { kind: "text"; text: string }
  | { kind: "field"; text: string }
  | { kind: "signature" };

interface MyContractorPolicy {
  hasEmployee: boolean;
  agreed: boolean;
  /** Server-decided: waiver published, not signed, and the session is not an admin. */
  mustSign: boolean;
  agreement: ContractorPolicyAgreement | null;
  policy: ContractorPolicy;
}

/** What the signer entered: full name always, plus a drawing when they chose Draw. */
export interface WaiverSignature {
  name: string;
  type: SignatureType;
  image: string | null;
}

export const EMPTY_SIGNATURE: WaiverSignature = { name: "", type: "typed", image: null };

export function signatureComplete(sig: WaiverSignature): boolean {
  return sig.name.trim() !== "" && (sig.type === "typed" || !!sig.image);
}

/** Request body fields for a signature (onboarding form prefixes them itself). */
export function signaturePayload(sig: WaiverSignature) {
  return {
    signatureName: sig.name.trim(),
    signatureType: sig.type,
    ...(sig.type === "drawn" && sig.image ? { signatureImage: sig.image } : {}),
  };
}

/** True when a clock-in response was refused for a missing signature. */
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

/** Public waiver (the onboarding form is unauthenticated). */
export function useContractorPolicy() {
  return useQuery({
    queryKey: ["/api/contractor-policy"],
    queryFn: async () =>
      (await api.get<{ data: ContractorPolicy }>("/api/contractor-policy", {
        fallbackMessage: "Failed to load the waiver",
      })).data,
    staleTime: 5 * 60 * 1000,
  });
}

/** The signed-in employee's waiver status (honours View as Employee). */
export function useMyContractorPolicy(enabled: boolean) {
  return useQuery({
    queryKey: ["/api/me/contractor-policy"],
    queryFn: async () =>
      (await api.get<{ data: MyContractorPolicy }>("/api/me/contractor-policy", {
        fallbackMessage: "Failed to load your waiver status",
      })).data,
    enabled,
    retry: false,
  });
}

/** The signature as it sits on the waiver's signature line. */
function InlineSignature({ name, image }: { name: string; image: string | null }) {
  return image ? (
    <img
      src={image}
      alt={`Signature of ${name}`}
      className="inline-block h-12 max-w-[220px] rounded bg-white object-contain align-middle"
    />
  ) : (
    <span className="text-xl italic" style={{ fontFamily: "'Dancing Script', cursive" }}>
      {name}
    </span>
  );
}

export function ContractorPolicyDocument({
  title,
  policyText,
  documentUrl,
  signed,
}: {
  title: string;
  policyText: string;
  documentUrl: string;
  /** A signed copy: shows the signer's name, date and signature in the blanks. */
  signed?: { parts: SignedWaiverPart[]; signatureName: string; signatureImage: string | null };
}) {
  return (
    <div className="space-y-2">
      {policyText.trim() ? (
        <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-background p-4 text-sm leading-relaxed text-foreground">
          {signed
            ? signed.parts.map((p, i) =>
                p.kind === "text" ? (
                  <span key={i}>{p.text}</span>
                ) : p.kind === "field" ? (
                  <strong key={i} className="underline underline-offset-2">
                    {p.text}
                  </strong>
                ) : (
                  <InlineSignature key={i} name={signed.signatureName} image={signed.signatureImage} />
                ),
              )
            : policyText}
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
          Read the full {title}
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
    </div>
  );
}

/** Type-or-draw signature, the same choice the client contract offers. */
function SignatureInput({
  value,
  onChange,
  disabled,
}: {
  value: WaiverSignature;
  onChange: (value: WaiverSignature) => void;
  disabled?: boolean;
}) {
  const nameId = useId();
  const padRef = useRef<SignatureCanvas>(null);
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor={nameId} className="text-muted-foreground">
          Full legal name *
        </Label>
        <Input
          id={nameId}
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          disabled={disabled}
          autoComplete="name"
          className="bg-card border-border text-foreground"
        />
      </div>
      <Tabs
        value={value.type}
        onValueChange={(v) => onChange({ ...value, type: v as SignatureType, image: v === "drawn" ? value.image : null })}
      >
        <TabsList className="grid w-full grid-cols-2 bg-muted">
          <TabsTrigger value="typed" disabled={disabled} className="data-[state=active]:bg-primary data-[state=active]:text-black">
            <Type className="w-4 h-4 mr-2" />
            Type Name
          </TabsTrigger>
          <TabsTrigger value="drawn" disabled={disabled} className="data-[state=active]:bg-primary data-[state=active]:text-black">
            <PenTool className="w-4 h-4 mr-2" />
            Draw
          </TabsTrigger>
        </TabsList>
        <TabsContent value="typed" className="mt-3">
          <div className="flex min-h-16 items-center justify-center rounded-md border-2 border-primary/30 bg-white p-3">
            <p className="text-2xl italic text-black" style={{ fontFamily: "'Dancing Script', cursive" }}>
              {value.name.trim() || "Your signature"}
            </p>
          </div>
        </TabsContent>
        <TabsContent value="drawn" className="mt-3">
          <div className="overflow-hidden rounded-md border-2 border-primary/30 bg-white">
            <SignatureCanvas
              ref={padRef}
              penColor="black"
              // A mobile address bar collapsing fires resize; keep the drawing.
              clearOnResize={false}
              onEnd={() => {
                const pad = padRef.current;
                onChange({ ...value, type: "drawn", image: pad && !pad.isEmpty() ? pad.toDataURL("image/png") : null });
              }}
              canvasProps={{ className: "h-32 w-full touch-none bg-white", "aria-label": "Draw your signature" }}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 w-full border-primary/30 text-muted-foreground"
            disabled={disabled}
            onClick={() => {
              padRef.current?.clear();
              onChange({ ...value, image: null });
            }}
          >
            Clear
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface AgreementFieldsProps {
  policy: ContractorPolicy | undefined;
  policyLoading?: boolean;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  signature: WaiverSignature;
  onSignatureChange: (value: WaiverSignature) => void;
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
  const title = policy?.title ?? DEFAULT_WAIVER_TITLE;
  return (
    <div className="space-y-4">
      {policyLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading waiver…
        </div>
      ) : policy ? (
        <ContractorPolicyDocument title={title} policyText={policy.policyText} documentUrl={policy.documentUrl} />
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
            I have read and agree to the {title}.
          </Label>
        </div>
        {checkedError && <p className="text-red-700 text-xs">{checkedError}</p>}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Sign here</p>
        <SignatureInput value={signature} onChange={onSignatureChange} disabled={disabled} />
        {signatureError && <p className="text-red-700 text-xs">{signatureError}</p>}
      </div>
      <p className="text-xs text-muted-foreground">
        A copy of the signed waiver is emailed to you and to Golden Luxury Auto.
      </p>
    </div>
  );
}

/** Message for the first missing piece of a signature, or undefined when complete. */
export function signatureErrorFor(sig: WaiverSignature): string | undefined {
  if (!sig.name.trim()) return "Type your full legal name";
  if (sig.type === "drawn" && !sig.image) return "Draw your signature, or switch to Type Name";
  return undefined;
}

interface ContractorPolicyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Runs after the agreement is saved. */
  onAgreed?: () => void;
  /** Wording for why it opened: at login, or because a clock-in was refused. */
  reason?: "login" | "clock-in";
}

/** Portal signing for employees who did not sign on the onboarding form. */
export function ContractorPolicyDialog({ open, onOpenChange, onAgreed, reason = "clock-in" }: ContractorPolicyDialogProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const policyQuery = useMyContractorPolicy(open);
  const [checked, setChecked] = useState(false);
  const [signature, setSignature] = useState<WaiverSignature>(EMPTY_SIGNATURE);
  const [showErrors, setShowErrors] = useState(false);
  const title = policyQuery.data?.policy.title ?? DEFAULT_WAIVER_TITLE;

  const accept = useMutation({
    mutationFn: () =>
      api.post<{ message?: string }>("/api/me/contractor-policy/accept", {
        agreed: true,
        ...signaturePayload(signature),
      }),
    onSuccess: async (json) => {
      await qc.invalidateQueries({ queryKey: ["/api/me/contractor-policy"] });
      toast({ title: "Waiver signed", description: json.message ?? "A copy has been emailed to you." });
      onOpenChange(false);
      setChecked(false);
      setSignature(EMPTY_SIGNATURE);
      setShowErrors(false);
      onAgreed?.();
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const submit = () => {
    if (!checked || !signatureComplete(signature)) {
      setShowErrors(true);
      return;
    }
    accept.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-primary">{title}</DialogTitle>
          <DialogDescription>
            {reason === "login"
              ? `Please review and sign the ${title}. You need to sign it before you can start the time tracker.`
              : `You need to sign the ${title} before you can clock in.`}
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
          signatureError={showErrors ? signatureErrorFor(signature) : undefined}
          disabled={accept.isPending}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={accept.isPending}>
            {reason === "login" ? "Later" : "Cancel"}
          </Button>
          <Button onClick={submit} disabled={accept.isPending}>
            {accept.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign and submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Banner on the Time Sheet while the signature is outstanding. */
export function ContractorPolicyRequiredNotice({ title, onOpen }: { title: string; onOpen: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm leading-relaxed">
        <strong>Action required:</strong> Please sign the {title} before you clock in.
      </p>
      <Button size="sm" onClick={onOpen} className="min-h-11 sm:min-h-9">
        Review and sign
      </Button>
    </div>
  );
}

/**
 * Clock-in gate for a Time Sheet page. Call `interceptClockIn` first in the
 * clock-in handler and `interceptRefusal` on its response; each returns true
 * when it opened the waiver instead. Render `gate(continueClockIn)` once.
 */
export function useContractorPolicyGate(enabled: boolean) {
  const query = useMyContractorPolicy(enabled);
  // "clock-in": opened by a clock-in attempt, so signing continues it.
  const [mode, setMode] = useState<null | "review" | "clock-in">(null);
  const needsPolicy = query.data?.mustSign === true;
  const title = query.data?.policy.title ?? DEFAULT_WAIVER_TITLE;

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
      {needsPolicy && <ContractorPolicyRequiredNotice title={title} onOpen={() => setMode("review")} />}
      <ContractorPolicyDialog
        open={mode !== null}
        onOpenChange={(o) => !o && setMode(null)}
        onAgreed={mode === "clock-in" ? continueClockIn : undefined}
      />
    </>
  );
  return { needsPolicy, interceptClockIn, interceptRefusal, gate };
}

/**
 * Opens the waiver once per browser session after an employee logs in, so a
 * new employee sees it before they reach the tracker. "Later" closes it; the
 * Time Sheet keeps refusing clock-in until they sign.
 */
export function EmployeeWaiverLoginPrompt({ enabled, userId }: { enabled: boolean; userId: number | string | undefined }) {
  const query = useMyContractorPolicy(enabled);
  const [open, setOpen] = useState(false);
  const mustSign = query.data?.mustSign === true;
  const version = query.data?.policy.version;

  useEffect(() => {
    if (!mustSign) return;
    // Per user and version: a second login in the same tab, or a new version, prompts again.
    const key = `gla.waiverPromptShown:${userId ?? ""}:${version ?? ""}`;
    let shown = false;
    try {
      shown = sessionStorage.getItem(key) === "1";
      sessionStorage.setItem(key, "1");
    } catch {
      // Storage blocked: prompt on each full page load instead.
    }
    if (!shown) setOpen(true);
  }, [mustSign, userId, version]);

  if (!enabled || !mustSign) return null;
  return <ContractorPolicyDialog open={open} onOpenChange={setOpen} reason="login" />;
}
