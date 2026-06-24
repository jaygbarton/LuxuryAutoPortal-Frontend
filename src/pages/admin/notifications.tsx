/**
 * Full notifications list page (/admin/notifications). The bell dropdown only
 * shows the latest 10; this page shows the full list (up to the backend's 100
 * cap) with read/unread filtering, mark-as-read, mark-all-read, and click-
 * through to each notification's link — reusing the same /api/notifications
 * endpoints the bell uses.
 */

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AdminLayout } from "@/components/admin/admin-layout";
import { AdminPageLinks } from "@/components/admin/AdminPageLinks";
import { ClientPageLinks } from "@/components/client/ClientPageLinks";
import { buildApiUrl } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Bell, Check, Loader2 } from "lucide-react";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

function formatTime(d: string) {
  const date = new Date(d);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleString("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data, isLoading } = useQuery<{
    success: boolean;
    data: Notification[];
    unreadCount: number;
  }>({
    queryKey: ["/api/notifications", "full"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/notifications?limit=100"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const markRead = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(buildApiUrl(`/api/notifications/${id}/read`), {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const res = await fetch(buildApiUrl("/api/notifications/read-all"), {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const unreadCount = data?.unreadCount ?? 0;
  const all = data?.data ?? [];
  const notifications = useMemo(
    () => (filter === "unread" ? all.filter((n) => !n.isRead) : all),
    [all, filter],
  );

  const handleClick = (n: Notification) => {
    if (!n.isRead) markRead.mutate(n.id);
    if (n.link) {
      try {
        const url = new URL(n.link);
        if (url.origin === window.location.origin) {
          setLocation(url.pathname + url.search);
        } else {
          window.location.href = n.link;
        }
      } catch {
        setLocation(n.link.startsWith("/") ? n.link : "/admin/forms");
      }
    }
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#D3BC8D]" />
            <h1 className="text-xl sm:text-2xl font-bold text-primary">Notifications</h1>
            {unreadCount > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center text-[11px] font-bold bg-primary text-black rounded-full">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="text-sm text-[#D3BC8D] hover:underline flex items-center gap-1"
            >
              {markAllRead.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Mark all read
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5 border-b border-border mb-4">
          {(["all", "unread"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-t-md border-b-2 -mb-px transition-colors capitalize",
                filter === f
                  ? "border-[#B8860B] text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {f}
              {f === "unread" && unreadCount > 0 && (
                <span className="ml-1.5 text-[11px] text-muted-foreground">{unreadCount}</span>
              )}
            </button>
          ))}
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-7 h-7 animate-spin text-[#D3BC8D]" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {filter === "unread" ? "No unread notifications." : "No notifications."}
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={cn(
                  "w-full text-left px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors",
                  !n.isRead && "bg-muted/20",
                )}
              >
                <div className="flex items-start gap-2.5">
                  {!n.isRead && <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />}
                  <div className={cn("flex-1 min-w-0", n.isRead && "ml-[18px]")}>
                    <p className="text-sm font-medium text-foreground">{n.title}</p>
                    {n.message && <p className="text-xs text-muted-foreground mt-0.5 break-words">{n.message}</p>}
                    <p className="text-[11px] text-muted-foreground mt-1">{formatTime(n.createdAt)}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {all.length >= 100 && (
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Showing the 100 most recent notifications.
          </p>
        )}
      </div>
      <ClientPageLinks />
      <AdminPageLinks />
    </AdminLayout>
  );
}
