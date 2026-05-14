import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionHeader } from "@/components/admin/dashboard/SectionHeader";
import { StatusBadge } from "./StatusBadge";
import { PhotoUpload } from "./PhotoUpload";
import { useToast } from "@/hooks/use-toast";
import { RotateCcw } from "lucide-react";
import type { Inspection } from "./types";

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return "--";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
};

export function NoCarIssuesTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ data: Inspection[] }>({
    queryKey: ["/api/operations/inspections", "no_issues"],
    queryFn: async () => {
      const response = await fetch(buildApiUrl(`/api/operations/inspections?status=no_issues`), { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch inspections");
      return response.json();
    },
  });

  const inspections = data?.data || [];

  const reopenMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(buildApiUrl(`/api/operations/inspections/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "in_progress" }),
      });
      if (!response.ok) throw new Error("Failed to reopen inspection");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operations/inspections"] });
      toast({ title: "Success", description: "Inspection reopened" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <SectionHeader title="No Car Issues" subtitle="Inspections that were resolved without requiring maintenance." variant="plain" />

      <div className="bg-card border border-border rounded-lg overflow-auto">
        <div className="p-4">
          <div className="flex items-center mb-4">
            <div className="ml-auto text-muted-foreground text-sm">Total: {inspections.length}</div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-foreground font-medium">Car</TableHead>
                  <TableHead className="text-foreground font-medium">Source</TableHead>
                  <TableHead className="text-foreground font-medium">Assigned To</TableHead>
                  <TableHead className="text-foreground font-medium">Status</TableHead>
                  <TableHead className="text-foreground font-medium">Inspection Date</TableHead>
                  <TableHead className="text-foreground font-medium">Notes</TableHead>
                  <TableHead className="text-foreground font-medium">Photos</TableHead>
                  <TableHead className="text-center text-foreground font-medium">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">Loading...</TableCell>
                  </TableRow>
                ) : inspections.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No resolved inspections yet</TableCell>
                  </TableRow>
                ) : (
                  inspections.map((insp) => (
                    <TableRow key={insp.id} className="border-border hover:bg-card/50 transition-colors">
                      <TableCell className="text-foreground">{insp.car_name}</TableCell>
                      <TableCell className="text-muted-foreground capitalize text-sm">{insp.source?.replace(/_/g, " ") || "--"}</TableCell>
                      <TableCell className="text-foreground">{insp.assigned_to}</TableCell>
                      <TableCell><StatusBadge status={insp.status} /></TableCell>
                      <TableCell className="text-muted-foreground text-sm">{formatDate(insp.inspection_date)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate" title={insp.notes || undefined}>{insp.notes || "--"}</TableCell>
                      <TableCell>
                        {insp.photos && insp.photos.length > 0 ? (
                          <PhotoUpload photos={insp.photos} onPhotosChange={() => {}} entityType="inspection" entityId={insp.id} disabled />
                        ) : (
                          <span className="text-muted-foreground text-sm">--</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => reopenMutation.mutate(insp.id)}
                            className="text-muted-foreground hover:text-yellow-500 h-8 px-2"
                            title="Reopen inspection"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
