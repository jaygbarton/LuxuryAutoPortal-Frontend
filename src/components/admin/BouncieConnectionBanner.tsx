import { useQuery } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { ShieldAlert, RefreshCw, Unplug } from "lucide-react";

interface ConnectionStatus {
  connected: boolean;
  expiresAt: string | null;
  isExpired: boolean;
  expiresInMinutes: number | null;
  source: "database" | "none";
  hasRefreshToken: boolean;
}

export function BouncieConnectionBanner() {
  const { data, isLoading, isError } = useQuery<{ success: boolean; data: ConnectionStatus }>({
    queryKey: ["/api/bouncie/connection-status"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/bouncie/connection-status"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to check connection status");
      return res.json();
    },
    refetchInterval: 60000,
    staleTime: 30000,
    retry: 1,
  });

  const conn = data?.data;
  const isConnected = conn?.connected === true && conn.source === "database";
  const needsConnect = !isLoading && !isConnected;
  const isExpired = conn?.isExpired === true || isError;

  if (isLoading || !needsConnect) return null;

  const handleConnect = () => {
    window.location.href = buildApiUrl("/api/bouncie/connect");
  };

  return (
    <button onClick={handleConnect}
      className="w-full flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors border
        bg-amber-500/10 border-amber-500/25 text-amber-200 hover:bg-amber-500/20 dark:bg-amber-500/10 dark:border-amber-500/25">
      {isExpired
        ? <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0" />
        : <Unplug className="w-4 h-4 text-amber-400 flex-shrink-0" />}
      <span className="flex-1 text-left">
        {isExpired ? "Bouncie session expired — tracking paused" : "Bouncie not connected"}
      </span>
      <span className="flex items-center gap-1 text-amber-400 font-semibold whitespace-nowrap text-xs">
        <RefreshCw className="w-3 h-3" />
        {isExpired ? "Reconnect" : "Connect"}
      </span>
    </button>
  );
}
