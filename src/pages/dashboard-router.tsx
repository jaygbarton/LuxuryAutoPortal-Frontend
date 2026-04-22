/**
 * DashboardRouter
 *
 * Smart router for /dashboard — shows:
 *   - Admin dashboard  (isAdmin === true)
 *   - Client dashboard (isClient === true)
 *   - Redirects to /admin/login if unauthenticated
 */

import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import AdminDashboard from "@/pages/admin/dashboard";
import ClientDashboardPage from "@/pages/client/dashboard";
import { buildApiUrl } from "@/lib/queryClient";

interface AuthMe {
  user?: {
    id?: number;
    email?: string;
    isAdmin?: boolean;
    isClient?: boolean;
    isEmployee?: boolean;
  };
}

export default function DashboardRouter() {
  const [, setLocation] = useLocation();

  const { data, isLoading } = useQuery<AuthMe>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/auth/me"), { credentials: "include" });
      if (!res.ok) return { user: undefined };
      return res.json();
    },
    retry: false,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-card flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#D3BC8D]" />
      </div>
    );
  }

  const user = data?.user;

  if (!user) {
    setLocation("/admin/login");
    return null;
  }

  if (user.isAdmin) {
    return <AdminDashboard />;
  }

  if (user.isClient) {
    return <ClientDashboardPage />;
  }

  // Staff/employee — send to staff dashboard
  setLocation("/staff/dashboard");
  return null;
}
