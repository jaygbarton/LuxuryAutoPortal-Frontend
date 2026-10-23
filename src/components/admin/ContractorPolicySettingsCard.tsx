import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, Save } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CONTRACTOR_POLICY_TITLE, useContractorPolicy } from "@/components/staff/ContractorPolicy";

/** Admin → Settings: the policy text employees agree to before clocking in. */
export function ContractorPolicySettingsCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: policy, isLoading } = useContractorPolicy();
  const [draft, setDraft] = useState<{ policyText: string; documentUrl: string } | null>(null);
  const policyText = draft?.policyText ?? policy?.policyText ?? "";
  const documentUrl = draft?.documentUrl ?? policy?.documentUrl ?? "";

  const save = useMutation({
    mutationFn: (body: { policyText: string; documentUrl: string }) =>
      api.put("/api/settings/contractor-policy", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contractor-policy"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me/contractor-policy"] });
      setDraft(null);
      toast({ title: "Saved", description: `${CONTRACTOR_POLICY_TITLE} updated.` });
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  return (
    <Card className="bg-card border-primary/20">
      <CardHeader>
        <CardTitle className="text-primary flex items-center gap-2">
          <FileText className="w-5 h-5" />
          {CONTRACTOR_POLICY_TITLE}
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Shown on the Employee Onboarding Form and to employees who must agree before they can clock in. Each
          employee&apos;s signed copy keeps the text as it was when they agreed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        ) : (
          <>
            <div className="space-y-1">
              <Label className="text-muted-foreground">Policy text</Label>
              <Textarea
                value={policyText}
                onChange={(e) => setDraft({ policyText: e.target.value, documentUrl })}
                placeholder={`Paste the full ${CONTRACTOR_POLICY_TITLE} here`}
                className="min-h-[240px] bg-background border-border text-foreground"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">Document link</Label>
              <Input
                value={documentUrl}
                onChange={(e) => setDraft({ policyText, documentUrl: e.target.value })}
                placeholder="https://docs.google.com/document/d/…"
                className="bg-background border-border text-foreground"
              />
              <p className="text-xs text-muted-foreground">
                Employees open this link from the agreement, so it must be viewable by anyone with the link.
              </p>
            </div>
            {draft !== null && (
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={() => save.mutate({ policyText, documentUrl: documentUrl.trim() })}
                  disabled={save.isPending}
                  className="bg-primary text-primary-foreground hover:bg-primary/80"
                  size="sm"
                >
                  {save.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Changes
                </Button>
                <Button
                  onClick={() => setDraft(null)}
                  variant="outline"
                  size="sm"
                  className="border-border text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
