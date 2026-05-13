/**
 * Document Update Submission (client)
 *
 * Clients submit License / Registration / Insurance updates here. They can
 * pick exactly one document type per submission, attach one or more files
 * (PDF, JPG, PNG, GIF, WEBP — up to 10), and add an expiration date and
 * notes. Submissions are read-only afterwards; the admin approval workflow
 * happens on the admin dashboard.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, FileText, Loader2, Upload, X } from "lucide-react";

type DocumentType = "" | "license" | "registration" | "insurance";

const DOC_TYPE_OPTIONS: { value: Exclude<DocumentType, "">; label: string }[] = [
  { value: "license", label: "License Update" },
  { value: "registration", label: "Registration Update" },
  { value: "insurance", label: "Insurance Update" },
];

const MAX_FILES = 10;
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ACCEPTED = ".pdf,.jpg,.jpeg,.png,.gif,.webp,application/pdf,image/*";

export default function DocumentUpdateSubmission() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: currentUserData } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/auth/me"), { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const sessionUser = currentUserData?.user;
  const defaultName = [sessionUser?.firstName, sessionUser?.lastName].filter(Boolean).join(" ").trim();
  const defaultEmail = (sessionUser?.email ?? "") as string;

  const [form, setForm] = useState({
    fullName: defaultName,
    email: defaultEmail,
    phone: "",
    plateNumber: "",
    documentType: "" as DocumentType,
    expirationDate: "",
    notes: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [submitted, setSubmitted] = useState(false);

  // Re-seed the name/email fields when /auth/me lands after first render.
  if (!form.fullName && defaultName) setForm((p) => ({ ...p, fullName: defaultName }));
  if (!form.email && defaultEmail) setForm((p) => ({ ...p, email: defaultEmail }));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    const tooBig = picked.find((f) => f.size > MAX_FILE_SIZE);
    if (tooBig) {
      toast({
        title: "File too large",
        description: `${tooBig.name} exceeds the 25MB limit.`,
        variant: "destructive",
      });
      return;
    }
    const next = [...files, ...picked].slice(0, MAX_FILES);
    if (files.length + picked.length > MAX_FILES) {
      toast({
        title: "Too many files",
        description: `You can attach up to ${MAX_FILES} files per submission.`,
        variant: "destructive",
      });
    }
    setFiles(next);
    e.target.value = "";
  };

  const removeFile = (i: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append("fullName", form.fullName.trim());
      fd.append("email", form.email.trim());
      fd.append("phone", form.phone.trim());
      if (form.plateNumber.trim()) fd.append("plateNumber", form.plateNumber.trim());
      fd.append("documentType", form.documentType);
      if (form.expirationDate) fd.append("expirationDate", form.expirationDate);
      if (form.notes.trim()) fd.append("notes", form.notes.trim());
      for (const file of files) fd.append("documents", file);

      const res = await fetch(buildApiUrl("/api/document-updates"), {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to submit");
      }
      return json;
    },
    onSuccess: () => {
      toast({
        title: "Submitted",
        description: "Your document update has been sent for review.",
      });
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ["/api/document-updates/my"] });
    },
    onError: (e: Error) => {
      toast({ title: "Submission failed", description: e.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim() || !form.email.trim() || !form.phone.trim()) {
      toast({
        title: "Missing required fields",
        description: "Full name, email, and phone are required.",
        variant: "destructive",
      });
      return;
    }
    if (!form.documentType) {
      toast({
        title: "Pick a document type",
        description: "Choose License, Registration, or Insurance.",
        variant: "destructive",
      });
      return;
    }
    if (files.length === 0) {
      toast({
        title: "Attach a document",
        description: "Upload at least one file.",
        variant: "destructive",
      });
      return;
    }
    submitMutation.mutate();
  };

  const handleReset = () => {
    setForm({
      fullName: defaultName,
      email: defaultEmail,
      phone: "",
      plateNumber: "",
      documentType: "",
      expirationDate: "",
      notes: "",
    });
    setFiles([]);
    setSubmitted(false);
  };

  if (submitted) {
    return (
      <Card className="border-primary/20">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <CheckCircle className="h-12 w-12 text-green-600" />
          <h3 className="text-lg font-semibold">Submission received</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            We'll review your document update shortly. You can track its status in
            "My Document Submissions".
          </p>
          <Button variant="outline" onClick={handleReset}>Submit Another</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-primary flex items-center gap-2">
          <FileText className="h-5 w-5" />
          License &amp; Registration or Insurance Updates
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Upload your current driver's license, vehicle registration, or insurance card. Accepted
          formats: PDF, JPG, PNG (up to 25MB per file).
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="du_full_name">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="du_full_name"
                value={form.fullName}
                onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="du_email">
                Email Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="du_email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="du_phone">
                Phone Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="du_phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="du_plate">Vehicle Plate Number</Label>
              <Input
                id="du_plate"
                value={form.plateNumber}
                onChange={(e) => setForm((p) => ({ ...p, plateNumber: e.target.value }))}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>
                Document Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.documentType}
                onValueChange={(v) =>
                  setForm((p) => ({ ...p, documentType: v as DocumentType }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="du_expiration">Expiration Date</Label>
              <Input
                id="du_expiration"
                type="date"
                value={form.expirationDate}
                onChange={(e) => setForm((p) => ({ ...p, expirationDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="du_notes">Notes / Comments</Label>
            <Textarea
              id="du_notes"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Optional — anything we should know about this update."
            />
          </div>

          <div className="space-y-2">
            <Label>
              Upload Document(s) <span className="text-destructive">*</span>
            </Label>
            <label
              htmlFor="du_files"
              className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-md p-6 cursor-pointer hover:bg-muted/30"
            >
              <Upload className="h-7 w-7 text-muted-foreground" />
              <span className="text-sm font-medium">Click to attach files</span>
              <span className="text-xs text-muted-foreground">
                PDF, JPG, PNG, GIF, WEBP — up to {MAX_FILES} files, 25MB each
              </span>
              <input
                id="du_files"
                type="file"
                multiple
                accept={ACCEPTED}
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
            {files.length > 0 && (
              <ul className="space-y-1.5">
                {files.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center justify-between gap-2 bg-muted/40 rounded-md px-3 py-2 text-sm"
                  >
                    <span className="truncate">
                      <FileText className="h-4 w-4 inline-block mr-1.5 text-muted-foreground" />
                      {f.name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {(f.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removeFile(i)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleReset}>
              Clear
            </Button>
            <Button
              type="submit"
              disabled={submitMutation.isPending}
              className="min-w-[140px]"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Submitting…
                </>
              ) : (
                "Submit"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
