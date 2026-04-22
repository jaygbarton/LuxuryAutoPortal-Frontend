import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { LayoutDashboard } from "lucide-react";

export default function StaffDashboard() {
  const { data: userData } = useQuery<{ user?: { firstName?: string; lastName?: string } }>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const response = await fetch(buildApiUrl("/api/auth/me"), { credentials: "include" });
      if (!response.ok) return { user: undefined };
      return response.json();
    },
    retry: false,
  });
  const name = userData?.user ? `${userData.user.firstName || ""} ${userData.user.lastName || ""}`.trim() || "Staff" : "Staff";

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#d3bc8d]">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {name}.</p>
        </div>
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#d3bc8d]">
              <LayoutDashboard className="w-5 h-5" />
              Staff Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            <p>Use the sidebar to access My Info, Forms, Time, and other staff resources.</p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
