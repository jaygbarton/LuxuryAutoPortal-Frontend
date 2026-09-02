/**
 * Loads a receipt (image or PDF) through our authenticated APIs and renders
 * it inside the app. Drive/GCS files are never handed to a bare <img> or
 * opened only as an external tab — those paths 403 or fail to decode when
 * the file is a PDF, which is how form-submission receipts are often stored.
 */

import React, { useEffect, useState } from "react";
import { FileText, Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { buildApiUrl, getProxiedImageUrl } from "@/lib/queryClient";

function resolveReceiptUrl(src: string): string {
  if (!src) return src;
  if (src.startsWith("data:") || src.startsWith("blob:")) return src;
  if (
    src.startsWith("https://storage.googleapis.com/") ||
    src.startsWith("http://storage.googleapis.com/")
  ) {
    return getProxiedImageUrl(src);
  }
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  return buildApiUrl(src);
}

function isOurReceiptApi(url: string): boolean {
  return (
    url.startsWith("/") ||
    url.includes("/api/income-expense/receipt-image") ||
    url.includes("/api/expense-form-submissions/receipt/file") ||
    url.includes("/api/gcs-image-proxy")
  );
}

function needsCredentials(url: string): boolean {
  // gcs-image-proxy is public and sends Access-Control-Allow-Origin: *,
  // which browsers reject when credentials: "include" is set.
  if (url.includes("/api/gcs-image-proxy")) return false;
  return (
    url.startsWith("/") ||
    url.includes("/api/income-expense/receipt-image") ||
    url.includes("/api/expense-form-submissions/receipt/file")
  );
}

async function blobIsPdf(blob: Blob): Promise<boolean> {
  if ((blob.type || "").toLowerCase().includes("pdf")) return true;
  try {
    const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
    // %PDF
    return head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46;
  } catch {
    return false;
  }
}

function filenameLooksPdf(name?: string, src?: string): boolean {
  const hay = `${name || ""} ${src || ""}`.toLowerCase();
  return hay.includes(".pdf") || hay.startsWith("data:application/pdf");
}

export default function InAppReceipt({
  src,
  filename,
  alt,
  className,
  compact = false,
  expandable = true,
  onClick,
}: {
  src: string;
  filename?: string;
  alt?: string;
  className?: string;
  /** Square/thumbnail layout (PDF shows as a tile instead of an iframe). */
  compact?: boolean;
  /** Click opens a full-size viewer inside the app. */
  expandable?: boolean;
  onClick?: () => void;
}) {
  const resolved = resolveReceiptUrl(src);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(filenameLooksPdf(filename, src));
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let revoked = false;
    let objectUrl: string | null = null;
    setBlobUrl(null);
    setFailed(false);
    setLoading(true);
    setIsPdf(filenameLooksPdf(filename, src));

    // Inline data URLs don't need a round-trip.
    if (src.startsWith("data:")) {
      setIsPdf(src.startsWith("data:application/pdf"));
      setBlobUrl(src);
      setLoading(false);
      return;
    }

    const needsFetch = isOurReceiptApi(resolved) || filenameLooksPdf(filename, src);
    if (!needsFetch && (resolved.startsWith("http://") || resolved.startsWith("https://"))) {
      // Public/signed image URL — let <img> load it directly.
      setLoading(false);
      return;
    }

    fetch(resolved, { credentials: needsCredentials(resolved) ? "include" : "omit" })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load (${res.status})`);
        return res.blob();
      })
      .then(async (blob) => {
        if (revoked) return;
        const pdf = await blobIsPdf(blob);
        if (revoked) return;
        objectUrl = URL.createObjectURL(blob);
        setIsPdf(pdf);
        setBlobUrl(objectUrl);
        setLoading(false);
      })
      .catch(() => {
        if (!revoked) {
          setFailed(true);
          setLoading(false);
        }
      });

    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [resolved, src, filename]);

  const label = alt || filename || "Receipt";

  const handleActivate = (e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    if (onClick) onClick();
    else if (expandable) setOpen(true);
  };

  const media = (() => {
    if (loading) {
      return (
        <div className="w-full h-full min-h-[80px] flex items-center justify-center bg-muted text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      );
    }
    if (failed) {
      return (
        <div className="w-full h-full min-h-[80px] flex items-center justify-center bg-red-500/20 text-red-700 text-xs p-2 text-center">
          Couldn’t load receipt
        </div>
      );
    }
    if (isPdf) {
      if (compact) {
        return (
          <div className="w-full h-full min-h-[80px] flex flex-col items-center justify-center gap-1 bg-background text-muted-foreground p-2 text-center">
            <FileText className="w-6 h-6" />
            <span className="text-[10px] leading-tight break-all line-clamp-2">{label}</span>
            <span className="text-[10px] font-medium text-primary">View PDF</span>
          </div>
        );
      }
      const pdfSrc = blobUrl || resolved;
      return (
        <iframe
          src={pdfSrc}
          title={label}
          className={className ?? "w-full min-h-[320px] h-[64vh] rounded border border-border bg-background"}
        />
      );
    }

    const imgSrc = blobUrl || resolved;
    if (!imgSrc) {
      return (
        <div className="w-full h-full min-h-[80px] flex items-center justify-center bg-muted text-muted-foreground text-xs">
          Loading…
        </div>
      );
    }
    return (
      <img
        src={imgSrc}
        alt={label}
        className={className ?? "max-h-64 w-auto object-contain bg-background"}
        onError={() => setFailed(true)}
      />
    );
  })();

  const clickable = expandable || !!onClick;

  return (
    <>
      <div
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        onClick={clickable ? (e) => handleActivate(e) : undefined}
        onKeyDown={
          clickable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleActivate(e);
                }
              }
            : undefined
        }
        className={clickable ? "cursor-pointer w-full h-full" : "w-full h-full"}
        title={clickable ? `View ${label}` : undefined}
      >
        {media}
      </div>

      {expandable && !onClick && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="bg-card border-border max-w-4xl max-h-[90vh] p-0 overflow-hidden">
            <DialogHeader className="sr-only">
              <DialogTitle>{label}</DialogTitle>
              <DialogDescription>Receipt preview</DialogDescription>
            </DialogHeader>
            <div className="relative bg-background">
              {isPdf ? (
                <iframe
                  src={blobUrl || resolved}
                  title={label}
                  className="w-full h-[80vh] border-0 bg-background"
                />
              ) : (
                <img
                  src={blobUrl || resolved}
                  alt={label}
                  className="w-full h-auto max-h-[85vh] object-contain"
                />
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                className="absolute top-2 right-2 h-8 w-8 p-0 bg-background/70 hover:bg-background/90 text-foreground z-10"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
