import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/lib/queryClient";
import { Archive, Download, FileText, Loader2, Search, Trash2 } from "lucide-react";

type JobApplication = {
  job_application_aid: number;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  position: string;
  email: string;
  phone: string;
  linkedin: string | null;
  notes: string | null;
  status: "new" | "reviewed" | "archived";
  is_archived: number;
  submitted_at: string;
  updated_at: string;
  document_count: number;
};

type JobApplicationDocument = {
  job_application_document_aid: number;
  job_application_id: number;
  field_name: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  uploaded_at: string;
};

function formatDate(value: string) {
  if (!value) return "Not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 KB";
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(value / 1024))} KB`;
}

function documentLabel(fieldName: string) {
  if (fieldName === "driversLicense") return "Driver's License";
  if (fieldName === "optionalDocuments") return "Optional Document";
  return fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
}

export default function HrApplicationsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("status", status);
    if (search.trim()) params.set("search", search.trim());
    if (includeArchived) params.set("includeArchived", "1");
    return params.toString();
  }, [includeArchived, search, status]);

  const { data, isLoading } = useQuery<{ applications: JobApplication[] }>({
    queryKey: ["/api/admin/hr/job-applications", queryString],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/admin/hr/job-applications?${queryString}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load job applications");
      return res.json();
    },
  });

  const applications = data?.applications ?? [];
  const selected = applications.find((app) => app.job_application_aid === selectedId) ?? applications[0] ?? null;

  const { data: documentsData, isLoading: documentsLoading } = useQuery<{ documents: JobApplicationDocument[] }>({
    queryKey: ["/api/admin/hr/job-applications", selected?.job_application_aid, "documents"],
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl(`/api/admin/hr/job-applications?action=documents&id=${selected!.job_application_aid}`),
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to load application documents");
      return res.json();
    },
    enabled: !!selected,
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ id, archived }: { id: number; archived: boolean }) => {
      const res = await fetch(buildApiUrl(`/api/admin/hr/job-applications?id=${id}`), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, archived }),
      });
      if (!res.ok) throw new Error("Failed to update application");
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hr/job-applications"] });
      toast({ title: vars.archived ? "Archived" : "Restored", description: "Application list updated." });
    },
    onError: (error: any) => {
      toast({ title: "Update failed", description: error?.message || "Try again.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(buildApiUrl(`/api/admin/hr/job-applications?id=${id}`), {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Failed to delete application");
      return res.json();
    },
    onSuccess: () => {
      setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hr/job-applications"] });
      toast({ title: "Deleted", description: "Application permanently removed." });
    },
    onError: (error: any) => {
      toast({ title: "Delete failed", description: error?.message || "Try again.", variant: "destructive" });
    },
  });

  const documents = documentsData?.documents ?? [];

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary">Job Applications</h1>
            <p className="text-sm text-muted-foreground">
              Review submitted resumes, driver's licenses, and optional documents from the public jobs page.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_170px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search applicant, role, email"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Open</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={includeArchived ? "default" : "outline"}
              onClick={() => setIncludeArchived((value) => !value)}
            >
              {includeArchived ? "Hide Archived" : "Show Archived"}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <Card className="border-border bg-card">
            <CardHeader className="border-b border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold text-foreground">Applications</div>
                <Badge variant="outline">{applications.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading applications
                </div>
              ) : applications.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">No applications found.</div>
              ) : (
                <div className="divide-y divide-border">
                  {applications.map((application) => {
                    const active = selected?.job_application_aid === application.job_application_aid;
                    return (
                      <button
                        key={application.job_application_aid}
                        type="button"
                        className={`grid w-full gap-2 p-4 text-left transition-colors hover:bg-muted/60 ${active ? "bg-muted" : ""}`}
                        onClick={() => setSelectedId(application.job_application_aid)}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-semibold text-foreground">
                            {application.first_name} {application.last_name}
                          </div>
                          <Badge variant={application.is_archived ? "secondary" : "outline"}>
                            {application.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">{application.position}</div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>{application.email}</span>
                          <span>{formatDate(application.submitted_at)}</span>
                          <span>{application.document_count} document(s)</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-5">
              {!selected ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Select an application to review.</div>
              ) : (
                <div className="space-y-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">Applicant</div>
                      <h2 className="mt-1 text-2xl font-bold text-foreground">
                        {selected.first_name} {selected.last_name}
                      </h2>
                      <p className="text-sm text-muted-foreground">{selected.position}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() =>
                          archiveMutation.mutate({
                            id: selected.job_application_aid,
                            archived: !selected.is_archived,
                          })
                        }
                        disabled={archiveMutation.isPending}
                      >
                        <Archive className="mr-2 h-4 w-4" />
                        {selected.is_archived ? "Restore" : "Archive"}
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          if (window.confirm("Delete this job application permanently?")) {
                            deleteMutation.mutate(selected.job_application_aid);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Info label="Email" value={selected.email} />
                    <Info label="Phone" value={selected.phone} />
                    <Info label="Date Of Birth" value={selected.date_of_birth} />
                    <Info label="Submitted" value={formatDate(selected.submitted_at)} />
                    <Info label="LinkedIn" value={selected.linkedin || "Not provided"} link={selected.linkedin || undefined} />
                    <Info label="Status" value={selected.status} />
                  </div>

                  {selected.notes ? (
                    <div className="rounded-md border border-border bg-background p-4">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">Notes</div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{selected.notes}</p>
                    </div>
                  ) : null}

                  <div className="rounded-md border border-border bg-background">
                    <div className="flex items-center gap-2 border-b border-border p-4 font-semibold text-foreground">
                      <FileText className="h-4 w-4 text-primary" />
                      Documents
                    </div>
                    {documentsLoading ? (
                      <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading documents
                      </div>
                    ) : documents.length === 0 ? (
                      <div className="p-4 text-sm text-muted-foreground">No documents attached.</div>
                    ) : (
                      <div className="divide-y divide-border">
                        {documents.map((doc) => (
                          <div key={doc.job_application_document_aid} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <div className="font-medium text-foreground">{documentLabel(doc.field_name)}</div>
                              <div className="text-sm text-muted-foreground">
                                {doc.original_name} - {formatBytes(doc.file_size)}
                              </div>
                            </div>
                            <a
                              href={buildApiUrl(`/api/admin/hr/job-applications?action=download&documentId=${doc.job_application_document_aid}`)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button variant="outline" size="sm">
                                <Download className="mr-2 h-4 w-4" />
                                Download
                              </Button>
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}

function Info({ label, value, link }: { label: string; value: string; link?: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-background p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      {link ? (
        <a className="mt-1 block truncate text-sm font-medium text-primary hover:underline" href={link} target="_blank" rel="noopener noreferrer">
          {value}
        </a>
      ) : (
        <div className="mt-1 truncate text-sm font-medium text-foreground">{value}</div>
      )}
    </div>
  );
}
