import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X, ChevronLeft, ChevronRight, Maximize2, Loader2, Copy, ExternalLink } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Payment {
  payments_aid: number;
  payments_year_month: string;
  payments_attachment: string | null;
  /** Used to look up matching Income & Expense receipts for the same month/car. */
  payments_car_id?: number;
}

interface PaymentReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: Payment | null;
}

const formatYearMonth = (yearMonth: string): string => {
  try {
    const [year, month] = yearMonth.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
  } catch {
    return yearMonth;
  }
};

interface FileUrlData {
  fileId: string;
  name?: string;
  mimeType?: string;
  webViewLink?: string;
  webContentLink?: string;
  previewUrl?: string; // Google Drive preview URL for embedding
  error?: string; // Error message if file failed to load
  /** Where this file came from — used to render a small badge in the preview. */
  source?: "payment-attachment" | "ie-cell" | "form-submission";
  /** Optional human-readable context (I&E category/field). */
  contextLabel?: string;
  /** For form-submission files we may have a direct URL already. */
  url?: string;
}

export function PaymentReceiptModal({
  isOpen,
  onClose,
  payment,
}: PaymentReceiptModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fileUrls, setFileUrls] = useState<FileUrlData[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const { toast } = useToast();
  
  useEffect(() => {
    // Reset state when modal closes or payment changes
    if (!isOpen || !payment) {
      setFileUrls([]);
      setCurrentIndex(0);
      setIsLoadingFiles(false);
      return;
    }

    // Set loading state immediately
    setIsLoadingFiles(true);
    setFileUrls([]);

    // Load both sources in parallel:
    //   (A) files attached directly to the payment row (existing behaviour)
    //   (B) I&E receipts for the same car/month — cell-level images AND
    //       approved expense-form-submission receipts (new).
    const loadAll = async () => {
      const [paymentFiles, ieFiles] = await Promise.all([
        loadPaymentAttachmentFiles(),
        loadIncomeExpenseReceipts(),
      ]);
      const merged = [...paymentFiles, ...ieFiles];
      setFileUrls(merged);
      setCurrentIndex(0);
      setIsLoadingFiles(false);
    };

    // ---- (B) I&E receipts --------------------------------------------
    const loadIncomeExpenseReceipts = async (): Promise<FileUrlData[]> => {
      if (!payment?.payments_car_id || !payment?.payments_year_month) return [];
      try {
        const res = await fetch(
          buildApiUrl(
            `/api/payments/receipts/ie?carId=${encodeURIComponent(
              String(payment.payments_car_id)
            )}&yearMonth=${encodeURIComponent(payment.payments_year_month)}`
          ),
          { credentials: "include" }
        );
        if (!res.ok) return [];
        const json = await res.json();
        const list = Array.isArray(json?.files) ? json.files : [];
        return list.map((f: any) => ({
          fileId: String(f.fileId || ""),
          name: f.name,
          mimeType: f.mimeType,
          url: f.url,
          webViewLink: f.webViewLink,
          webContentLink: f.webContentLink,
          previewUrl: f.previewUrl,
          source: f.source === "ie-cell" ? "ie-cell" : "form-submission",
          contextLabel:
            [f.category, f.field].filter(Boolean).join(" › ") || undefined,
        }));
      } catch (error) {
        console.error("[Payment Receipts] Failed to fetch I&E receipts:", error);
        return [];
      }
    };

    // ---- (A) payment_attachment files (original behaviour) -----------
    const loadPaymentAttachmentFiles = async (): Promise<FileUrlData[]> => {
      if (!payment?.payments_attachment) return [];
      try {
        const parsed = JSON.parse(payment.payments_attachment);
        const ids = Array.isArray(parsed) ? parsed : [parsed];

        // Check if attachments are Google Drive IDs (not starting with /uploads/)
        const isGDrive = ids.every((id: string) =>
          typeof id === "string" && !id.startsWith("/uploads/") && !id.startsWith("http")
        );

        if (isGDrive && ids.length > 0) {
          const urls = await Promise.all(
            ids.map(async (fileId: string) => {
              try {
                const response = await fetch(
                  buildApiUrl(`/api/payments/receipt/file-url?fileId=${encodeURIComponent(fileId)}`),
                  { credentials: "include" }
                );

                if (!response.ok) {
                  const errorData = await response.json().catch(() => ({}));
                  if (errorData.error?.includes("folder") || errorData.error?.includes("Folder")) {
                    throw new Error(
                      "Invalid file ID: The stored ID appears to be a folder ID, not a file ID. Please re-upload the receipt."
                    );
                  }
                  throw new Error(errorData.error || "Failed to fetch file URL");
                }

                const data = await response.json();

                // Folder: backend returned multiple files
                if (data.isFolder && Array.isArray(data.data)) {
                  return data.data.map((file: FileUrlData) => ({
                    ...file,
                    fileId: file.fileId,
                    mimeType:
                      file.mimeType && file.mimeType !== "application/vnd.google-apps.folder"
                        ? file.mimeType
                        : undefined,
                    source: "payment-attachment" as const,
                  }));
                }

                // Single file
                const fileData = Array.isArray(data.data) ? data.data[0] : data.data;
                if (fileData.mimeType === "application/vnd.google-apps.folder") {
                  throw new Error(
                    "Invalid file ID: The stored ID is a folder ID, not a file ID. Please re-upload the receipt."
                  );
                }
                const previewUrl =
                  fileData.previewUrl || `https://drive.google.com/file/d/${fileData.fileId || fileId}/preview`;
                return {
                  ...fileData,
                  fileId: fileData.fileId || fileId,
                  previewUrl: previewUrl,
                  webViewLink: fileData.webViewLink || previewUrl,
                  webContentLink: fileData.webContentLink || previewUrl,
                  source: "payment-attachment" as const,
                };
              } catch (error: any) {
                return {
                  fileId,
                  previewUrl: null,
                  webViewLink: null,
                  webContentLink: null,
                  name: `Error loading file ${fileId}`,
                  mimeType: "unknown",
                  error: error?.message || "Failed to load file",
                  source: "payment-attachment" as const,
                };
              }
            })
          );

          const flattened = urls.flat() as FileUrlData[];
          const valid = flattened.filter(
            (f) =>
              !f.error &&
              f.fileId &&
              f.fileId !== "error" &&
              f.mimeType !== "application/vnd.google-apps.folder"
          );
          const errors = flattened.filter((f) => f.error);
          // If all failed, surface the first error so the user sees why.
          if (valid.length === 0 && errors.length > 0) {
            return [{
              fileId: "error",
              name: "Error loading receipts",
              mimeType: "unknown",
              error: errors[0].error || "Failed to load receipt files",
              source: "payment-attachment",
            }];
          }
          return valid;
        }

        // Local or http files
        return ids.map((path: string): FileUrlData => {
          const isHttp = path.startsWith("http://") || path.startsWith("https://");
          const url = isHttp ? path : buildApiUrl(path);
          return {
            fileId: path,
            webViewLink: url,
            webContentLink: url,
            source: "payment-attachment",
          };
        });
      } catch (error) {
        console.error("Failed to parse attachments:", error);
        if (payment.payments_attachment && typeof payment.payments_attachment === "string") {
          const path = payment.payments_attachment;
          const url = path.startsWith("http://") || path.startsWith("https://") ? path : buildApiUrl(path);
          return [{ fileId: path, webViewLink: url, webContentLink: url, source: "payment-attachment" }];
        }
        return [];
      }
    };

    loadAll();
  }, [payment, isOpen]);

  if (!payment) return null;

  const hasAttachments = fileUrls.length > 0;
  const currentFile = hasAttachments ? fileUrls[currentIndex] : null;
  // Resolve display URL:
  //   - If the file already has a direct URL (I&E cell signed GCS URL, local
  //     /uploads path, or http form-submission receipt), use it verbatim.
  //   - Otherwise assume it's a Google Drive file ID and route through the
  //     existing /api/payments/receipt/file-content proxy (works regardless of
  //     Drive permissions).
  const resolveCurrentUrl = (): string | null => {
    if (!currentFile) return null;
    if (currentFile.url) return currentFile.url;
    const id = currentFile.fileId;
    if (!id) return currentFile.webViewLink || currentFile.webContentLink || currentFile.previewUrl || null;
    const isHttp = id.startsWith("http://") || id.startsWith("https://");
    const isLocal = id.startsWith("/uploads/");
    if (isHttp) return id;
    if (isLocal) return buildApiUrl(id);
    return buildApiUrl(`/api/payments/receipt/file-content?fileId=${encodeURIComponent(id)}`);
  };
  const currentAttachment = resolveCurrentUrl();

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : fileUrls.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < fileUrls.length - 1 ? prev + 1 : 0));
  };

  const handleDownload = () => {
    if (!currentFile) return;
    
    // For Google Drive files, use webContentLink for direct download, or webViewLink as fallback
    const downloadUrl = currentFile.webContentLink || currentFile.webViewLink || currentFile.previewUrl;
    
    if (downloadUrl) {
      // Open in new tab for download/view
      window.open(downloadUrl, "_blank");
    }
  };

  const getFileType = (file: FileUrlData | null): string => {
    if (!file) return 'unknown';
    
    // Check MIME type first (from Google Drive)
    if (file.mimeType) {
      if (file.mimeType.startsWith('image/')) return 'image';
      if (file.mimeType === 'application/pdf') return 'pdf';
    }
    
    // Fallback to filename extension
    const filename = file.name || file.fileId || '';
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) {
      return 'image';
    } else if (ext === 'pdf') {
      return 'pdf';
    }
    return 'unknown';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border text-foreground max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-foreground text-xl flex items-center justify-between">
            <span>Payment Receipt</span>
            {hasAttachments && fileUrls.length > 1 && (
              <span className="text-sm text-muted-foreground font-normal">
                {currentIndex + 1} / {fileUrls.length}
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Receipt for {formatYearMonth(payment.payments_year_month)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col h-full">
          {isLoadingFiles ? (
            <div className="flex items-center justify-center p-12 bg-card rounded-lg min-h-[400px]">
              <div className="text-center">
                <Loader2 className="w-8 h-8 mx-auto mb-4 text-[#EAEB80] animate-spin" />
                <p className="text-muted-foreground">Loading receipt files...</p>
              </div>
            </div>
          ) : !hasAttachments ? (
            <div className="flex items-center justify-center p-12 bg-card rounded-lg">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  <X className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-lg">No receipt attached</p>
                <p className="text-muted-foreground text-sm mt-2">
                  Upload a receipt to view it here
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Receipt Display Area */}
              <div className="flex-1 bg-card rounded-lg overflow-auto p-4 min-h-[400px] max-h-[600px]">
                {currentFile && currentFile.error ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-900/20 flex items-center justify-center">
                        <X className="w-8 h-8 text-red-700" />
                      </div>
                      <p className="text-red-700 text-lg mb-2">Error Loading Receipt</p>
                      <p className="text-muted-foreground text-sm max-w-md">
                        {currentFile.error}
                      </p>
                      <p className="text-muted-foreground text-xs mt-4">
                        File ID: {currentFile.fileId}
                      </p>
                      <p className="text-muted-foreground text-xs mt-2">
                        If this error persists, the receipt may need to be re-uploaded.
                      </p>
                    </div>
                  </div>
                ) : currentFile && currentAttachment ? (
                  <>
                    {getFileType(currentFile) === 'image' ? (
                      <div className="flex items-center justify-center h-full">
                        {/* Use proxy endpoint for images to avoid permission issues */}
                        <img
                          src={currentAttachment || ''}
                          alt={`Receipt ${currentIndex + 1}`}
                          className="max-w-full max-h-full object-contain"
                          loading="eager"
                          onLoad={() => {
                            console.log(`✅ [Payment Receipts] Image loaded: ${currentFile?.name}`);
                          }}
                          onError={(e) => {
                            console.error("Failed to load image via proxy:", currentAttachment);
                            // Fallback to direct links if proxy fails
                            const fallbackUrl = currentFile?.webContentLink || currentFile?.webViewLink || currentFile?.previewUrl;
                            if (fallbackUrl && currentAttachment !== fallbackUrl) {
                              (e.target as HTMLImageElement).src = fallbackUrl;
                            }
                          }}
                        />
                      </div>
                    ) : getFileType(currentFile) === 'pdf' ? (
                      <iframe
                        src={currentAttachment || ''}
                        title={`Receipt ${currentIndex + 1}`}
                        className="w-full h-full min-h-[400px] border-0"
                        allow="fullscreen"
                        loading="eager"
                        onLoad={() => {
                          console.log(`✅ [Payment Receipts] PDF loaded: ${currentFile?.name}`);
                        }}
                        onError={() => {
                          console.error("Failed to load PDF via proxy:", currentAttachment);
                          // Fallback to direct links if proxy fails
                          if (currentFile?.previewUrl && currentAttachment !== currentFile.previewUrl) {
                            const iframe = document.querySelector(`iframe[title="Receipt ${currentIndex + 1}"]`) as HTMLIFrameElement;
                            if (iframe) {
                              iframe.src = currentFile.previewUrl;
                            }
                          }
                        }}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <p className="text-muted-foreground">
                            Unsupported file type
                          </p>
                          <Button
                            variant="outline"
                            onClick={handleDownload}
                            className="mt-4 bg-muted text-foreground hover:bg-muted/503a3a3a] border-border"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download File
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <p className="text-muted-foreground">No file to display</p>
                    </div>
                  </div>
                )}
              </div>

              {/* File info (source, context, ID/link) */}
              {currentFile && currentFile.fileId && currentFile.fileId !== 'error' && (
                <div className="mt-4 p-3 bg-card rounded-lg border border-border">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {(() => {
                      const src = currentFile.source ?? "payment-attachment";
                      const label =
                        src === "ie-cell"
                          ? "Income & Expense"
                          : src === "form-submission"
                            ? "Expense form submission"
                            : "Payment attachment";
                      const tone =
                        src === "ie-cell"
                          ? "bg-sky-500/15 text-sky-700 border-sky-500/30"
                          : src === "form-submission"
                            ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
                            : "bg-muted text-muted-foreground border-border";
                      return (
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${tone}`}
                        >
                          {label}
                        </span>
                      );
                    })()}
                    {currentFile.contextLabel && (
                      <span className="text-xs text-muted-foreground">
                        {currentFile.contextLabel}
                      </span>
                    )}
                  </div>

                  {currentFile.mimeType !== 'application/vnd.google-apps.folder' ? (
                    (() => {
                      const id = currentFile.fileId;
                      const isDirectUrl =
                        !!currentFile.url ||
                        id.startsWith("http://") ||
                        id.startsWith("https://") ||
                        id.startsWith("/uploads/");
                      const openUrl = isDirectUrl
                        ? currentFile.url ||
                          (id.startsWith("http") ? id : buildApiUrl(id))
                        : `https://drive.google.com/file/d/${id}/view`;
                      const label = isDirectUrl ? "File URL:" : "Drive File ID:";
                      const linkText = isDirectUrl
                        ? currentFile.name || openUrl
                        : id;
                      return (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">{label}</p>
                          <div className="flex items-center gap-2">
                            <a
                              href={openUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-[#EAEB80] hover:text-[#d4d570] hover:underline break-all font-mono"
                              title={isDirectUrl ? "Open file" : "Open in Google Drive"}
                            >
                              {linkText}
                            </a>
                            {!isDirectUrl && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(id);
                                    toast({ title: "Copied!", description: "File ID copied to clipboard" });
                                  } catch {
                                    toast({
                                      title: "Error",
                                      description: "Failed to copy file ID",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                title="Copy File ID"
                              >
                                <Copy className="w-3 h-3" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(openUrl, "_blank")}
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                              title="Open in new tab"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="text-sm text-yellow-700">
                      <p>Folder ID detected. Please re-upload the receipt file.</p>
                      <p className="text-xs text-muted-foreground mt-1">Folder ID: {currentFile.fileId}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Navigation & Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
                <div className="flex items-center gap-2">
                  {fileUrls.length > 1 && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePrevious}
                        className="bg-card text-foreground hover:bg-muted border-border"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleNext}
                        className="bg-card text-foreground hover:bg-muted border-border"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    className="bg-card text-foreground hover:bg-muted border-border"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Close Button */}
          <div className="flex justify-end pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="bg-card text-foreground hover:bg-muted border-border"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

