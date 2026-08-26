import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, List, Loader2, Pencil, RefreshCw, X } from "lucide-react";

interface CoHost {
  id: number;
  co_host_number: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  email: string;
  birthday: string | null;
  marital_status: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zip_code: string | null;
  mobile_number: string | null;
  telephone: string | null;
  mother_name: string | null;
  father_name: string | null;
  home_contact: string | null;
  home_address: string | null;
  emergency_contact_person: string | null;
  emergency_relationship: string | null;
  emergency_address: string | null;
  emergency_number: string | null;
  ssn_ein: string | null;
  ssn_ein_last4?: string | null;
  shirt_size: string | null;
}

/** Co-host-editable fields — deliberately excludes email. */
type ProfileEditForm = {
  first_name: string;
  middle_name: string;
  last_name: string;
  birthday: string;
  marital_status: string;
  street: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  mobile_number: string;
  telephone: string;
  shirt_size: string;
  mother_name: string;
  father_name: string;
  home_contact: string;
  home_address: string;
  emergency_contact_person: string;
  emergency_relationship: string;
  emergency_number: string;
  emergency_address: string;
};

function toForm(coHost: CoHost): ProfileEditForm {
  return {
    first_name: coHost.first_name ?? "",
    middle_name: coHost.middle_name ?? "",
    last_name: coHost.last_name ?? "",
    birthday: coHost.birthday ?? "",
    marital_status: coHost.marital_status ?? "",
    street: coHost.street ?? "",
    city: coHost.city ?? "",
    state: coHost.state ?? "",
    zip_code: coHost.zip_code ?? "",
    country: coHost.country ?? "",
    mobile_number: coHost.mobile_number ?? "",
    telephone: coHost.telephone ?? "",
    shirt_size: coHost.shirt_size ?? "",
    mother_name: coHost.mother_name ?? "",
    father_name: coHost.father_name ?? "",
    home_contact: coHost.home_contact ?? "",
    home_address: coHost.home_address ?? "",
    emergency_contact_person: coHost.emergency_contact_person ?? "",
    emergency_relationship: coHost.emergency_relationship ?? "",
    emergency_number: coHost.emergency_number ?? "",
    emergency_address: coHost.emergency_address ?? "",
  };
}

function unspecified(val: string | null | undefined): string {
  return (val ?? "").trim() || "Unspecified";
}

export default function CoHostProfilePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<ProfileEditForm | null>(null);

  const { data: res, isLoading, error } = useQuery<{ success: boolean; data: CoHost }>({
    queryKey: ["/api/me/co-host"],
    queryFn: async () => {
      const r = await fetch(buildApiUrl("/api/me/co-host"), { credentials: "include" });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load your co-host profile");
      }
      return r.json();
    },
  });

  const coHost = res?.data;

  const updateMutation = useMutation({
    mutationFn: async (input: ProfileEditForm) => {
      const r = await fetch(buildApiUrl("/api/me/co-host"), {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || err.message || "Failed to update profile");
      }
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Profile updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/me/co-host"] });
      setIsEditing(false);
      setForm(null);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  if (isLoading || !res) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (error || !coHost) {
    const errorMessage = error instanceof Error ? error.message : null;
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-primary">My Profile</h1>
            <p className="text-muted-foreground">Your co-host profile information.</p>
          </div>
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="font-semibold text-foreground">We couldn&apos;t load your profile.</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {errorMessage || "You may not have a co-host record linked to this account."}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/me/co-host"] })}
                    className="border-primary/30 text-primary hover:bg-primary/10"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try again
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  const startEditing = () => {
    setForm(toForm(coHost));
    setIsEditing(true);
  };
  const cancelEditing = () => {
    setIsEditing(false);
    setForm(null);
  };
  const setField = (key: keyof ProfileEditForm, value: string) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };
  const field = (key: keyof ProfileEditForm, type: string = "text") =>
    isEditing && form ? (
      <li>
        <Input type={type} value={form[key]} onChange={(e) => setField(key, e.target.value)} className="h-8 text-sm" />
      </li>
    ) : (
      <li>{unspecified(coHost[key as keyof CoHost] as string)}</li>
    );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-primary">My Profile</h1>
          <p className="text-muted-foreground">Your co-host profile information.</p>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 text-sm xl:items-stretch">
          <Card className="bg-card border-border xl:h-full flex flex-col">
            <CardContent className="p-4">
              <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <List className="h-4 w-4 text-primary" />
                  <span className="font-bold uppercase text-[13px] text-primary">Basic Information</span>
                </div>
                {!isEditing ? (
                  <Button type="button" variant="outline" size="sm" className="border-border" onClick={startEditing}>
                    <Pencil className="h-3.5 w-3.5 mr-1.5" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-border"
                      onClick={cancelEditing}
                      disabled={updateMutation.isPending}
                    >
                      <X className="h-3.5 w-3.5 mr-1.5" />
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => form && updateMutation.mutate(form)}
                      disabled={updateMutation.isPending}
                    >
                      {updateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                      Save
                    </Button>
                  </div>
                )}
              </div>
              <div className="mt-3">
                <ul className="grid grid-cols-[150px,1fr] md:grid-cols-[200px,1fr] gap-x-4 gap-y-1 text-muted-foreground items-center">
                  <li className="font-bold text-foreground">First Name:</li>{field("first_name")}
                  <li className="font-bold text-foreground">Middle Name:</li>{field("middle_name")}
                  <li className="font-bold text-foreground">Last Name:</li>{field("last_name")}
                  <li className="font-bold text-foreground">Birth Date:</li>{field("birthday", "date")}
                  <li className="font-bold text-foreground">Marital Status:</li>{field("marital_status")}
                  {/* Server returns this already masked (last 4 only) — not editable. */}
                  <li className="font-bold text-foreground">Social Security Number or EIN:</li><li className="font-mono">{unspecified(coHost.ssn_ein)}</li>
                  <li className="font-bold text-foreground">Street:</li>{field("street")}
                  <li className="font-bold text-foreground">City:</li>{field("city")}
                  <li className="font-bold text-foreground">State:</li>{field("state")}
                  <li className="font-bold text-foreground">Zip Code:</li>{field("zip_code")}
                  <li className="font-bold text-foreground">Country:</li>{field("country")}
                  <li className="font-bold text-foreground">Mobile Number:</li>{field("mobile_number")}
                  <li className="font-bold text-foreground">Telephone Number:</li>{field("telephone")}
                  {/* Email is intentionally NOT editable by the co-host. */}
                  <li className="font-bold text-foreground">Email:</li><li className="break-words">{unspecified(coHost.email)}</li>
                  <li className="font-bold text-foreground">Shirt Size:</li>{field("shirt_size")}
                </ul>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <List className="h-4 w-4 text-primary" />
                  <span className="font-bold uppercase text-[13px] text-primary">Family Information</span>
                </div>
              </div>
              <div className="mt-3">
                <ul className="grid grid-cols-[150px,1fr] md:grid-cols-[200px,1fr] gap-x-4 gap-y-1 text-muted-foreground items-center">
                  <li className="font-bold text-foreground">Mother&apos;s First Name:</li>{field("mother_name")}
                  <li className="font-bold text-foreground">Father&apos;s First Name:</li>{field("father_name")}
                  <li className="font-bold text-foreground">Home Contact:</li>{field("home_contact")}
                  <li className="font-bold text-foreground">Family Home Address:</li>{field("home_address")}
                </ul>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
                <div className="flex items-center gap-2">
                  <List className="h-4 w-4 text-primary" />
                  <span className="font-bold uppercase text-[13px] text-primary">Emergency Contact</span>
                </div>
              </div>
              <div className="mt-3">
                <ul className="grid grid-cols-[150px,1fr] md:grid-cols-[200px,1fr] gap-x-4 gap-y-1 text-muted-foreground items-center">
                  <li className="font-bold text-foreground">Name:</li>{field("emergency_contact_person")}
                  <li className="font-bold text-foreground">Relationship:</li>{field("emergency_relationship")}
                  <li className="font-bold text-foreground">Number:</li>{field("emergency_number")}
                  <li className="font-bold text-foreground">Address:</li>{field("emergency_address")}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
