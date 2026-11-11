/**
 * Co-Host Statement of Account, opened from the Co-Hosts page: every car the
 * co-host manages, for a year range. (View Car offers the same statement, but
 * only on cars that have a co-host, which is easy to miss.)
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink, Loader2 } from "lucide-react";
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
  const path = coHost ? `/api/admin/co-hosts/${coHost.id}/statement-of-account` : "";

  const { data: years = [], isLoading } = useQuery({
    queryKey: [`${path}/years`],
    queryFn: async () =>
      (await api.get<{ years: number[] }>(`${path}/years`, { fallbackMessage: "Failed to load statement years" })).years,
    enabled: !!coHost,
  });

  const close = () => {
    setFromYear("");
    setToYear("");
    onClose();
  };

  const generate = async (mode: "view" | "download") => {
    if (!coHost) return;
    // Open the tab before the await so the popup blocker treats it as the click's.
    const tab = mode === "view" ? window.open("", "_blank") : null;
    setBusy(mode);
    try {
      const blob = await apiBlob(path, {
        query: { fromYear: fromYear || undefined, toYear: toYear || undefined, disposition: mode === "view" ? "inline" : "attachment" },
        fallbackMessage: "Failed to generate the statement",
      });
      const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      if (tab) {
        tab.location.href = url;
      } else {
        const a = document.createElement("a");
        a.href = url;
        const range = fromYear || toYear ? ` (${fromYear || "start"} - ${toYear || "latest"})` : "";
        a.download = `Co-Host Statement of Account - ${coHost.name}${range}.pdf`;
        a.click();
      }
      // The new tab keeps its own reference; release ours once it has loaded.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      close();
    } catch (e) {
      tab?.close();
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

  return (
    <Dialog open={!!coHost} onOpenChange={(o) => !o && close()}>
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
            {busy === "view" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
            View
          </Button>
          <Button onClick={() => generate("download")} disabled={!!busy}>
            {busy === "download" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
