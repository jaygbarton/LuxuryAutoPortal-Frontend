/**
 * Referral Form Submission
 * Clients submit a referral. The current logged-in user is the default referrer,
 * but admins can search and select any client as the referrer.
 */

import { useState, useRef, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, Users, Search } from "lucide-react";

interface ClientOption {
  id: number;
  name: string;
  email: string;
}

function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const update = useCallback(
    (v: T) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setDebounced(v), delay);
    },
    [delay],
  );
  useState(() => {
    update(value);
  });
  return debounced;
}

export default function ReferralFormSubmission() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    rf_date: new Date().toISOString().slice(0, 10),
    rf_referral_first_name: "",
    rf_referral_last_name: "",
    rf_referral_phone_number: "",
    rf_referral_email_address: "",
  });

  // Referrer Name search state
  const [referrerSearch, setReferrerSearch] = useState("");
  const [referrerDropdownOpen, setReferrerDropdownOpen] = useState(false);
  const [selectedReferrer, setSelectedReferrer] = useState<ClientOption | null>(
    null,
  );
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [submitted, setSubmitted] = useState(false);

  const { data: currentUserData } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/auth/me"), {
        credentials: "include",
      });
      if (!res.ok) return null;
      return res.json();
    },
  });

  // Clients shouldn't be able to pick someone else as the referrer — that's an
  // info leak (it exposes the full client roster) and a fraud vector. Only
  // admins get the searchable dropdown; clients see their own name, read-only.
  const isAdminUser = Boolean(currentUserData?.user?.isAdmin);

  const { data: searchData, isFetching: isSearching } = useQuery({
    queryKey: ["/api/referral-forms/client-search", debouncedSearch],
    queryFn: async () => {
      const res = await fetch(
        buildApiUrl(
          `/api/referral-forms/client-search?q=${encodeURIComponent(debouncedSearch)}`,
        ),
        { credentials: "include" },
      );
      if (!res.ok) return null;
      return res.json();
    },
    enabled: isAdminUser && referrerDropdownOpen,
  });

  const clients: ClientOption[] = searchData?.data ?? [];

  const handleReferrerInput = (val: string) => {
    setReferrerSearch(val);
    setReferrerDropdownOpen(true);
    if (!val) setSelectedReferrer(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(val), 300);
  };

  const selectReferrer = (client: ClientOption) => {
    setSelectedReferrer(client);
    setReferrerSearch(client.name);
    setReferrerDropdownOpen(false);
  };

  const displayedReferrerValue = referrerDropdownOpen
    ? referrerSearch
    : selectedReferrer
      ? selectedReferrer.name
      : referrerSearch;

  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        ...form,
        ...(selectedReferrer && {
          rf_referrer_client_id: selectedReferrer.id,
          rf_referrer_name: selectedReferrer.name,
          rf_referrer_email: selectedReferrer.email,
        }),
      };
      const res = await fetch(buildApiUrl("/api/referral-forms"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to submit");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referral-forms/my"] });
      setSubmitted(true);
      toast({
        title: "Referral submitted!",
        description: "Your referral has been submitted for review.",
      });
    },
    onError: (err: Error) =>
      toast({
        title: "Submission failed",
        description: err.message,
        variant: "destructive",
      }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.rf_date)
      return toast({ title: "Date required", variant: "destructive" });
    if (!form.rf_referral_first_name.trim())
      return toast({
        title: "Referral first name required",
        variant: "destructive",
      });
    if (!form.rf_referral_last_name.trim())
      return toast({
        title: "Referral last name required",
        variant: "destructive",
      });
    if (!form.rf_referral_phone_number.trim())
      return toast({
        title: "Referral phone required",
        variant: "destructive",
      });
    if (!form.rf_referral_email_address.trim())
      return toast({
        title: "Referral email required",
        variant: "destructive",
      });
    if (!/^\S+@\S+\.\S+$/.test(form.rf_referral_email_address.trim()))
      return toast({ title: "Invalid referral email", variant: "destructive" });
    submitMutation.mutate();
  };

  const handleReset = () => {
    setForm({
      rf_date: new Date().toISOString().slice(0, 10),
      rf_referral_first_name: "",
      rf_referral_last_name: "",
      rf_referral_phone_number: "",
      rf_referral_email_address: "",
    });
    setReferrerSearch("");
    setSelectedReferrer(null);
    setReferrerDropdownOpen(false);
    setSubmitted(false);
  };

  if (submitted) {
    return (
      <Card className="border-primary/20">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <CheckCircle className="h-12 w-12 text-green-500" />
          <h3 className="text-lg font-semibold text-primary">
            Referral Submitted Successfully
          </h3>
          <p className="text-sm text-muted-foreground text-center">
            Your referral has been submitted and is pending review by an admin.
            You will be notified once it has been approved or declined.
          </p>
          <Button variant="outline" onClick={handleReset}>
            Submit Another
          </Button>
        </CardContent>
      </Card>
    );
  }

  const sessionName = [
    currentUserData?.user?.firstName,
    currentUserData?.user?.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const referrerEmailDisplay =
    selectedReferrer?.email || currentUserData?.user?.email || "";

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-primary flex items-center gap-2">
          <Users className="h-5 w-5" />
          Referral Form
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          We pay $100 to you when someone signs up for our List Your Car program
          and lists a car with us!
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="rf_date">
              Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="rf_date"
              type="date"
              value={form.rf_date}
              onChange={(e) =>
                setForm((p) => ({ ...p, rf_date: e.target.value }))
              }
              required
            />
          </div>

          <p className="text-sm font-medium text-foreground">
            Who are you referring to Golden Luxury Auto?
          </p>

          {/* Referral person */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="rf_referral_first_name">
                Referral First Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="rf_referral_first_name"
                value={form.rf_referral_first_name}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    rf_referral_first_name: e.target.value,
                  }))
                }
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rf_referral_last_name">
                Referral Last Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="rf_referral_last_name"
                value={form.rf_referral_last_name}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    rf_referral_last_name: e.target.value,
                  }))
                }
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rf_referral_phone_number">
              Referral Phone Number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="rf_referral_phone_number"
              type="tel"
              value={form.rf_referral_phone_number}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  rf_referral_phone_number: e.target.value,
                }))
              }
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rf_referral_email_address">
              Referral Email Address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="rf_referral_email_address"
              type="email"
              value={form.rf_referral_email_address}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  rf_referral_email_address: e.target.value,
                }))
              }
              required
            />
          </div>

          {/* Referrer Name — admins can search and pick any client; clients see only themselves. */}
          {isAdminUser ? (
            <div className="relative space-y-1.5">
              <Label>
                Referrer Name{" "}
                <span className="text-xs text-muted-foreground font-normal">
                  (leave blank to use your own name)
                </span>
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  className="pl-9"
                  placeholder={sessionName || "Search by name or email…"}
                  value={displayedReferrerValue}
                  onChange={(e) => handleReferrerInput(e.target.value)}
                  onFocus={() => setReferrerDropdownOpen(true)}
                  onBlur={() =>
                    setTimeout(() => setReferrerDropdownOpen(false), 160)
                  }
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {referrerEmailDisplay && (
                <p className="text-xs text-muted-foreground pl-1">
                  Email:{" "}
                  <span className="font-medium">{referrerEmailDisplay}</span>
                </p>
              )}
              {referrerDropdownOpen && (
                <div className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-md border border-border bg-background shadow-lg">
                  {clients.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      {isSearching
                        ? "Searching…"
                        : debouncedSearch
                          ? "No clients found."
                          : "Type to search clients…"}
                    </div>
                  ) : (
                    clients.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full px-4 py-2.5 text-left hover:bg-primary/10 transition-colors"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selectReferrer(c);
                        }}
                      >
                        <span className="text-sm font-medium text-foreground">
                          {c.name}
                        </span>
                        {c.email && (
                          <span className="text-xs text-muted-foreground ml-2">
                            {c.email}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>
                Referrer Name{" "}
                <span className="text-muted-foreground text-xs">
                  (leave blank to use your own name)
                </span>
              </Label>
              <Input
                value={sessionName || ""}
                readOnly
                className="mt-1 opacity-80 bg-muted cursor-default"
                placeholder="Your name"
              />
              {referrerEmailDisplay && (
                <p className="text-xs text-muted-foreground pl-1">
                  Email:{" "}
                  <span className="font-medium">{referrerEmailDisplay}</span>
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleReset}>
              Clear
            </Button>
            <Button
              type="submit"
              disabled={submitMutation.isPending}
              className="min-w-[140px]"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Submitting…
                </>
              ) : (
                "Submit Referral"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
