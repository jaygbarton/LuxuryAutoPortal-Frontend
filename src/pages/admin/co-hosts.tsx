import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, buildApiUrl } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Search, Eye, CheckCircle, XCircle, Trash2, Loader2, ExternalLink, QrCode, Car, Save, Copy } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { QRCodeSVG } from "qrcode.react";

interface CoHost {
  id: number;
  status: "pending" | "approved" | "rejected";
  co_host_number: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  email: string;
  birthday?: string;
  marital_status?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  zip_code?: string;
  mobile_number?: string;
  telephone?: string;
  mother_name?: string;
  father_name?: string;
  home_contact?: string;
  home_address?: string;
  emergency_contact_person?: string;
  emergency_relationship?: string;
  emergency_address?: string;
  emergency_number?: string;
  ssn_ein?: string;
  shirt_size?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: string;
  vehicle_vin?: string;
  vehicle_license_plate?: string;
  turo_profile_url?: string;
  bank_account_info?: string;
  co_host_split_percent?: string;
  driver_license_file_id?: string;
  car_insurance_file_id?: string;
  vehicle_registration_file_id?: string;
  notes?: string;
  created_at: string;
}

interface FleetCar {
  id: number;
  year: string;
  make: string;
  model: string;
  vin: string;
  licensePlate: string;
  color: string;
  isActive: number;
}

function statusBadge(status: string) {
  if (status === "approved") return "bg-green-500/20 text-green-700 border-green-500/30";
  if (status === "rejected") return "bg-red-500/20 text-red-700 border-red-500/30";
  return "bg-yellow-500/20 text-yellow-700 border-yellow-500/30";
}

function driveUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

export default function CoHostsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [viewCoHost, setViewCoHost] = useState<CoHost | null>(null);
  const [approveNotes, setApproveNotes] = useState("");
  const [rejectNotes, setRejectNotes] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [selectedCarAids, setSelectedCarAids] = useState<Set<number>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ coHosts: CoHost[]; total: number }>({
    queryKey: ["/api/admin/co-hosts", statusFilter, search, page],
    queryFn: async () => {
      const params = new URLSearchParams({ status: statusFilter, page: String(page), limit: "20" });
      if (search) params.set("search", search);
      const res = await fetch(buildApiUrl(`/api/admin/co-hosts?${params}`), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch co-hosts");
      return res.json();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: number; status: string; notes?: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/co-hosts/${id}/status`, { status, notes });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed to update status"); }
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/co-hosts"] });
      toast({ title: "Success", description: `Co-host ${vars.status}.` });
      setViewCoHost(null);
      setApproveNotes("");
      setRejectNotes("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/co-hosts/${id}`);
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed to delete"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/co-hosts"] });
      toast({ title: "Deleted", description: "Co-host application removed." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // All fleet cars (for the assignment picker)
  const { data: carsData } = useQuery<{ cars: FleetCar[] }>({
    queryKey: ["/api/admin/co-hosts-cars"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/admin/co-hosts-cars"), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch cars");
      return res.json();
    },
  });

  // Assigned vehicles for the currently-open co-host
  const { data: assignedData } = useQuery<{ carAids: number[] }>({
    queryKey: ["/api/admin/co-hosts", viewCoHost?.id, "vehicles"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl(`/api/admin/co-hosts/${viewCoHost!.id}/vehicles`), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch assigned vehicles");
      return res.json();
    },
    enabled: !!viewCoHost,
  });

  // Sync selectedCarAids whenever the modal's assigned data loads/changes
  useEffect(() => {
    if (assignedData) {
      setSelectedCarAids(new Set(assignedData.carAids));
    } else {
      setSelectedCarAids(new Set());
    }
  }, [assignedData, viewCoHost?.id]);

  const saveVehiclesMutation = useMutation({
    mutationFn: async ({ id, carAids }: { id: number; carAids: number[] }) => {
      const res = await apiRequest("PUT", `/api/admin/co-hosts/${id}/vehicles`, { carAids });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed to save"); }
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/co-hosts", vars.id, "vehicles"] });
      toast({ title: "Saved", description: "Vehicle assignments updated." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function generateQr() { setShowQr(true); }

  const coHosts = data?.coHosts ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-primary">Co-Hosts</h1>
            <p className="text-muted-foreground text-sm">Manage co-host onboarding applications</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              className="border-border text-foreground"
              onClick={generateQr}
            >
              <QrCode className="w-4 h-4 mr-2" />
              QR Code
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/80"
              onClick={() => window.open("/co-host-form", "_blank")}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open Form
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or co-host #..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 bg-card border-border text-foreground"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[160px] bg-card border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border text-foreground">
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card className="bg-card border-border overflow-hidden">
          <CardContent className="p-0">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Co-Host #</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Name</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden md:table-cell">Email</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Vehicle</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Submitted</th>
                    <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                      </td>
                    </tr>
                  ) : coHosts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No co-host applications found.</td>
                    </tr>
                  ) : (
                    coHosts.map((ch) => (
                      <tr key={ch.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{ch.co_host_number || `#${ch.id}`}</td>
                        <td className="px-4 py-3 text-sm font-medium text-foreground">
                          {ch.first_name} {ch.last_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">{ch.email}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground hidden lg:table-cell">
                          <div className="text-foreground">
                            {[ch.vehicle_year, ch.vehicle_make, ch.vehicle_model].filter(Boolean).join(" ") || "—"}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Plate: {ch.vehicle_license_plate || "—"}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            VIN: {ch.vehicle_vin || "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={cn(statusBadge(ch.status), "text-xs capitalize")}>
                            {ch.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground hidden lg:table-cell">
                          {format(new Date(ch.created_at), "MMM d, yyyy")}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() => { setViewCoHost(ch); setApproveNotes(""); setRejectNotes(""); }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {ch.status === "pending" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-green-600 hover:text-green-700"
                                  disabled={updateStatusMutation.isPending}
                                  onClick={() => updateStatusMutation.mutate({ id: ch.id, status: "approved" })}
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700"
                                  disabled={updateStatusMutation.isPending}
                                  onClick={() => updateStatusMutation.mutate({ id: ch.id, status: "rejected" })}
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            <ConfirmDialog
                              trigger={
                                <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              }
                              title="Delete Co-Host Application"
                              description={`Permanently delete ${ch.first_name} ${ch.last_name}'s application? This cannot be undone.`}
                              confirmText="Delete"
                              cancelText="Cancel"
                              variant="destructive"
                              onConfirm={() => deleteMutation.mutate(ch.id)}
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <span className="text-sm text-muted-foreground">Page {page} of {totalPages} ({total} total)</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Modal */}
      {viewCoHost && (
        <Dialog open onOpenChange={() => setViewCoHost(null)}>
          <DialogContent className="bg-card border-border text-foreground max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">
                Co-Host Application — {viewCoHost.first_name} {viewCoHost.last_name}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {viewCoHost.co_host_number} · Submitted {format(new Date(viewCoHost.created_at), "MMM d, yyyy")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 mt-2 text-sm">
              <DetailSection title="Status">
                <Badge variant="outline" className={cn(statusBadge(viewCoHost.status), "capitalize")}>
                  {viewCoHost.status}
                </Badge>
              </DetailSection>

              <DetailSection title="Personal">
                <DetailGrid>
                  <DetailRow label="Full Name" value={[viewCoHost.first_name, viewCoHost.middle_name, viewCoHost.last_name].filter(Boolean).join(" ")} />
                  <DetailRow label="Email" value={viewCoHost.email} />
                  <DetailRow label="Mobile" value={viewCoHost.mobile_number} />
                  <DetailRow label="Telephone" value={viewCoHost.telephone} />
                  <DetailRow label="Birthday" value={viewCoHost.birthday} />
                  <DetailRow label="Marital Status" value={viewCoHost.marital_status} />
                  <DetailRow label="SSN / EIN" value={viewCoHost.ssn_ein} />
                  <DetailRow label="Shirt Size" value={viewCoHost.shirt_size} />
                </DetailGrid>
              </DetailSection>

              <DetailSection title="Address">
                <DetailGrid>
                  <DetailRow label="Street" value={viewCoHost.street} />
                  <DetailRow label="City" value={viewCoHost.city} />
                  <DetailRow label="State" value={viewCoHost.state} />
                  <DetailRow label="Country" value={viewCoHost.country} />
                  <DetailRow label="ZIP" value={viewCoHost.zip_code} />
                </DetailGrid>
              </DetailSection>

              <DetailSection title="Family">
                <DetailGrid>
                  <DetailRow label="Mother's Name" value={viewCoHost.mother_name} />
                  <DetailRow label="Father's Name" value={viewCoHost.father_name} />
                  <DetailRow label="Home Contact" value={viewCoHost.home_contact} />
                  <DetailRow label="Home Address" value={viewCoHost.home_address} />
                </DetailGrid>
              </DetailSection>

              <DetailSection title="Emergency Contact">
                <DetailGrid>
                  <DetailRow label="Contact Person" value={viewCoHost.emergency_contact_person} />
                  <DetailRow label="Relationship" value={viewCoHost.emergency_relationship} />
                  <DetailRow label="Contact #" value={viewCoHost.emergency_number} />
                  <DetailRow label="Address" value={viewCoHost.emergency_address} />
                </DetailGrid>
              </DetailSection>

              <DetailSection title="Vehicle">
                <DetailGrid>
                  <DetailRow label="Make" value={viewCoHost.vehicle_make} />
                  <DetailRow label="Model" value={viewCoHost.vehicle_model} />
                  <DetailRow label="Year" value={viewCoHost.vehicle_year} />
                  <DetailRow label="VIN" value={viewCoHost.vehicle_vin} />
                  <DetailRow label="License Plate" value={viewCoHost.vehicle_license_plate} />
                  <DetailRow label="Turo Profile" value={viewCoHost.turo_profile_url} />
                </DetailGrid>
              </DetailSection>

              <DetailSection title="Co-Host Agreement">
                <DetailGrid>
                  <DetailRow label="Co-Host Split %" value={viewCoHost.co_host_split_percent ? `${viewCoHost.co_host_split_percent}% (owner)` : undefined} />
                  <DetailRow label="Bank Account" value={viewCoHost.bank_account_info} />
                </DetailGrid>
              </DetailSection>

              {/* Documents */}
              {(viewCoHost.driver_license_file_id || viewCoHost.car_insurance_file_id || viewCoHost.vehicle_registration_file_id) && (
                <DetailSection title="Documents">
                  <div className="flex flex-wrap gap-2">
                    {viewCoHost.driver_license_file_id && (
                      <a href={driveUrl(viewCoHost.driver_license_file_id)} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="border-border text-foreground">
                          <ExternalLink className="w-3 h-3 mr-1" /> Driver's License
                        </Button>
                      </a>
                    )}
                    {viewCoHost.car_insurance_file_id && (
                      <a href={driveUrl(viewCoHost.car_insurance_file_id)} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="border-border text-foreground">
                          <ExternalLink className="w-3 h-3 mr-1" /> Car Insurance
                        </Button>
                      </a>
                    )}
                    {viewCoHost.vehicle_registration_file_id && (
                      <a href={driveUrl(viewCoHost.vehicle_registration_file_id)} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="border-border text-foreground">
                          <ExternalLink className="w-3 h-3 mr-1" /> Vehicle Registration
                        </Button>
                      </a>
                    )}
                  </div>
                </DetailSection>
              )}

              {viewCoHost.notes && (
                <DetailSection title="Notes">
                  <p className="text-muted-foreground">{viewCoHost.notes}</p>
                </DetailSection>
              )}

              {/* Managed Vehicles */}
              <DetailSection title="Managed Vehicles">
                <div className="space-y-3">
                  {!carsData ? (
                    <div className="flex items-center gap-2 text-muted-foreground text-xs">
                      <Loader2 className="w-3 h-3 animate-spin" /> Loading fleet...
                    </div>
                  ) : carsData.cars.length === 0 ? (
                    <p className="text-muted-foreground text-xs">No cars in the fleet yet.</p>
                  ) : (
                    <>
                      <p className="text-muted-foreground text-xs">
                        Select the GLA fleet vehicles this co-host will manage. Only these cars will appear in their co-host view.
                      </p>
                      <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-md p-2">
                        {carsData.cars.map((car) => {
                          const label = [car.year, car.make, car.model].filter(Boolean).join(" ");
                          const sub = [car.licensePlate, car.color].filter(Boolean).join(" · ");
                          return (
                            <label
                              key={car.id}
                              className="flex items-start gap-2 cursor-pointer hover:bg-muted/40 rounded px-1 py-0.5 transition-colors"
                            >
                              <Checkbox
                                checked={selectedCarAids.has(car.id)}
                                onCheckedChange={(checked) => {
                                  setSelectedCarAids((prev) => {
                                    const next = new Set(prev);
                                    checked ? next.add(car.id) : next.delete(car.id);
                                    return next;
                                  });
                                }}
                                className="mt-0.5 shrink-0"
                              />
                              <div className="min-w-0">
                                <span className="text-foreground text-xs font-medium">{label || `Car #${car.id}`}</span>
                                {sub && <span className="text-muted-foreground text-xs ml-1">— {sub}</span>}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-xs">
                          {selectedCarAids.size} vehicle{selectedCarAids.size !== 1 ? "s" : ""} selected
                        </span>
                        <Button
                          size="sm"
                          className="bg-primary text-primary-foreground hover:bg-primary/80"
                          disabled={saveVehiclesMutation.isPending}
                          onClick={() => saveVehiclesMutation.mutate({ id: viewCoHost.id, carAids: Array.from(selectedCarAids) })}
                        >
                          {saveVehiclesMutation.isPending
                            ? <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Saving...</>
                            : <><Save className="w-3 h-3 mr-1" /> Save Assignments</>
                          }
                        </Button>
                      </div>
                    </>
                  )}
                  {/* Co-host employee onboarding link: employees who submit through
                      this link are linked to this co-host (employee_co_host_id),
                      so they show up in the co-host's Payroll / Work Schedule / Time Off. */}
                  <div className="border-t border-border pt-3 mt-3 space-y-2">
                    <p className="text-muted-foreground text-xs">
                      Share this link with employees joining this co-host. Anyone who onboards through it
                      is automatically added to this co-host's team.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={async () => {
                        const link = `${window.location.origin}/employee-form?coHost=${encodeURIComponent(viewCoHost.co_host_number || String(viewCoHost.id))}`;
                        try {
                          await navigator.clipboard.writeText(link);
                          toast({ title: "Copied", description: "Employee onboarding link copied." });
                        } catch {
                          toast({ title: "Copy failed", description: link, variant: "destructive" });
                        }
                      }}
                    >
                      <Copy className="w-3 h-3 mr-1" /> Copy employee onboarding link
                    </Button>
                  </div>
                </div>
              </DetailSection>

              {/* Approval actions */}
              {viewCoHost.status === "pending" && (
                <div className="border-t border-border pt-4 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs">Notes (optional)</Label>
                    <Textarea
                      value={approveNotes}
                      onChange={(e) => setApproveNotes(e.target.value)}
                      placeholder="Add approval or rejection notes..."
                      className="bg-card border-border text-foreground min-h-[60px]"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      className="border-red-500/50 text-red-600 hover:bg-red-500/10"
                      disabled={updateStatusMutation.isPending}
                      onClick={() => updateStatusMutation.mutate({ id: viewCoHost.id, status: "rejected", notes: approveNotes })}
                    >
                      {updateStatusMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <XCircle className="w-4 h-4 mr-1" />}
                      Reject
                    </Button>
                    <Button
                      className="bg-green-600 text-white hover:bg-green-700"
                      disabled={updateStatusMutation.isPending}
                      onClick={() => updateStatusMutation.mutate({ id: viewCoHost.id, status: "approved", notes: approveNotes })}
                    >
                      {updateStatusMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                      Approve & Create Profile
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Approving will create a portal account and send the co-host a "Create Password" email.
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* QR Code Modal */}
      {showQr && (
        <Dialog open onOpenChange={() => setShowQr(false)}>
          <DialogContent className="bg-card border-border text-foreground max-w-xs text-center">
            <DialogHeader>
              <DialogTitle>Co-Host Onboarding QR Code</DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Scan to open the co-host onboarding form
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center p-2" id="cohost-qr-wrap">
              <QRCodeSVG
                value={`${window.location.origin}/co-host-form`}
                size={220}
              />
            </div>
            <p className="text-xs text-muted-foreground break-all">{window.location.origin}/co-host-form</p>
          </DialogContent>
        </Dialog>
      )}
    </AdminLayout>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-primary uppercase tracking-wider border-b border-border pb-1">{title}</h3>
      {children}
    </div>
  );
}

function DetailGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">{children}</div>;
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-1 min-w-0">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className="text-foreground break-words">{value}</span>
    </div>
  );
}
