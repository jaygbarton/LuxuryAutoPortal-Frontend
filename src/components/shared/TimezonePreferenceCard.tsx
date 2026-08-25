/**
 * Lets a user pick their own timezone. Everything they view elsewhere in the
 * app (dates, times, day-bucketed lists) follows this preference — see
 * use-timezone.ts. Mounted on the account settings page for every role.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { buildApiUrl } from "@/lib/queryClient";
import { ORG_TIMEZONE_FALLBACK } from "@/hooks/use-timezone";
import { Check, ChevronsUpDown, Globe, Loader2, Save } from "lucide-react";
import { cn } from "@/lib/utils";

interface PreferencesResponse {
  success: boolean;
  timezone: string | null;
  effectiveTimezone: string;
}

/** Distinguishes "no pending change" from an explicit choice of the org
 *  default, which is itself represented as `timezone: null`. */
const UNTOUCHED = Symbol("untouched");
const ORG_DEFAULT_VALUE = "__org_default__";

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
  const [selected, setSelected] = useState<string | null | typeof UNTOUCHED>(UNTOUCHED);
  const [open, setOpen] = useState(false);

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

  const current = selected === UNTOUCHED ? data?.timezone ?? null : selected;
  const effective = current ?? ORG_TIMEZONE_FALLBACK;
  const isOrgDefault = current === null;
  const hasPendingChange = selected !== UNTOUCHED;

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
      setSelected(UNTOUCHED);
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
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between bg-background border-border text-foreground hover:bg-background hover:text-foreground font-normal"
                  >
                    <span className="truncate">
                      {isOrgDefault
                        ? `Organization default (${ORG_TIMEZONE_FALLBACK})`
                        : timezoneLabel(effective)}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[--radix-popover-trigger-width] p-0 bg-card border-border"
                  align="start"
                >
                  <Command className="bg-card">
                    <CommandInput
                      placeholder="Search timezones…"
                      className="text-foreground placeholder:text-muted-foreground border-b border-border"
                    />
                    <CommandList className="max-h-[280px]">
                      <CommandEmpty className="text-muted-foreground py-4 text-sm text-center px-2">
                        No timezone found.
                      </CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value={ORG_DEFAULT_VALUE}
                          onSelect={() => {
                            setSelected(null);
                            setOpen(false);
                          }}
                          className="text-foreground data-[selected=true]:bg-primary/20 data-[selected=true]:text-foreground cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4 shrink-0",
                              isOrgDefault ? "opacity-100 text-primary" : "opacity-0"
                            )}
                          />
                          Organization default ({ORG_TIMEZONE_FALLBACK})
                        </CommandItem>
                        {zones.map((tz) => (
                          <CommandItem
                            key={tz}
                            value={timezoneLabel(tz)}
                            onSelect={() => {
                              setSelected(tz);
                              setOpen(false);
                            }}
                            className="text-foreground data-[selected=true]:bg-primary/20 data-[selected=true]:text-foreground cursor-pointer"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4 shrink-0",
                                !isOrgDefault && effective === tz ? "opacity-100 text-primary" : "opacity-0"
                              )}
                            />
                            {timezoneLabel(tz)}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <Button
              onClick={() => saveMutation.mutate(current)}
              disabled={saveMutation.isPending || !hasPendingChange}
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
