import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, buildApiUrl } from "@/lib/queryClient";

export interface RoleLite {
  id: number;
  name: string;
  isAdmin?: boolean;
  isEmployee?: boolean;
  isClient?: boolean;
}

/**
 * Lets an admin choose which roles a user can switch between with the same
 * login. Used so an admin can be their own client/employee, or a client can
 * also act as an employee, all with one set of credentials.
 */
export function SwitchableRolesSection({
  userId,
  roles,
  onSaved,
  title = "Switch account access",
  description = "Allow this user to switch between these roles using the same login (no separate emails). Useful so admins can also act as a client/employee, or a client as an employee.",
}: {
  userId: number;
  roles: RoleLite[];
  onSaved?: () => void;
  title?: string;
  description?: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const { data: rolesData, isLoading } = useQuery({
    queryKey: ["/api/admin/users", userId, "roles"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/admin/users/${userId}/roles`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      return json as { roles: { id: number; name: string }[] };
    },
    enabled: !!userId && roles.length > 0,
  });

  useEffect(() => {
    if (rolesData?.roles?.length) {
      setSelectedIds(rolesData.roles.map((r) => r.id));
    } else if (roles.length > 0) {
      setSelectedIds([]);
    }
  }, [rolesData?.roles, roles.length]);

  const saveMutation = useMutation({
    mutationFn: async (roleIds: number[]) => {
      const res = await apiRequest(
        "PUT",
        `/api/admin/users/${userId}/roles`,
        { roleIds }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to save");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/users", userId, "roles"],
      });
      onSaved?.();
      toast({ title: "Saved", description: "Switch account access updated." });
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggle = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  if (roles.length === 0) return null;

  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <Label className="text-muted-foreground text-sm">{title}</Label>
      <p className="text-xs text-muted-foreground">{description}</p>

      {isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Loading current roles...
        </div>
      ) : (
        <div className="flex flex-wrap gap-4 pt-1">
          {roles.map((role) => (
            <div key={role.id} className="flex items-center space-x-2">
              <Checkbox
                id={`switch-role-${userId}-${role.id}`}
                checked={selectedIds.includes(role.id)}
                onCheckedChange={() => toggle(role.id)}
              />
              <label
                htmlFor={`switch-role-${userId}-${role.id}`}
                className="text-sm font-medium leading-none cursor-pointer"
              >
                {role.name}
              </label>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => saveMutation.mutate(selectedIds)}
        disabled={saveMutation.isPending}
      >
        {saveMutation.isPending && (
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
        )}
        Update switchable roles
      </Button>
    </div>
  );
}
