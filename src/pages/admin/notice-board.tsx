import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2, ClipboardList } from "lucide-react";

interface NoticeBoardRow {
  notice_board_aid: number;
  notice_board_title: string;
  notice_board_body: string;
  notice_board_category: string;
  notice_board_priority: string;
  notice_board_date: string;
  notice_board_is_active: number;
}

const CATEGORIES = ["Operations", "HR", "Finance", "General", "Urgent"];
const PRIORITIES = ["Info", "Low", "Medium", "High", "Critical"];

const PRIORITY_COLORS: Record<string, string> = {
  Info: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Low: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  Medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  High: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  Critical: "bg-red-500/20 text-red-400 border-red-500/30",
};

const emptyForm = {
  notice_board_title: "",
  notice_board_body: "",
  notice_board_category: "Operations",
  notice_board_priority: "Info",
  notice_board_date: new Date().toISOString().slice(0, 10),
  notice_board_is_active: 1,
};

export default function NoticeBoardManagementPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<NoticeBoardRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data, isLoading } = useQuery<{ success: boolean; data: NoticeBoardRow[] }>({
    queryKey: ["/api/admin/notice-board", "all"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/admin/notice-board?all=1"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch notices");
      return res.json();
    },
  });

  const notices = data?.data ?? [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/api/admin/notice-board"] });
    qc.invalidateQueries({ queryKey: ["/api/me/notice-board"] });
  };

  const createMutation = useMutation({
    mutationFn: async (body: typeof emptyForm) => {
      const res = await fetch(buildApiUrl("/api/admin/notice-board"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to create notice");
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      toast({ title: "Notice created" });
    },
    onError: () => toast({ title: "Error", description: "Failed to create notice", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Partial<typeof emptyForm> }) => {
      const res = await fetch(buildApiUrl(`/api/admin/notice-board/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to update notice");
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      toast({ title: "Notice updated" });
    },
    onError: () => toast({ title: "Error", description: "Failed to update notice", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(buildApiUrl(`/api/admin/notice-board/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete notice");
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setDeleteId(null);
      toast({ title: "Notice deleted" });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete notice", variant: "destructive" }),
  });

  const toggleActive = (n: NoticeBoardRow) => {
    updateMutation.mutate({
      id: n.notice_board_aid,
      body: { notice_board_is_active: n.notice_board_is_active ? 0 : 1 },
    });
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEdit = (n: NoticeBoardRow) => {
    setEditing(n);
    setForm({
      notice_board_title: n.notice_board_title,
      notice_board_body: n.notice_board_body,
      notice_board_category: n.notice_board_category,
      notice_board_priority: n.notice_board_priority,
      notice_board_date: n.notice_board_date?.slice(0, 10) ?? emptyForm.notice_board_date,
      notice_board_is_active: n.notice_board_is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.notice_board_title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    if (editing) {
      updateMutation.mutate({ id: editing.notice_board_aid, body: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <AdminLayout>
      <div className="flex flex-col gap-6 pb-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClipboardList className="w-6 h-6 text-[#d3bc8d]" />
            <h1 className="text-xl font-semibold text-foreground">Notice Board Management</h1>
          </div>
          <Button onClick={openCreate} className="bg-[#d3bc8d] hover:bg-[#c4aa78] text-black gap-2">
            <Plus className="w-4 h-4" />
            Add Notice
          </Button>
        </div>

        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {notices.length} notice{notices.length !== 1 ? "s" : ""} total
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-[#d3bc8d]" />
              </div>
            ) : notices.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No notices yet. Click "Add Notice" to create one.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {notices.map((n) => (
                  <div key={n.notice_board_aid} className="flex flex-col gap-2 px-4 py-4">
                    {/* Title + badges row */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground text-sm">{n.notice_board_title}</span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${PRIORITY_COLORS[n.notice_board_priority] ?? PRIORITY_COLORS.Info}`}
                      >
                        {n.notice_board_priority}
                      </Badge>
                      <Badge variant="outline" className="text-xs text-muted-foreground border-border">
                        {n.notice_board_category}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{n.notice_board_date?.slice(0, 10)}</span>
                    </div>
                    {/* Body preview */}
                    {n.notice_board_body && (
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-2">
                        {n.notice_board_body}
                      </p>
                    )}
                    {/* Controls row — full width on mobile */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={!!n.notice_board_is_active}
                          onCheckedChange={() => toggleActive(n)}
                          disabled={updateMutation.isPending}
                        />
                        <span className="text-xs text-muted-foreground">
                          {n.notice_board_is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => openEdit(n)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-400" onClick={() => setDeleteId(n.notice_board_aid)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Notice" : "Add Notice"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Title <span className="text-red-400">*</span></Label>
              <Input
                value={form.notice_board_title}
                onChange={(e) => setForm((f) => ({ ...f, notice_board_title: e.target.value }))}
                placeholder="Notice title"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Body</Label>
              <Textarea
                value={form.notice_board_body}
                onChange={(e) => setForm((f) => ({ ...f, notice_board_body: e.target.value }))}
                placeholder="Notice content..."
                rows={4}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Category</Label>
                <Select
                  value={form.notice_board_category}
                  onValueChange={(v) => setForm((f) => ({ ...f, notice_board_category: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Priority</Label>
                <Select
                  value={form.notice_board_priority}
                  onValueChange={(v) => setForm((f) => ({ ...f, notice_board_priority: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.notice_board_date}
                  onChange={(e) => setForm((f) => ({ ...f, notice_board_date: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Status</Label>
                <div className="flex items-center gap-3 h-10">
                  <Switch
                    checked={!!form.notice_board_is_active}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, notice_board_is_active: v ? 1 : 0 }))}
                  />
                  <span className="text-sm text-muted-foreground">
                    {form.notice_board_is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-[#d3bc8d] hover:bg-[#c4aa78] text-black w-full sm:w-auto">
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? "Save Changes" : "Create Notice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Notice</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the notice. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
