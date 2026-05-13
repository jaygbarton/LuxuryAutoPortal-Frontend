/**
 * Document Update — My Submissions (client read-only view).
 *
 * Lists the current client's License / Registration / Insurance submissions.
 * No edit, no delete — clients can only view what they've sent.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildApiUrl, getProxiedImageUrl } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Eye,
  ExternalLink,
  FileText,
  Loader2,
  ShieldCheck,
  ZoomIn,
  X,
} from "lucide-react";

type DocumentType = "license" | "registration" | "insurance";
type Status = "pending_review" | "approved" | "rejected" | "update_requested";

interface SubmittedFile {
  url: string;
  name: string;
  mime: string;
}

interface DocumentUpdateRow {
  du_aid: number;
  du_full_name: string;
  du_email: string;
  du_phone: string;
  du_plate_number: string | null;
  du_document_type: DocumentType;
  du_expiration_date: string | null;
  du_notes: string | null;
  du_files: string | null;
  du_status: Status;
  du_reject_reason: string | null;
  du_update_request_message: string | null;
  du_decided_by: string | null;
  du_decided_at: string | null;
  du_date_submitted: string;
}

const DOC_LABELS: Record<DocumentType, string> = {
  license: "License Update",
  registration: "Registration Update",
  insurance: "Insurance Update",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return d;
  }
}

function parseFiles(raw: string | null): SubmittedFile[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (f): f is SubmittedFile => f && typeof f === "object" && typeof f.url === "string"
    );
  } catch {
    return [];
  }
}

function StatusBadge({ status }: { status: Status }) {
  if (status === "approved")
    return <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>;
  if (status === "rejected")
    return <Badge className="bg-red-100 text-red-800 border-red-200">Rejected</Badge>;
  if (status === "update_requested")
    return (
      <Badge className="bg-amber-100 text-amber-800 border-amber-200">Update Requested</Badge>
    );
  return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending Review</Badge>;
}

function isImageMime(mime: string, url: string): boolean {
  if (mime && mime.startsWith("image/")) return true;
  return /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url);
}

export default function DocumentUpdateMySubmissions() {
  const [selectedRow, setSelectedRow] = useState<DocumentUpdateRow | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/document-updates/my"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/document-updates/my"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch submissions");
      return res.json();
    },
  });

  const rows: DocumentUpdateRow[] = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return <p className="text-sm text-destructive py-4">Failed to load your submissions.</p>;
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
        <ShieldCheck className="h-10 w-10" />
        <p className="text-sm">No document updates submitted yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-[120px]">Submitted</TableHead>
              <TableHead>Document Type</TableHead>
              <TableHead>Plate #</TableHead>
              <TableHead className="w-[110px]">Expiration</TableHead>
              <TableHead className="w-[70px] text-center">Files</TableHead>
              <TableHead className="w-[140px] text-center">Status</TableHead>
              <TableHead className="w-[70px] text-center">View</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const files = parseFiles(row.du_files);
              return (
                <TableRow key={row.du_aid} className="hover:bg-muted/20">
                  <TableCell className="text-sm">{formatDate(row.du_date_submitted)}</TableCell>
                  <TableCell className="text-sm font-medium">
                    {DOC_LABELS[row.du_document_type]}
                  </TableCell>
                  <TableCell className="text-sm">{row.du_plate_number || "—"}</TableCell>
                  <TableCell className="text-sm">{formatDate(row.du_expiration_date)}</TableCell>
                  <TableCell className="text-sm text-center">{files.length}</TableCell>
                  <TableCell className="text-center">
                    <StatusBadge status={row.du_status} />
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setSelectedRow(row)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="h-7 w-7" />
          </button>
          <img
            src={lightboxUrl}
            alt="Document full size"
            className="max-w-full max-h-full rounded-lg shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <Dialog
        open={!!selectedRow}
        onOpenChange={(open) => { if (!open) setSelectedRow(null); }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-primary">Document Update Details</DialogTitle>
          </DialogHeader>
          {selectedRow && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    Submitted
                  </p>
                  <p className="font-medium">{formatDate(selectedRow.du_date_submitted)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    Status
                  </p>
                  <StatusBadge status={selectedRow.du_status} />
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    Document Type
                  </p>
                  <p className="font-medium">{DOC_LABELS[selectedRow.du_document_type]}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    Plate Number
                  </p>
                  <p className="font-medium">{selectedRow.du_plate_number || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    Expiration
                  </p>
                  <p className="font-medium">{formatDate(selectedRow.du_expiration_date)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    Phone
                  </p>
                  <p className="font-medium">{selectedRow.du_phone}</p>
                </div>
                {selectedRow.du_notes && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      Notes
                    </p>
                    <p className="font-medium whitespace-pre-wrap">{selectedRow.du_notes}</p>
                  </div>
                )}
                {selectedRow.du_status === "rejected" && selectedRow.du_reject_reason && (
                  <div className="col-span-2 rounded-md bg-red-50 border border-red-200 p-3">
                    <p className="text-xs font-medium text-red-700 uppercase tracking-wide">
                      Rejection Reason
                    </p>
                    <p className="text-red-800 mt-1">{selectedRow.du_reject_reason}</p>
                  </div>
                )}
                {selectedRow.du_status === "update_requested" &&
                  selectedRow.du_update_request_message && (
                    <div className="col-span-2 rounded-md bg-amber-50 border border-amber-200 p-3">
                      <p className="text-xs font-medium text-amber-700 uppercase tracking-wide">
                        Admin requested updates
                      </p>
                      <p className="text-amber-800 mt-1">
                        {selectedRow.du_update_request_message}
                      </p>
                    </div>
                  )}
              </div>

              {(() => {
                const files = parseFiles(selectedRow.du_files);
                if (files.length === 0) return null;
                return (
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1.5">
                      Attached Documents
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {files.map((f, i) => {
                        const isImg = isImageMime(f.mime, f.url);
                        if (isImg) {
                          return (
                            <button
                              key={i}
                              type="button"
                              className="relative group block rounded-md border border-border overflow-hidden"
                              onClick={() => setLightboxUrl(getProxiedImageUrl(f.url))}
                            >
                              <img
                                src={getProxiedImageUrl(f.url)}
                                alt={f.name}
                                className="h-32 w-full object-cover transition-opacity group-hover:opacity-80"
                              />
                              <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <ZoomIn className="h-7 w-7 text-white drop-shadow-lg" />
                              </span>
                            </button>
                          );
                        }
                        return (
                          <a
                            key={i}
                            href={getProxiedImageUrl(f.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-primary hover:underline text-sm rounded-md border border-border p-3"
                          >
                            <FileText className="h-4 w-4" />
                            <span className="truncate">{f.name || "Document"}</span>
                            <ExternalLink className="h-3 w-3 ml-auto" />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
