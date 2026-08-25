/**
 * Lets a user pick their own timezone. Everything they view elsewhere in the
 * app (dates, times, day-bucketed lists) follows this preference — see
 * use-timezone.ts. Mounted on the account settings page for every role.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/lib/queryClient";
import { ORG_TIMEZONE_FALLBACK } from "@/hooks/use-timezone";
import { Globe, Loader2, Save } from "lucide-react";

interface PreferencesResponse {
  success: boolean;
  timezone: string | null;
  effectiveTimezone: string;
}

function timezoneLabel(tz: string): string {
  try {
    const offset = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value;
    return offset ? `${tz} (${offset})` : tz;
  } catch {
    return tz;
  }
}

export function TimezonePreferenceCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  const zones = useMemo(() => {
    const list =
      typeof Intl.supportedValuesOf === "function"
        ? Intl.supportedValuesOf("timeZone")
        : [ORG_TIMEZONE_FALLBACK];
    return [...new Set(["UTC", ...list])].sort();
  }, []);

  const { data, isLoading } = useQuery<PreferencesResponse>({
    queryKey: ["/api/me/preferences"],
    queryFn: async () => {
      const r = await fetch(buildApiUrl("/api/me/preferences"), { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load preferences");
      return r.json();
    },
  });

  const current = selected ?? data?.timezone ?? null;
  const effective = current ?? ORG_TIMEZONE_FALLBACK;
  const isOrgDefault = current === null;

  const saveMutation = useMutation({
    mutationFn: async (timezone: string | null) => {
      const r = await fetch(buildApiUrl("/api/me/preferences"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ timezone }),
      });
      const json = await r.json().catch(() => null);
      if (!r.ok || !json?.success) throw new Error(json?.message || `HTTP ${r.status}`);
      return json as PreferencesResponse;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/me/preferences"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] }),
      ]);
      setSelected(null);
      toast({ title: "Timezone updated" });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not update timezone",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Card className="bg-card border-primary/20">
      <CardHeader>
        <CardTitle className="text-primary flex items-center gap-2">
          <Globe className="w-5 h-5" />
          Timezone
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Dates and times across the app are shown in this timezone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Select
                value={isOrgDefault ? "__org_default__" : effective}
                onValueChange={(v) => setSelected(v === "__org_default__" ? null : v)}
              >
                <SelectTrigger className="bg-background border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="__org_default__">
                    Organization default ({ORG_TIMEZONE_FALLBACK})
                  </SelectItem>
                  {zones.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {timezoneLabel(tz)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => saveMutation.mutate(current)}
              disabled={saveMutation.isPending || selected === null}
              className="gap-2"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
