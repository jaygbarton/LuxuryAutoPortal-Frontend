import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { Loader2, ImageIcon, Upload, Trash2, X } from "lucide-react";
import { useState, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL  = ["January","February","March","April","May","June","July","August","September","October","November","December"];

interface TuroEarningRow {
  id: number;
  car_id: number;
  year: number;
  month: number;
  image_url: string;
  filename: string;
}

interface Props {
  carId: number;
  year: string;
}

export function TuroEarningsPanel({ carId, year }: Props) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview]         = useState<TuroEarningRow | null>(null);
  const [uploadMonth, setUploadMonth] = useState<string>("");
  const [uploading, setUploading]     = useState(false);
  const [uploadErr, setUploadErr]     = useState<string | null>(null);

  const queryKey = ["/api/client-turo-earnings", carId, year];

  const { data, isLoading } = useQuery<{ success?: boolean; list?: TuroEarningRow[] }>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl(`/api/client-turo-earnings?carId=${carId}&year=${year}`),
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to load Turo earnings");
      return res.json();
    },
    enabled: !!carId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(buildApiUrl(`/api/client-turo-earnings/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const rows = [...(data?.list ?? [])].sort((a, b) => a.month - b.month);

  const resolveSrc = (u: string) => (u.startsWith("http") ? u : buildApiUrl(u));

  // Months already uploaded for this year
  const uploadedMonths = new Set(rows.map(r => r.month));

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !uploadMonth) return;
    e.target.value = "";
    setUploading(true);
    setUploadErr(null);
    try {
      // 1. Upload file to GCS
      const fd = new FormData();
      fd.append("file", file);
      const upRes = await fetch(buildApiUrl("/api/client-turo-earnings/upload"), {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const upData = await upRes.json();
      if (!upData.success) throw new Error(upData.error || "Upload failed");

      // 2. Create DB record
      const createRes = await fetch(buildApiUrl("/api/client-turo-earnings"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          car_id: carId,
          year: parseInt(year),
          month: parseInt(uploadMonth),
          image_url: upData.gcsUrl,
          filename: upData.filename,
        }),
      });
      const createData = await createRes.json();
      if (!createData.success) throw new Error(createData.error || "Save failed");

      qc.invalidateQueries({ queryKey });
      setUploadMonth("");
    } catch (err: any) {
      setUploadErr(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function triggerUpload() {
    if (!uploadMonth) { setUploadErr("Select a month first"); return; }
    setUploadErr(null);
    fileRef.current?.click();
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6 mb-6">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-primary">Turo Earnings Screenshots — {year}</h3>
        </div>

        {/* Upload controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {uploadErr && (
            <span className="text-xs text-destructive flex items-center gap-1">
              <X className="w-3 h-3" />{uploadErr}
            </span>
          )}
          <Select value={uploadMonth} onValueChange={setUploadMonth}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS_FULL.map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)} disabled={uploadedMonths.has(i + 1)}>
                  {m}{uploadedMonths.has(i + 1) ? " ✓" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={triggerUpload} disabled={uploading}>
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading ? "Uploading…" : "Upload Screenshot"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No Turo earnings screenshots for {year}. Use the upload button above to add one.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {rows.map((row) => (
            <div key={row.id} className="group relative flex flex-col gap-1.5 rounded-lg border border-border overflow-hidden bg-muted/30 hover:shadow-md transition-shadow">
              <button
                type="button"
                onClick={() => setPreview(row)}
                className="flex flex-col gap-1.5 text-left w-full"
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
                  <img
                    src={resolveSrc(row.image_url)}
                    alt={`Turo earnings ${MONTHS_SHORT[row.month - 1]} ${row.year}`}
                    loading="lazy"
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
                <span className="text-xs font-medium text-center pb-1.5 w-full">
                  {MONTHS_SHORT[row.month - 1]} {row.year}
                </span>
              </button>
              {/* Delete button */}
              <button
                type="button"
                onClick={() => { if (confirm(`Delete ${MONTHS_SHORT[row.month - 1]} ${row.year} screenshot?`)) deleteMutation.mutate(row.id); }}
                className="absolute top-1.5 right-1.5 hidden group-hover:flex items-center justify-center w-6 h-6 rounded-full bg-destructive/90 text-destructive-foreground hover:bg-destructive transition-colors"
                title="Delete screenshot"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          {preview && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">
                  Turo Earnings — {MONTHS_SHORT[preview.month - 1]} {preview.year}
                </h4>
                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-1.5"
                  onClick={() => { if (confirm("Delete this screenshot?")) { deleteMutation.mutate(preview.id); setPreview(null); } }}
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </Button>
              </div>
              <img
                src={resolveSrc(preview.image_url)}
                alt={`Turo earnings ${MONTHS_SHORT[preview.month - 1]} ${preview.year}`}
                className="w-full h-auto rounded-md"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
