/**
 * News & Media Management Page — /admin/news-media
 * Admins add/edit/archive video links (YouTube, etc.) and photo links.
 * Items appear on the admin and client dashboards.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Search, Pencil, Archive, ArchiveRestore, Trash2, Link as LinkIcon, Newspaper } from "lucide-react";
import { VideoPreview } from "@/components/admin/video-preview";

interface NewsMediaRow {
  client_testimonial_aid: number;   // reuse the testimonials endpoint with a tag
  client_testimonial_is_active: number;
  client_testimonial_file: string;
  client_testimonial_title: string;
  client_testimonial_description: string;
  client_testimonial_created: string;
  client_testimonial_datetime: string;
}

function formatDate(s: string) {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return s;
  }
}

function isValidUrl(s: string): boolean {
  if (!s) return true;
  try {
    new URL(s);
    return true;
  } catch {
    return false;
  }
}

export default function NewsMediaPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<NewsMediaRow | null>(null);
  const [archiveId, setArchiveId] = useState<number | null>(null);
  const [restoreId, setRestoreId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formFile, setFormFile] = useState("");

  // Re-use the client-testimonials API with a "news_media" tag for separation.
  // In practice, we use the same table but filter by a tag stored in the description prefix.
  // For simplicity, we call client-testimonials with a ?tag=news_media param
  // (the backend may not support this yet, so we just store items there and filter by
  // title prefix "NEWS:" — a lightweight approach that doesn't require schema changes).
  const NEWS_PREFIX = "[NEWS] ";

  const { data, isLoading } = useQuery<{
    success: boolean;
    list: NewsMediaRow[];
    total: number;
    page: number;
    limit: number;
  }>({
    queryKey: ["/api/news-media", page, search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      if (search.trim()) params.set("search", `${NEWS_PREFIX}${search.trim()}`);
      else params.set("search", NEWS_PREFIX);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(buildApiUrl(`/api/client-testimonials?${params}`), { credentials: "include" });
      if (!res.ok) return { success: false, list: [], total: 0, page: 1, limit: 20 };
      return res.json();
    },
  });

  const list = (data?.list ?? []).filter(r =>
    r.client_testimonial_title.startsWith(NEWS_PREFIX)
  );
  const total = list.length;
  const totalPages = 1;

  const createMutation = useMutation({
    mutationFn: async (body: { title: string; description: string; file: string }) => {
      const res = await fetch(buildApiUrl("/api/client-testimonials"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          client_testimonial_title: `${NEWS_PREFIX}${body.title}`,
          client_testimonial_description: body.description,
          client_testimonial_file: body.file,
        }),
      });
      if (!res.ok) throw new Error("Failed to create");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news-media"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client-testimonials"] });
      toast({ title: "News & Media item created" });
      setAddOpen(false);
      setFormTitle(""); setFormDescription(""); setFormFile("");
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: { title: string; description: string; file: string } }) => {
      const res = await fetch(buildApiUrl(`/api/client-testimonials/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          client_testimonial_title: `${NEWS_PREFIX}${body.title}`,
          client_testimonial_description: body.description,
          client_testimonial_file: body.file,
        }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news-media"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client-testimonials"] });
      toast({ title: "Updated" });
      setEditItem(null);
      setFormTitle(""); setFormDescription(""); setFormFile("");
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const setActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: number }) => {
      const res = await fetch(buildApiUrl(`/api/client-testimonials/${id}/active`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/news-media"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client-testimonials"] });
      toast({ title: isActive === 1 ? "Restored" : "Archived" });
      setArchiveId(null); setRestoreId(null);
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(buildApiUrl(`/api/client-testimonials/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news-media"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client-testimonials"] });
      toast({ title: "Item deleted" });
      setDeleteId(null);
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Error", description: e.message }),
  });

  const openEdit = (row: NewsMediaRow) => {
    setEditItem(row);
    const displayTitle = row.client_testimonial_title.startsWith(NEWS_PREFIX)
      ? row.client_testimonial_title.slice(NEWS_PREFIX.length)
      : row.client_testimonial_title;
    setFormTitle(displayTitle);
    setFormDescription(row.client_testimonial_description);
    setFormFile(row.client_testimonial_file);
  };

  const fileValid = isValidUrl(formFile);

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Newspaper className="w-6 h-6 text-primary" />
              News & Media
            </h1>
            <p className="text-muted-foreground text-sm">
              Manage news updates, video links, and media content displayed on dashboards.
            </p>
          </div>
          <Button
            onClick={() => {
              setFormTitle(""); setFormDescription(""); setFormFile("");
              setAddOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Item
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
                  <SelectItem value="0">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-lg border border-border p-3 space-y-3">
                    <Skeleton className="aspect-video w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                ))}
              </div>
            ) : list.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Newspaper className="w-12 h-12 mx-auto opacity-20 mb-3" />
                <p>No news & media items yet. Click "Add Item" to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {list.map((row) => {
                  const displayTitle = row.client_testimonial_title.startsWith(NEWS_PREFIX)
                    ? row.client_testimonial_title.slice(NEWS_PREFIX.length)
                    : row.client_testimonial_title;
                  return (
                    <div
                      key={row.client_testimonial_aid}
                      className={`group flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-md ${
                        row.client_testimonial_is_active === 0 ? "opacity-60" : ""
                      }`}
                    >
                      <div className="relative aspect-video w-full overflow-hidden bg-muted">
                        {row.client_testimonial_file ? (
                          <VideoPreview url={row.client_testimonial_file} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Newspaper className="w-8 h-8 text-muted-foreground/40" />
                          </div>
                        )}
                        {row.client_testimonial_is_active === 0 && (
                          <span className="absolute top-1.5 left-1.5 rounded bg-gray-700/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            Archived
                          </span>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col gap-2 p-3">
                        <h3 className="font-medium leading-tight line-clamp-2" title={displayTitle}>
                          {displayTitle}
                        </h3>
                        <p className="flex-1 text-xs text-muted-foreground line-clamp-3">
                          {row.client_testimonial_description || "—"}
                        </p>
                        <div className="flex items-center justify-between border-t border-border pt-2">
                          <span className="text-xs text-muted-foreground">{formatDate(row.client_testimonial_datetime)}</span>
                          <div className="flex items-center gap-0.5">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(row)} title="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {row.client_testimonial_is_active === 1 ? (
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setArchiveId(row.client_testimonial_aid)} title="Archive">
                                <Archive className="h-3.5 w-3.5" />
                              </Button>
                            ) : (
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRestoreId(row.client_testimonial_aid)} title="Restore">
                                <ArchiveRestore className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(row.client_testimonial_aid)} title="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add modal */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add News & Media Item</DialogTitle>
              <DialogDescription>Add a YouTube video, photo link, or news article URL.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Title" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  URL <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
                </Label>
                <Input
                  value={formFile}
                  onChange={(e) => setFormFile(e.target.value)}
                  placeholder="https://youtube.com/... or https://..."
                />
                {!fileValid && <p className="text-xs text-destructive">Enter a valid http(s) URL</p>}
                {fileValid && formFile.trim() && (
                  <div className="pt-1">
                    <VideoPreview url={formFile.trim()} />
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
                onClick={() => createMutation.mutate({ title: formTitle.trim(), description: formDescription.trim(), file: formFile.trim() })}
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
              <DialogTitle>Edit News & Media Item</DialogTitle>
            </DialogHeader>
            {editItem && (
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Title" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">URL <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" /></Label>
                  <Input value={formFile} onChange={(e) => setFormFile(e.target.value)} placeholder="https://..." />
                  {!fileValid && <p className="text-xs text-destructive">Enter a valid http(s) URL</p>}
                  {fileValid && formFile.trim() && <div className="pt-1"><VideoPreview url={formFile.trim()} /></div>}
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Description" className="min-h-[80px]" />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
              <Button
                disabled={!formTitle.trim() || !fileValid || updateMutation.isPending}
                onClick={() => editItem && updateMutation.mutate({ id: editItem.client_testimonial_aid, body: { title: formTitle.trim(), description: formDescription.trim(), file: formFile.trim() } })}
              >
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Archive / Restore / Delete dialogs */}
        <AlertDialog open={archiveId !== null} onOpenChange={(open) => !open && setArchiveId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archive item?</AlertDialogTitle>
              <AlertDialogDescription>It will be hidden from dashboards. You can restore it later.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => archiveId != null && setActiveMutation.mutate({ id: archiveId, isActive: 0 })} disabled={setActiveMutation.isPending}>Archive</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={restoreId !== null} onOpenChange={(open) => !open && setRestoreId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Restore item?</AlertDialogTitle>
              <AlertDialogDescription>It will be visible on dashboards again.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => restoreId != null && setActiveMutation.mutate({ id: restoreId, isActive: 1 })} disabled={setActiveMutation.isPending}>Restore</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete item?</AlertDialogTitle>
              <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteId != null && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}
