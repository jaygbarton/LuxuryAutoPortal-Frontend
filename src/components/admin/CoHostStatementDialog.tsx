/**
 * Co-Host Statement of Account, opened from the Co-Hosts page: every car the
 * co-host manages, for a year range. (View Car offers the same statement, but
 * only on cars that have a co-host, which is easy to miss.)
 */
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Eye, Loader2 } from "lucide-react";
import { api, apiBlob } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchableNativeSelect, SearchableOption } from "@/components/ui/searchable-native-select";
import { optionKeywords } from "@/lib/select-search";

export function CoHostStatementDialog({
  coHost,
  onClose,
}: {
  coHost: { id: number; name: string } | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [fromYear, setFromYear] = useState("");
  const [toYear, setToYear] = useState("");
  const [busy, setBusy] = useState<"view" | "download" | null>(null);
  // View shows the PDF in an in-app preview (as View Car does) instead of a
  // blank popup tab: the statement takes a while to build, and the popup sat
  // empty long enough that it was closed before the PDF ever arrived.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  previewUrlRef.current = previewUrl;
  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);
  const closePreview = () => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };
  const path = coHost ? `/api/admin/co-hosts/${coHost.id}/statement-of-account` : "";

  const { data: years = [], isLoading } = useQuery({
    queryKey: [`${path}/years`],
    queryFn: async () =>
      (await api.get<{ years: number[] }>(`${path}/years`, { fallbackMessage: "Failed to load statement years" })).years,
    enabled: !!coHost,
    retry: false,
  });

  const close = () => {
    closePreview();
    setFromYear("");
    setToYear("");
    onClose();
  };

  const saveAs = (url: string) => {
    if (!coHost) return;
    const a = document.createElement("a");
    a.href = url;
    const range = fromYear || toYear ? ` (${fromYear || "start"} - ${toYear || "latest"})` : "";
    a.download = `Co-Host Statement of Account - ${coHost.name}${range}.pdf`;
    a.click();
  };

  const generate = async (mode: "view" | "download") => {
    if (!coHost) return;
    setBusy(mode);
    try {
      const blob = await apiBlob(path, {
        query: { fromYear: fromYear || undefined, toYear: toYear || undefined, disposition: mode === "view" ? "inline" : "attachment" },
        fallbackMessage: "Failed to generate the statement",
      });
      const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      if (mode === "view") {
        closePreview();
        setPreviewUrl(url);
        return;
      }
      saveAs(url);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      close();
    } catch (e) {
      toast({
        title: mode === "view" ? "Preview failed" : "Download failed",
        description: e instanceof Error ? e.message : "Could not generate the statement of account.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const yearSelect = (label: string, value: string, onChange: (v: string) => void, blank: string) => (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <SearchableNativeSelect
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      >
        <SearchableOption value="">{blank}</SearchableOption>
        {years.map((y) => (
          <SearchableOption searchKeywords={optionKeywords(y)} key={y} value={String(y)}>
            {y}
          </SearchableOption>
        ))}
      </SearchableNativeSelect>
    </div>
  );

  const rangeLabel = fromYear || toYear ? ` — ${fromYear || "start"} to ${toYear || "latest"}` : "";

  return (
    <>
    <Dialog open={!!coHost && !previewUrl} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Co-Host Statement of Account</DialogTitle>
          <DialogDescription>
            {coHost?.name}: income, expenses and payouts for every car they co-host. Leave both years blank for all years.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          {yearSelect("From year", fromYear, setFromYear, "Earliest")}
          {yearSelect("To year", toYear, setToYear, "Latest")}
        </div>
        <p className="text-xs text-muted-foreground">
          {isLoading
            ? "Loading…"
            : years.length > 0
              ? `Recorded activity: ${years[0]}${years.length > 1 ? ` - ${years[years.length - 1]}` : ""}`
              : "No co-hosted activity recorded yet. Assign cars to this co-host first."}
        </p>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => generate("view")} disabled={!!busy}>
            {busy === "view" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
            View
          </Button>
          <Button onClick={() => generate("download")} disabled={!!busy}>
            {busy === "download" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={!!coHost && !!previewUrl} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-[96vw] w-[96vw] h-[94vh] max-h-[94vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 py-3 border-b border-border shrink-0">
          <DialogTitle className="text-base">
            Co-Host Statement of Account — {coHost?.name}
            {rangeLabel}
          </DialogTitle>
          <DialogDescription className="sr-only">Preview of the generated Co-Host Statement of Account PDF.</DialogDescription>
        </DialogHeader>
        {previewUrl && (
          <iframe src={previewUrl} title="Co-Host Statement of Account" className="flex-1 w-full border-0 bg-muted" />
        )}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border shrink-0">
          <Button variant="outline" onClick={closePreview} disabled={!!busy}>
            Change period
          </Button>
          {/* The preview already holds the PDF; save it rather than rebuilding it. */}
          <Button onClick={() => previewUrl && saveAs(previewUrl)}>
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
