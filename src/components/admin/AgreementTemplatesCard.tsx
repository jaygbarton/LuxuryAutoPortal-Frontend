import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, ChevronRight, ExternalLink, Link2, Loader2, RotateCcw, Upload } from "lucide-react";
import { api } from "@/lib/api";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AgreementType = "client" | "employee" | "co_host";

interface AgreementVersion {
  id: number;
  type: AgreementType;
  version: number;
  fileName: string;
  sizeBytes: number;
  pageCount: number | null;
  uploadedByName: string | null;
  uploadedAt: string;
  restoredFromVersion: number | null;
}

interface AgreementSummary {
  type: AgreementType;
  label: string;
  allowedExtensions: string[];
  current: AgreementVersion | null;
  usingBundledDefault: boolean;
  history: AgreementVersion[];
}

const QUERY_KEY = ["/api/agreement-templates"];

/** What each agreement is used for, shown under its name. */
const USAGE: Record<AgreementType, string> = {
  client: "New client signing links use this file.",
  employee: "Reference copy. The waiver employees sign is edited in Settings.",
  co_host: "Reference copy for co-host agreements.",
};

const currentUrl = (type: AgreementType) => buildApiUrl(`/api/agreement-templates/${type}/current`);
const versionUrl = (id: number) => buildApiUrl(`/api/agreement-templates/versions/${id}/file`);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });

function versionLine(v: AgreementVersion): string {
  const by = v.uploadedByName ? ` by ${v.uploadedByName}` : "";
  const restored = v.restoredFromVersion ? ` (restored v${v.restoredFromVersion})` : "";
  return `v${v.version} · ${formatDate(v.uploadedAt)}${by}${restored}`;
}

/**
 * Forms → Contract / Agreement: one place to upload and replace the blank
 * client, employee and co-host agreements. Every upload is kept as a version,
 * so a wrong file is undone with Restore.
 */
export function AgreementTemplatesCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [replacing, setReplacing] = useState<AgreementSummary | null>(null);
  const [expanded, setExpanded] = useState<AgreementType | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => api.get<{ data: AgreementSummary[] }>("/api/agreement-templates").then((r) => r.data),
  });

  const restore = useMutation({
    mutationFn: (v: AgreementVersion) => api.post(`/api/agreement-templates/versions/${v.id}/restore`),
    onSuccess: (_r, v) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast({ title: "Restored", description: `${v.fileName} (v${v.version}) is current again.` });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const copyLink = async (type: AgreementType) => {
    try {
      await navigator.clipboard.writeText(currentUrl(type));
      toast({ title: "Link copied", description: "This link always opens the current version." });
    } catch {
      toast({ title: "Copy failed", description: currentUrl(type), variant: "destructive" });
    }
  };

  return (
    <Card className="bg-card border-primary/20">
      <CardHeader>
        <CardTitle className="text-lg text-foreground">GLA Agreements</CardTitle>
        <CardDescription>
          Upload a new file to replace an agreement. Earlier versions are kept and can be restored.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-700">{error instanceof Error ? error.message : "Failed to load agreements."}</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {data?.map((a) => (
              <div key={a.type} className="rounded-md border border-border p-4 flex flex-col gap-3">
                <div>
                  <p className="font-medium text-foreground">{a.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{USAGE[a.type]}</p>
                </div>

                <div className="text-sm min-h-[2.5rem]">
                  {a.current ? (
                    <>
                      <p className="text-foreground truncate" title={a.current.fileName}>{a.current.fileName}</p>
                      <p className="text-xs text-muted-foreground">{versionLine(a.current)}</p>
                    </>
                  ) : a.usingBundledDefault ? (
                    <>
                      <p className="text-foreground">Contract Template V14</p>
                      <Badge variant="outline" className="text-xs mt-1">Built-in default</Badge>
                    </>
                  ) : (
                    <p className="text-muted-foreground">Nothing uploaded yet.</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mt-auto">
                  {(a.current || a.usingBundledDefault) && (
                    <>
                      <Button variant="outline" size="sm" asChild>
                        <a href={currentUrl(a.type)} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4 mr-1" /> View
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => copyLink(a.type)}>
                        <Link2 className="w-4 h-4 mr-1" /> Copy link
                      </Button>
                    </>
                  )}
                  <Button size="sm" onClick={() => setReplacing(a)}>
                    <Upload className="w-4 h-4 mr-1" /> {a.current || a.usingBundledDefault ? "Replace" : "Upload"}
                  </Button>
                </div>

                {a.history.length > 1 && (
                  <div>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setExpanded(expanded === a.type ? null : a.type)}
                    >
                      {expanded === a.type ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      Previous versions ({a.history.length - 1})
                    </button>
                    {expanded === a.type && (
                      <ul className="mt-2 space-y-2">
                        {a.history.slice(1).map((v) => (
                          <li key={v.id} className="flex items-center justify-between gap-2 text-xs">
                            <a
                              href={versionUrl(v.id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="min-w-0 hover:underline"
                              title={v.fileName}
                            >
                              <span className="block truncate text-foreground">{v.fileName}</span>
                              <span className="text-muted-foreground">{versionLine(v)}</span>
                            </a>
                            <ConfirmDialog
                              trigger={
                                <Button variant="ghost" size="sm" className="h-7 px-2 shrink-0" disabled={restore.isPending}>
                                  <RotateCcw className="w-3 h-3 mr-1" /> Restore
                                </Button>
                              }
                              title={`Restore ${a.label}?`}
                              description={`${v.fileName} (v${v.version}) becomes the current ${a.label.toLowerCase()}.${
                                a.type === "client" ? " New client signing links will use it." : ""
                              }`}
                              confirmText="Restore"
                              onConfirm={() => restore.mutate(v)}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {replacing && <ReplaceDialog agreement={replacing} onClose={() => setReplacing(null)} />}
    </Card>
  );
}

function ReplaceDialog({ agreement, onClose }: { agreement: AgreementSummary; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const confirmId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [layoutConfirmed, setLayoutConfirmed] = useState(false);
  const isClient = agreement.type === "client";

  const upload = useMutation({
    mutationFn: (f: File) => {
      const form = new FormData();
      form.append("file", f);
      if (isClient) form.append("layoutConfirmed", String(layoutConfirmed));
      return api.post(`/api/agreement-templates/${agreement.type}`, form, { upload: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast({ title: "Agreement replaced", description: `${file?.name} is now the current ${agreement.label.toLowerCase()}.` });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && !upload.isPending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replace {agreement.label}</DialogTitle>
          <DialogDescription>
            Accepted: {agreement.allowedExtensions.join(", ")} (max 20 MB). The current file is kept as a previous version.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            type="file"
            accept={agreement.allowedExtensions.join(",")}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={upload.isPending}
          />

          {isClient && (
            <div className="rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3 space-y-3">
              <p className="flex gap-2 text-sm text-yellow-800">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  New client signing links use this PDF straight away. Signing writes the owner's details,
                  checkboxes and signature at fixed spots on pages 1–12 of the V14 layout, so the new PDF must keep
                  the same pages with the blanks in the same places. Contracts already signed are not changed.
                </span>
              </p>
              <div className="flex items-start gap-2">
                <Checkbox
                  id={confirmId}
                  checked={layoutConfirmed}
                  onCheckedChange={(v) => setLayoutConfirmed(v === true)}
                />
                <Label htmlFor={confirmId} className="text-sm leading-snug">
                  The new PDF keeps the V14 page layout.
                </Label>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={upload.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => file && upload.mutate(file)}
            disabled={!file || (isClient && !layoutConfirmed) || upload.isPending}
          >
            {upload.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
