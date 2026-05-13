import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Search, Pencil, Archive, ArchiveRestore, Trash2, Link as LinkIcon } from "lucide-react";
import { VideoPreview } from "@/components/admin/video-preview";

interface TuroGuideRow {
  turo_guide_aid: number;
  turo_guide_is_active: number;
  turo_guide_file: string;
  turo_guide_title: string;
  turo_guide_description: string;
  turo_guide_created: string;
  turo_guide_datetime: string;
}

function formatDate(s: string) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return s;
  }
}

function isValidUrl(s: string): boolean {
  if (!s) return true;
  try {
    const u = new URL(s.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default function AdminTuroGuidePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<TuroGuideRow | null>(null);
  const [archiveId, setArchiveId] = useState<number | null>(null);
  const [restoreId, setRestoreId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formFile, setFormFile] = useState("");

  const { data, isLoading } = useQuery<{
    success: boolean;
    list: TuroGuideRow[];
    total: number;
    page: number;
    limit: number;
  }>({
    queryKey: ["/api/turo-guides", page, search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(buildApiUrl(`/api/turo-guides?${params}`), { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load turo guides");
      }
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (body: { turo_guide_title: string; turo_guide_description: string; turo_guide_file: string }) => {
      const res = await fetch(buildApiUrl("/api/turo-guides"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/turo-guides"] });
      toast({ title: "Turo guide created" });
      setAddOpen(false);
      setFormTitle("");
      setFormDescription("");
      setFormFile("");
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: { turo_guide_title: string; turo_guide_description: string; turo_guide_file: string } }) => {
      const res = await fetch(buildApiUrl(`/api/turo-guides/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/turo-guides"] });
      toast({ title: "Turo guide updated" });
      setEditItem(null);
      setFormTitle("");
      setFormDescription("");
      setFormFile("");
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const setActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: number }) => {
      const res = await fetch(buildApiUrl(`/api/turo-guides/${id}/active`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update status");
      }
      return res.json();
    },
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/turo-guides"] });
      toast({ title: isActive === 1 ? "Restored" : "Archived" });
      setArchiveId(null);
      setRestoreId(null);
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(buildApiUrl(`/api/turo-guides/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/turo-guides"] });
      toast({ title: "Turo guide deleted" });
      setDeleteId(null);
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const list = data?.list ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.limit ? Math.ceil(total / data.limit) : 1;

  const openEdit = (row: TuroGuideRow) => {
    setEditItem(row);
    setFormTitle(row.turo_guide_title);
    setFormDescription(row.turo_guide_description || "");
    setFormFile(row.turo_guide_file || "");
  };

  const fileValid = isValidUrl(formFile);

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Turo Guide</h1>
            <p className="text-muted-foreground text-sm">Manage Turo hosting guide entries. Archive or restore to control visibility on staff/client views.</p>
          </div>
          <Button
            onClick={() => {
              setFormTitle("");
              setFormDescription("");
              setFormFile("");
              setAddOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by title or description..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="1">Active</SelectItem>
                  <SelectItem value="0">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="rounded-lg border border-border p-3 space-y-3">
                    <Skeleton className="aspect-video w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                ))}
              </div>
            ) : list.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">No turo guides found.</div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {list.map((row) => (
                  <div
                    key={row.turo_guide_aid}
                    className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-md"
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-muted">
                      {row.turo_guide_file ? (
                        <VideoPreview
                          url={row.turo_guide_file}
                          title={row.turo_guide_title}
                          description={row.turo_guide_description}
                          className="group/preview relative block h-full w-full"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                          No video
                        </div>
                      )}
                      {row.turo_guide_is_active !== 1 && (
                        <div className="absolute left-2 top-2">
                          <Badge variant="secondary">Inactive</Badge>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-3">
                      <h3 className="font-medium leading-tight line-clamp-2" title={row.turo_guide_title}>
                        {row.turo_guide_title}
                      </h3>
                      <p className="flex-1 text-xs text-muted-foreground line-clamp-3">
                        {row.turo_guide_description || "—"}
                      </p>
                      <div className="flex items-center justify-between border-t border-border pt-2">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(row.turo_guide_datetime)}
                        </span>
                        <div className="flex items-center gap-0.5">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(row)} title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {row.turo_guide_is_active === 1 ? (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setArchiveId(row.turo_guide_aid)} title="Archive">
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRestoreId(row.turo_guide_aid)} title="Restore">
                              <ArchiveRestore className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(row.turo_guide_aid)} title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Page {data?.page ?? 1} of {totalPages} ({total} total)</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Turo Guide</DialogTitle>
            <DialogDescription>Paste a video link (YouTube, Drive, or direct .mp4) along with title and description.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Title" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <LinkIcon className="h-3.5 w-3.5" />
                Video URL
              </Label>
              <Input
                type="url"
                value={formFile}
                onChange={(e) => setFormFile(e.target.value)}
                placeholder="https://example.com/video.mp4"
              />
              {!fileValid && (
                <p className="text-xs text-destructive">Enter a valid http(s) URL</p>
              )}
              {fileValid && formFile.trim() && (
                <div className="pt-1">
                  <VideoPreview
                    url={formFile.trim()}
                    title={formTitle.trim() || "Preview"}
                    className="group relative h-24 w-40 overflow-hidden rounded border border-border bg-muted hover:border-primary"
                  />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Description" className="min-h-[80px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              disabled={!formTitle.trim() || !fileValid || createMutation.isPending}
              onClick={() => createMutation.mutate({ turo_guide_title: formTitle.trim(), turo_guide_description: formDescription.trim(), turo_guide_file: formFile.trim() })}
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit modal */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Turo Guide</DialogTitle>
          </DialogHeader>
          {editItem && (
            <>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Title" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <LinkIcon className="h-3.5 w-3.5" />
                    Video URL
                  </Label>
                  <Input
                    type="url"
                    value={formFile}
                    onChange={(e) => setFormFile(e.target.value)}
                    placeholder="https://example.com/video.mp4"
                  />
                  {!fileValid && (
                    <p className="text-xs text-destructive">Enter a valid http(s) URL</p>
                  )}
                  {fileValid && formFile.trim() && (
                    <div className="pt-1">
                      <VideoPreview
                        url={formFile.trim()}
                        title={formTitle.trim() || "Preview"}
                        className="group relative h-24 w-40 overflow-hidden rounded border border-border bg-muted hover:border-primary"
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Description" className="min-h-[80px]" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
                <Button
                  disabled={!formTitle.trim() || !fileValid || updateMutation.isPending}
                  onClick={() => updateMutation.mutate({ id: editItem.turo_guide_aid, body: { turo_guide_title: formTitle.trim(), turo_guide_description: formDescription.trim(), turo_guide_file: formFile.trim() } })}
                >
                  {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Archive confirm */}
      <AlertDialog open={archiveId !== null} onOpenChange={(open) => !open && setArchiveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive turo guide?</AlertDialogTitle>
            <AlertDialogDescription>It will be hidden from staff and client views. You can restore it later.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => archiveId != null && setActiveMutation.mutate({ id: archiveId, isActive: 0 })}
              disabled={setActiveMutation.isPending}
            >
              {setActiveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore confirm */}
      <AlertDialog open={restoreId !== null} onOpenChange={(open) => !open && setRestoreId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore turo guide?</AlertDialogTitle>
            <AlertDialogDescription>It will be visible again on staff and client views.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => restoreId != null && setActiveMutation.mutate({ id: restoreId, isActive: 1 })}
              disabled={setActiveMutation.isPending}
            >
              {setActiveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Restore"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete turo guide?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId != null && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
