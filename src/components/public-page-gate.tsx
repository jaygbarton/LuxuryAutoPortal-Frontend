import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { buildApiUrl } from "@/lib/queryClient";
import { publicPageLabel } from "@/lib/public-pages";

interface PublicPageGateProps {
  path: string;
  children: ReactNode;
}

function MaintenancePage({ path }: { path: string }) {
  return (
    <div className="min-h-screen bg-[#0f0f10] text-white flex items-center justify-center px-6">
      <div className="max-w-xl text-center">
        <p className="text-sm uppercase tracking-[0.24em] text-[#d3bc8d] mb-4">
          Golden Luxury Auto
        </p>
        <h1 className="text-4xl font-semibold mb-4">Page Under Maintenance</h1>
        <p className="text-white/70 leading-7">
          {publicPageLabel(path)} is being updated right now. Please check back shortly.
        </p>
      </div>
    </div>
  );
}

export function PublicPageGate({ path, children }: PublicPageGateProps) {
  const isDeveloperPreview =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("devPreview") === "1";

  const { data, isLoading, isError } = useQuery<{
    path: string;
    isPublic: boolean;
    canPreview: boolean;
  }>({
    queryKey: ["/api/public-page-status", path],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/public-page-status?path=${encodeURIComponent(path)}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`public-page-status failed: ${res.status}`);
      return res.json();
    },
    staleTime: 1000 * 30,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || data?.isPublic || (isDeveloperPreview && data?.canPreview)) {
    return <>{children}</>;
  }

  return <MaintenancePage path={path} />;
}
