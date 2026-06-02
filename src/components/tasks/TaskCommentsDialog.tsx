/**
 * TaskCommentsDialog
 *
 * Shared comments thread modal used by both the admin Task Management page
 * and the employee Task Management page. Reads/writes against
 *   GET  /api/tasks/:id/comments
 *   POST /api/tasks/:id/comments
 * — backend authorizes that the caller is either an admin or an employee
 * actually assigned to the task before allowing either operation.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TaskComment {
  task_comment_aid: number;
  task_timer_aid: number;
  author_type: "admin" | "employee";
  author_id: number | null;
  author_name: string;
  body: string;
  created_at: string;
}

interface Props {
  taskId: number | null;
  taskName?: string;
  onClose: () => void;
}

function formatWhen(d: string): string {
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return (
      date.toLocaleDateString("en-US", {
        timeZone: "America/Denver",
        weekday: "short",
        month: "short",
        day: "numeric",
      }) +
      ", " +
      date.toLocaleTimeString("en-US", {
        timeZone: "America/Denver",
        hour: "numeric",
        minute: "2-digit",
      })
    );
  } catch {
    return d;
  }
}

export default function TaskCommentsDialog({ taskId, taskName, onClose }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [body, setBody] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const { data, isLoading } = useQuery<{
    success: boolean;
    data: TaskComment[];
  }>({
    queryKey: ["task-comments", taskId],
    queryFn: async () => {
      const r = await fetch(buildApiUrl(`/api/tasks/${taskId}/comments`), {
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to load comments");
      return r.json();
    },
    enabled: taskId != null,
    retry: false,
  });

  const comments = data?.data ?? [];

  // Auto-scroll the thread to the latest comment whenever the list grows.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments.length]);

  const postComment = useMutation({
    mutationFn: async (text: string) => {
      const r = await fetch(buildApiUrl(`/api/tasks/${taskId}/comments`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const json = await r.json().catch(() => null);
      if (!r.ok || !json?.success) {
        throw new Error(json?.error || `HTTP ${r.status}`);
      }
      return json;
    },
    onSuccess: () => {
      setBody("");
      queryClient.invalidateQueries({ queryKey: ["task-comments", taskId] });
    },
    onError: (e: any) => {
      toast({
        title: "Could not post comment",
        description: e?.message ?? "",
        variant: "destructive",
      });
    },
  });

  function submit() {
    const trimmed = body.trim();
    if (!trimmed) return;
    postComment.mutate(trimmed);
  }

  return (
    <Dialog open={taskId != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2 border-b border-border">
          <DialogTitle>Comments</DialogTitle>
          {taskName && (
            <p className="text-xs text-muted-foreground truncate">{taskName}</p>
          )}
        </DialogHeader>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-6 py-3 space-y-3 min-h-[200px] max-h-[55vh]"
        >
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">
              No comments yet. Be the first to leave one.
            </p>
          ) : (
            comments.map((c) => (
              <div
                key={c.task_comment_aid}
                className="rounded-md border border-border bg-card/50 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium truncate">
                      {c.author_name}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${
                        c.author_type === "admin"
                          ? "bg-amber-100 text-amber-800 border-amber-300"
                          : "bg-blue-100 text-blue-800 border-blue-300"
                      }`}
                    >
                      {c.author_type === "admin" ? "Admin" : "Employee"}
                    </Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {formatWhen(c.created_at)}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap break-words">
                  {c.body}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-border px-6 py-3 space-y-2">
          <Textarea
            placeholder="Write a comment…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            className="resize-none"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">
              {body.length}/4000 · ⌘/Ctrl+Enter to send
            </span>
            <Button
              size="sm"
              onClick={submit}
              disabled={!body.trim() || postComment.isPending}
              className="gap-1"
            >
              {postComment.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              Post
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
