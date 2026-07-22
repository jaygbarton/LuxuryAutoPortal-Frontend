import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Upload, X } from "lucide-react";
import { buildUploadApiUrl, getProxiedImageUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ReceiptUploadProps {
  receipts: string[];
  onReceiptsChange: (receipts: string[]) => void;
  entityId?: number;
  disabled?: boolean;
  compact?: boolean;
}

const ACCEPT_TYPES = /\.(jpe?g|png|webp|heic|heif|gif|pdf)$/i;

function isAcceptedFile(file: File): boolean {
  if (/^image\/(jpeg|jpg|png|webp|heic|heif|gif)$/i.test(file.type)) return true;
  if (file.type === "application/pdf") return true;
  return ACCEPT_TYPES.test(file.name);
}

function fileNameFromUrl(url: string): string {
  try {
    const clean = url.split("?")[0];
    return decodeURIComponent(clean.substring(clean.lastIndexOf("/") + 1));
  } catch {
    return url;
  }
}

function isPdfUrl(url: string): boolean {
  return /\.pdf($|\?)/i.test(url);
}

export function ReceiptUpload({ receipts, onReceiptsChange, entityId, disabled, compact }: ReceiptUploadProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files).filter(isAcceptedFile);
      if (fileArray.length === 0) return;
      if (!entityId) {
        toast({ title: "Error", description: "Save the record first before uploading receipts.", variant: "destructive" });
        return;
      }

      setUploading(true);
      try {
        const formData = new FormData();
        fileArray.forEach((file) => formData.append("receipts", file));

        const response = await fetch(buildUploadApiUrl(`/api/admin/car-repaired/${entityId}/receipts`), {
          method: "POST",
          credentials: "include",
          body: formData,
        });

        if (!response.ok) {
          let errMsg = "Upload failed";
          try {
            const b = await response.json();
            if (b?.message) errMsg = b.message;
          } catch {}
          throw new Error(errMsg);
        }
        const data = await response.json();
        if (data.data?.receipts) onReceiptsChange(data.data.receipts);
      } catch (err: any) {
        console.error("Receipt upload failed:", err);
        toast({ title: "Upload failed", description: err?.message || "Could not upload receipt. Please try again.", variant: "destructive" });
      } finally {
        setUploading(false);
      }
    },
    [onReceiptsChange, entityId, toast]
  );

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processFiles(files);
    e.target.value = "";
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounter.current = 0;
      const files = e.dataTransfer.files;
      if (files && files.length > 0) await processFiles(files);
    },
    [processFiles]
  );

  const removeReceipt = (index: number) => {
    onReceiptsChange(receipts.filter((_, i) => i !== index));
  };

  if (compact) {
    if (receipts.length === 0) return <span className="text-muted-foreground">--</span>;
    return (
      <div className="flex flex-col gap-1">
        {receipts.map((url, i) => (
          <a
            key={i}
            href={isPdfUrl(url) ? url : getProxiedImageUrl(url)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <FileText className="w-3 h-3 shrink-0" />
            <span className="truncate max-w-[140px]">{fileNameFromUrl(url) || `Receipt ${i + 1}`}</span>
          </a>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div
        onDragEnter={!disabled ? handleDragEnter : undefined}
        onDragLeave={!disabled ? handleDragLeave : undefined}
        onDragOver={!disabled ? handleDragOver : undefined}
        onDrop={!disabled ? handleDrop : undefined}
        className={`flex flex-col gap-2 p-2 rounded-lg border-2 border-dashed transition-colors min-h-[60px] ${
          isDragging
            ? "border-primary bg-primary/10"
            : disabled
            ? "border-transparent"
            : "border-border hover:border-muted-foreground/40"
        }`}
      >
        {receipts.map((url, index) => (
          <div
            key={index}
            className="flex items-center justify-between rounded border border-border bg-muted/30 px-2 py-1.5"
          >
            <a
              href={isPdfUrl(url) ? url : getProxiedImageUrl(url)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 min-w-0 text-sm text-primary hover:underline"
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span className="truncate">{fileNameFromUrl(url) || `Receipt ${index + 1}`}</span>
            </a>
            {!disabled && (
              <button
                onClick={() => removeReceipt(index)}
                className="text-muted-foreground hover:text-red-500 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
        {!disabled && (
          <label className="flex items-center justify-center gap-2 rounded border border-dashed border-border px-3 py-2 cursor-pointer hover:border-primary transition-colors text-xs text-muted-foreground">
            {uploading ? (
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload receipts
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.gif,.pdf,image/*,application/pdf"
              onChange={handleUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
        )}
        {!disabled && receipts.length === 0 && !isDragging && (
          <p className="text-[10px] text-muted-foreground text-center">Drag & drop receipts here</p>
        )}
        {isDragging && <p className="text-xs text-primary font-medium text-center">Drop receipts here</p>}
      </div>
    </div>
  );
}
