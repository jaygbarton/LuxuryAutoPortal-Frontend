import { useQuery } from "@tanstack/react-query";
import { Bot, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/lib/queryClient";

interface HubEndpoint {
  id: string;
  path: string;
  scope: string;
  summary: string;
  available: boolean;
  params?: Array<{ name: string; in: string; required?: boolean; description: string }>;
}
export interface HubIndex {
  schemaVersion: number;
  caller: { type: string; name: string; scopes: string[] };
  assistantAccess?: { keysConfigured: number };
  rules: string[];
  startHere: string[];
  endpoints: HubEndpoint[];
}

/** What an assistant is told before its first request. Built from the live index. */
export function assistantInstructions(index: HubIndex, origin: string): string {
  return [
    "You can read Golden Luxury Auto's operational records through the AI Hub.",
    `Base URL: ${origin}`,
    "Send the header `Authorization: Bearer <your AI Hub key>` on every request. The key is read-only.",
    `Start with GET ${origin}/api/ai-hub. It lists every endpoint, its parameters and what your key may read.`,
    "",
    "How to work:",
    ...index.startHere.map((step) => `- ${step}`),
    "",
    "Rules:",
    ...index.rules.map((rule) => `- ${rule}`),
    "",
    "Endpoints:",
    ...index.endpoints.map((endpoint) => `- GET ${endpoint.path} (${endpoint.scope}): ${endpoint.summary}`),
  ].join("\n");
}

export function AssistantAccess({ enabled, accessKey }: { enabled: boolean; accessKey: string }) {
  const { toast } = useToast();
  const index = useQuery<HubIndex>({
    queryKey: ["/api/ai-hub", accessKey],
    queryFn: async () => {
      const response = await fetch(buildApiUrl("/api/ai-hub"), { credentials: "include" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Assistant access details could not be loaded.");
      // An older backend, or a proxy error page, must not break the screen.
      if (!Array.isArray(data.endpoints) || !Array.isArray(data.rules) || !Array.isArray(data.startHere))
        throw new Error("Assistant access details are not available from the server yet.");
      return data;
    },
    enabled,
    retry: false,
    staleTime: 60_000,
  });
  const copy = async () => {
    if (!index.data) return;
    try {
      await navigator.clipboard.writeText(assistantInstructions(index.data, window.location.origin));
      toast({ title: "Assistant instructions copied" });
    } catch {
      toast({ title: "Copy failed", description: "Select and copy the endpoint list instead.", variant: "destructive" });
    }
  };
  const keys = index.data?.assistantAccess?.keysConfigured;
  return (
    <details className="rounded-xl border bg-white p-4" data-assistant-access>
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-base font-semibold">
        <Bot className="h-5 w-5 shrink-0" />
        Assistant access
        {keys !== undefined && (
          <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${keys > 0 ? "bg-green-100 text-green-900" : "bg-muted text-muted-foreground"}`}>
            {keys > 0 ? `${keys} assistant key${keys === 1 ? "" : "s"} set up` : "No assistant key set up"}
          </span>
        )}
      </summary>
      <div className="mt-3 space-y-3 text-sm">
        <p className="text-muted-foreground">
          AI assistants read this hub with their own read-only key. A key works only on the AI Hub, cannot change anything,
          and sees finances only if it was issued with that permission. Guest names and contact details are never included.
        </p>
        {index.isPending && enabled && <p role="status">Loading assistant access…</p>}
        {index.error && <p role="alert" className="text-amber-900">{index.error.message}</p>}
        {index.data && (
          <>
            {keys === 0 && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950">
                No assistant can connect yet. A developer creates a key with <code>npm run ai-hub:key</code> on the backend and adds it
                to the <code>AI_HUB_BOT_KEYS</code> setting on the server.
              </p>
            )}
            <ul className="divide-y rounded-lg border">
              {index.data.endpoints.map((endpoint) => (
                <li key={endpoint.id} className="min-w-0 p-3">
                  <p className="break-all font-mono text-xs">GET {endpoint.path}</p>
                  <p className="mt-1">{endpoint.summary}</p>
                  {!!endpoint.params?.length && (
                    <p className="mt-1 break-words text-xs text-muted-foreground">
                      {endpoint.params.map((param) => `${param.name}${param.required ? " (required)" : ""}`).join(" · ")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <Button type="button" variant="outline" className="min-h-11" onClick={copy}>
              <Copy className="mr-2 h-4 w-4" />
              Copy instructions for an assistant
            </Button>
          </>
        )}
      </div>
    </details>
  );
}
