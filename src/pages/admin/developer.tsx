import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";
import { PUBLIC_PAGES, type PublicPageDefinition } from "@/lib/public-pages";
import { buildApiUrl } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/hooks/use-toast";

type PageStatus = {
  path: string;
  isPublic: boolean;
  updatedAt?: string | null;
};

export default function DeveloperPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pendingPage, setPendingPage] = useState<PublicPageDefinition | null>(null);
  const [pendingIsPublic, setPendingIsPublic] = useState(false);

  const { data, isLoading } = useQuery<{ pages: PageStatus[] }>({
    queryKey: ["/api/developer/public-pages"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/developer/public-pages"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Failed to load page board (${res.status})`);
      return res.json();
    },
  });

  const statusByPath = useMemo(() => {
    const map = new Map<string, PageStatus>();
    for (const status of data?.pages || []) {
      map.set(status.path, status);
    }
    return map;
  }, [data]);

  const groupedPages = useMemo(() => {
    return PUBLIC_PAGES.reduce<Record<string, PublicPageDefinition[]>>((groups, page) => {
      if (!groups[page.group]) groups[page.group] = [];
      groups[page.group].push(page);
      return groups;
    }, {});
  }, []);

  const updateVisibility = useMutation({
    mutationFn: async ({ path, isPublic }: { path: string; isPublic: boolean }) => {
      const res = await fetch(buildApiUrl("/api/developer/public-pages"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ path, isPublic }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Failed to update page visibility");
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/developer/public-pages"] });
      toast({ title: "Page visibility updated" });
    },
    onError: (error: any) => {
      toast({
        title: "Could not update page",
        description: error?.message || "Try again in a moment.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setPendingPage(null);
    },
  });

  const openConfirm = (page: PublicPageDefinition, nextIsPublic: boolean) => {
    setPendingPage(page);
    setPendingIsPublic(nextIsPublic);
  };

  const confirmChange = () => {
    if (!pendingPage) return;
    updateVisibility.mutate({ path: pendingPage.path, isPublic: pendingIsPublic });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Developer</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Control which public frontend pages are visible while new pages are being built.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Public Page Board</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading pages
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedPages).map(([group, pages]) => (
                <section key={group} className="space-y-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {group}
                  </h2>
                  <div className="divide-y rounded-md border">
                    {pages.map((page) => {
                      const status = statusByPath.get(page.path);
                      const isPublic = status?.isPublic ?? true;
                      const previewUrl = `${page.path}${page.path.includes("?") ? "&" : "?"}devPreview=1`;
                      return (
                        <div
                          key={page.path}
                          className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_auto] md:items-center"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{page.label}</p>
                              <Badge variant={isPublic ? "default" : "secondary"}>
                                {isPublic ? "Live" : "Developer only"}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{page.path}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <Button variant="outline" size="sm" asChild>
                              <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Preview
                              </a>
                            </Button>
                            <Switch
                              checked={isPublic}
                              onCheckedChange={(checked) => openConfirm(page, checked)}
                              aria-label={`Toggle ${page.label} public visibility`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingPage} onOpenChange={(open) => !open && setPendingPage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingIsPublic ? "Make this page live?" : "Take this page down?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingIsPublic
                ? `${pendingPage?.label} will be visible on the public frontend.`
                : `${pendingPage?.label} will show "Page Under Maintenance" publicly, while super admins can still preview it from Developer.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateVisibility.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmChange} disabled={updateVisibility.isPending}>
              {updateVisibility.isPending ? "Updating..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
