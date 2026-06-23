import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, X, Check, Wrench, AlertTriangle } from "lucide-react";
import { buildApiUrl, getProxiedImageUrl } from "@/lib/queryClient";

interface ApprovalData {
  id: number;
  car_name: string | null;
  car_make: string | null;
  car_model: string | null;
  car_year: number | null;
  car_plate_number: string | null;
  task_description: string | null;
  photos: string[];
  reservation_id: string | null;
  trip_start: string | null;
  trip_end: string | null;
  pickup_location: string | null;
  return_location: string | null;
  delivery_location: string | null;
  guest_name: string | null;
  owner_approval_status: "not_sent" | "email_sent" | "approved" | "declined";
  owner_decline_reason: string | null;
  owner_wants_pickup: 0 | 1 | null;
}

const fmt = (v: string | null): string => {
  if (!v) return "—";
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return v;
    return d.toLocaleString("en-US", {
      timeZone: "America/Denver",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return v;
  }
};

export default function MaintenanceApproval() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/maintenance-approval/:token");
  const token = params?.token || "";
  const { toast } = useToast();

  const [mode, setMode] = useState<"choose" | "declining">("choose");
  const [declineReason, setDeclineReason] = useState("");
  const [wantsPickup, setWantsPickup] = useState(false);
  const [done, setDone] = useState<null | "approved" | "declined">(null);

  const {
    data,
    isLoading,
    error,
  } = useQuery<ApprovalData>({
    queryKey: ["validateMaintenanceApproval", token],
    queryFn: async () => {
      if (!token) throw new Error("No token provided");
      const res = await fetch(
        buildApiUrl(`/api/maintenance-approval/validate/${token}`),
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Invalid or expired link");
      }
      return json.data;
    },
    enabled: !!token,
    retry: false,
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        buildApiUrl(`/api/maintenance-approval/approve/${token}`),
        { method: "POST" },
      );
      const json = await res.json();
      if (!res.ok || !json.success)
        throw new Error(json.error || "Failed to approve");
      return json;
    },
    onSuccess: () => {
      setDone("approved");
      toast({
        title: "Maintenance approved",
        description: "GLA will proceed with scheduling and managing the maintenance.",
      });
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const declineMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        buildApiUrl(`/api/maintenance-approval/decline/${token}`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: declineReason.trim(),
            wantsPickup,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success)
        throw new Error(json.error || "Failed to decline");
      return json;
    },
    onSuccess: () => {
      setDone("declined");
      toast({
        title: "Maintenance declined",
        description: wantsPickup
          ? "We'll be in touch about picking up your vehicle. You'll complete a block-off form at pickup and on return."
          : "Your response has been recorded.",
      });
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Loading / error states ──
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a1a] via-[#2d2d2d] to-[#1a1a1a] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-[#d4af37] mx-auto mb-4" />
          <p className="text-[#d4af37] text-lg">Loading maintenance details...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a1a1a] via-[#2d2d2d] to-[#1a1a1a] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#2d2d2d] border border-[#d4af37]/40 rounded-lg p-8 text-center">
          <X className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-[#d4af37] mb-3">
            Link Expired or Invalid
          </h1>
          <p className="text-gray-300 mb-6">
            {error instanceof Error
              ? error.message
              : "This maintenance approval link is no longer valid."}
          </p>
          <Button
            onClick={() => setLocation("/")}
            className="bg-[#d4af37] text-[#1a1a1a] hover:bg-[#f4d03f] font-semibold"
          >
            Return to Home
          </Button>
        </div>
      </div>
    );
  }

  const carLabel =
    data.car_make && data.car_model
      ? `${data.car_make} ${data.car_model} ${data.car_year ?? ""}`.trim()
      : data.car_name || "Your vehicle";

  const alreadyResolved =
    done ||
    data.owner_approval_status === "approved" ||
    data.owner_approval_status === "declined";

  const resolvedStatus =
    done ?? (data.owner_approval_status as "approved" | "declined");

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a1a] via-[#2d2d2d] to-[#1a1a1a] py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <img
            src="/logo.svg"
            alt="Golden Luxury Auto"
            className="h-16 w-auto mx-auto object-contain mb-3"
          />
          <p className="text-gray-300 text-lg">Maintenance Approval</p>
        </div>

        <div className="bg-[#2d2d2d] border border-[#d4af37]/30 rounded-xl p-6 md:p-8">
          {/* Resolved state */}
          {alreadyResolved ? (
            <div className="text-center py-6">
              {resolvedStatus === "approved" ? (
                <Check className="h-16 w-16 text-green-500 mx-auto mb-4" />
              ) : (
                <X className="h-16 w-16 text-red-500 mx-auto mb-4" />
              )}
              <h2 className="text-xl font-bold text-white mb-2">
                {resolvedStatus === "approved"
                  ? "Maintenance Approved"
                  : "Maintenance Declined"}
              </h2>
              <p className="text-gray-400">
                {resolvedStatus === "approved"
                  ? "Thank you. The GLA team will schedule and manage this maintenance."
                  : "Your response has been recorded. The GLA team has been notified."}
              </p>
              <Button
                onClick={() => setLocation("/")}
                className="mt-6 bg-[#d4af37] text-[#1a1a1a] hover:bg-[#f4d03f] font-semibold"
              >
                Return to Home
              </Button>
            </div>
          ) : (
            <>
              {/* Issue header */}
              <div className="flex items-center gap-3 mb-5 pb-5 border-b border-white/10">
                <div className="rounded-full bg-[#d4af37]/20 p-3">
                  <Wrench className="h-6 w-6 text-[#d4af37]" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{carLabel}</h2>
                  {data.car_plate_number && (
                    <p className="text-sm text-gray-400">
                      Plate: {data.car_plate_number}
                    </p>
                  )}
                </div>
              </div>

              {/* Details */}
              <dl className="space-y-3 text-sm mb-5">
                {data.reservation_id && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-400">Reservation ID</dt>
                    <dd className="text-white text-right">{data.reservation_id}</dd>
                  </div>
                )}
                {(data.trip_start || data.trip_end) && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-400">Trip Dates</dt>
                    <dd className="text-white text-right">
                      {fmt(data.trip_start)} → {fmt(data.trip_end)}
                    </dd>
                  </div>
                )}
                {data.pickup_location && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-400">Pickup</dt>
                    <dd className="text-white text-right">{data.pickup_location}</dd>
                  </div>
                )}
                {(data.return_location || data.delivery_location) && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-400">Return</dt>
                    <dd className="text-white text-right">
                      {data.return_location || data.delivery_location}
                    </dd>
                  </div>
                )}
              </dl>

              {/* Description */}
              <div className="mb-5">
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                  Description of Issue
                </p>
                <p className="text-white bg-[#1a1a1a] border-l-2 border-[#d4af37] rounded p-3 leading-relaxed">
                  {data.task_description || "Maintenance required."}
                </p>
              </div>

              {/* Photos */}
              {data.photos && data.photos.length > 0 && (
                <div className="mb-6">
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">
                    Photos
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {data.photos.map((p, i) => (
                      <a
                        key={i}
                        href={getProxiedImageUrl(p)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img
                          src={getProxiedImageUrl(p)}
                          alt={`Issue photo ${i + 1}`}
                          className="h-24 w-24 object-cover rounded-lg border border-white/10"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Action area */}
              {mode === "choose" ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-400 mb-1">
                    Please choose how you'd like to proceed:
                  </p>
                  <Button
                    onClick={() => approveMutation.mutate()}
                    disabled={approveMutation.isPending}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-6 text-base"
                  >
                    {approveMutation.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <Check className="h-5 w-5 mr-2" />
                        Approve — GLA manages the maintenance
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => setMode("declining")}
                    variant="outline"
                    className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10 font-semibold py-6 text-base"
                  >
                    <X className="h-5 w-5 mr-2" />
                    Decline
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-300 mb-1 block">
                      Reason for declining <span className="text-red-400">*</span>
                    </label>
                    <Textarea
                      value={declineReason}
                      onChange={(e) => setDeclineReason(e.target.value)}
                      placeholder="Please tell us why you're declining this maintenance..."
                      rows={3}
                      className="bg-[#1a1a1a] border-white/20 text-white"
                    />
                  </div>
                  <label className="flex items-start gap-3 cursor-pointer rounded-lg bg-[#1a1a1a] p-3 border border-white/10">
                    <Checkbox
                      checked={wantsPickup}
                      onCheckedChange={(c) => setWantsPickup(c === true)}
                      className="mt-0.5"
                    />
                    <span className="text-sm text-gray-300">
                      I would like to pick up the vehicle to manage the maintenance
                      myself.
                      <span className="block text-xs text-gray-500 mt-1">
                        If selected, GLA will arrange a vehicle block-off. You'll
                        complete a block-off form at pickup and again when the
                        vehicle is returned.
                      </span>
                    </span>
                  </label>
                  {wantsPickup && (
                    <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 rounded p-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>
                        Block-off start and end forms will be required to pick up
                        and return the vehicle.
                      </span>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <Button
                      onClick={() => setMode("choose")}
                      variant="ghost"
                      className="flex-1 text-gray-400"
                      disabled={declineMutation.isPending}
                    >
                      Back
                    </Button>
                    <Button
                      onClick={() => {
                        if (!declineReason.trim()) {
                          toast({
                            title: "Reason required",
                            description: "Please provide a reason for declining.",
                            variant: "destructive",
                          });
                          return;
                        }
                        declineMutation.mutate();
                      }}
                      disabled={declineMutation.isPending}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold"
                    >
                      {declineMutation.isPending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        "Submit Decline"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
