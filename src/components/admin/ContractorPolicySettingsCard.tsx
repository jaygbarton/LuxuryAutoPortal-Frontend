import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, Save } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_WAIVER_TITLE, useContractorPolicy } from "@/components/staff/ContractorPolicy";

interface Draft {
  title: string;
  policyText: string;
  documentUrl: string;
  requireResign: boolean;
}

/**
 * Admin → Settings: the waiver employees sign before they can clock in.
 * Admins replace it themselves: edit the title, paste the new text or link,
 * and tick "everyone signs again" to start a new version.
 */
export function ContractorPolicySettingsCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const resignId = useId();
  const { data: policy, isLoading } = useContractorPolicy();
  const [draft, setDraft] = useState<Draft | null>(null);
  const current: Draft = draft ?? {
    title: policy?.title ?? DEFAULT_WAIVER_TITLE,
    policyText: policy?.policyText ?? "",
    documentUrl: policy?.documentUrl ?? "",
    requireResign: false,
  };
  const edit = (patch: Partial<Draft>) => setDraft({ ...current, ...patch });
  const heading = policy?.title ?? DEFAULT_WAIVER_TITLE;

  const save = useMutation({
    mutationFn: (body: Draft) => api.put("/api/settings/contractor-policy", body),
    onSuccess: (_res, body) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contractor-policy"] });
      queryClient.invalidateQueries({ queryKey: ["/api/me/contractor-policy"] });
      setDraft(null);
      toast({
        title: "Saved",
        description: body.requireResign
          ? `${body.title || DEFAULT_WAIVER_TITLE} updated. Every employee will be asked to sign it again.`
          : `${body.title || DEFAULT_WAIVER_TITLE} updated.`,
      });
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
          {heading}
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Employees sign this on the Employee Onboarding Form, or when they log in, and cannot clock in until they
          have. Nothing is required until you add the text or a document link. Each employee&apos;s signed copy keeps
          the waiver as it was when they signed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        ) : (
          <>
            {policy && !policy.configured && draft === null && (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                Not published yet. Paste the waiver text or add a document link, then save. Employees will then be
                asked to sign it.
              </p>
            )}
            <div className="space-y-1">
              <Label className="text-muted-foreground">Title</Label>
              <Input
                value={current.title}
                onChange={(e) => edit({ title: e.target.value })}
                placeholder={DEFAULT_WAIVER_TITLE}
                className="bg-background border-border text-foreground"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">Waiver text</Label>
              <Textarea
                value={current.policyText}
                onChange={(e) => edit({ policyText: e.target.value })}
                placeholder="Paste the full waiver here"
                className="min-h-[240px] bg-background border-border text-foreground"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground">Document link</Label>
              <Input
                value={current.documentUrl}
                onChange={(e) => edit({ documentUrl: e.target.value })}
                placeholder="https://docs.google.com/document/d/…"
                className="bg-background border-border text-foreground"
              />
              <p className="text-xs text-muted-foreground">
                Employees open this link from the waiver, so it must be viewable by anyone with the link.
              </p>
            </div>
            {draft !== null && (
              <>
                {policy?.configured && (
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={resignId}
                      checked={current.requireResign}
                      onCheckedChange={(v) => edit({ requireResign: v === true })}
                      className="mt-0.5"
                    />
                    <Label htmlFor={resignId} className="cursor-pointer text-sm leading-relaxed">
                      This is a new version: every employee must sign it again. Leave unticked for typo fixes.
                    </Label>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={() =>
                      save.mutate({ ...current, title: current.title.trim(), documentUrl: current.documentUrl.trim() })
                    }
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
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
