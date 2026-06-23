/**
 * Parking Ticket Submission ("Submit a Parking Ticket")
 * Car owners submit a parking ticket against one of their own cars.
 * The current logged-in user is the car owner (read-only). They pick the car
 * (only their own cars appear), the date of the receipt, and the amount.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authMeQueryFn, buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, ParkingCircle } from "lucide-react";

interface CarOption {
  id: number;
  label: string;
}

export default function ParkingTicketSubmission() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    pt_car_id: "",
    pt_receipt_date: new Date().toISOString().slice(0, 10),
    pt_amount: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const { data: currentUserData } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: authMeQueryFn,
  });

  const { data: carsData, isLoading: isLoadingCars } = useQuery({
    queryKey: ["/api/parking-tickets/cars"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/parking-tickets/cars"), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch cars");
      return res.json();
    },
  });

  const cars: CarOption[] = carsData?.data ?? [];

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(buildApiUrl("/api/parking-tickets"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pt_car_id: Number(form.pt_car_id),
          pt_receipt_date: form.pt_receipt_date,
          pt_amount: form.pt_amount,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to submit");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parking-tickets/my"] });
      setSubmitted(true);
      toast({
        title: "Parking ticket submitted!",
        description: "Your parking ticket has been submitted for review.",
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
    if (!form.pt_car_id)
      return toast({ title: "Please select a car", variant: "destructive" });
    if (!form.pt_receipt_date)
      return toast({ title: "Date of receipt required", variant: "destructive" });
    const amt = parseFloat(form.pt_amount);
    if (!form.pt_amount || Number.isNaN(amt) || amt < 0)
      return toast({ title: "Enter a valid amount", variant: "destructive" });
    submitMutation.mutate();
  };

  const handleReset = () => {
    setForm({
      pt_car_id: cars.length === 1 ? String(cars[0].id) : "",
      pt_receipt_date: new Date().toISOString().slice(0, 10),
      pt_amount: "",
    });
    setSubmitted(false);
  };

  const ownerName =
    [currentUserData?.user?.firstName, currentUserData?.user?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    currentUserData?.user?.email ||
    "";

  if (submitted) {
    return (
      <Card className="border-primary/20">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <CheckCircle className="h-12 w-12 text-green-500" />
          <h3 className="text-lg font-semibold text-primary">
            Parking Ticket Submitted Successfully
          </h3>
          <p className="text-sm text-muted-foreground text-center">
            Your parking ticket has been submitted and is pending review. You
            will be notified once it has been approved or declined.
          </p>
          <Button variant="outline" onClick={handleReset}>
            Submit Another
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-primary flex items-center gap-2">
          <ParkingCircle className="h-5 w-5" />
          Submit a Parking Ticket
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Submit a parking ticket receipt for one of your cars. An admin will
          review it and you will be notified of the outcome.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Car Owner — current user, read-only */}
          <div className="space-y-1.5">
            <Label>Car Owner</Label>
            <Input
              value={ownerName}
              readOnly
              className="opacity-80 bg-muted cursor-default"
              placeholder="Your name"
            />
          </div>

          {/* Car selector — only the owner's own cars */}
          <div className="space-y-1.5">
            <Label htmlFor="pt_car_id">
              Car <span className="text-destructive">*</span>
            </Label>
            {isLoadingCars ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading your cars…
              </div>
            ) : cars.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No cars found on your account.
              </p>
            ) : (
              <Select
                value={form.pt_car_id}
                onValueChange={(v) => setForm((p) => ({ ...p, pt_car_id: v }))}
              >
                <SelectTrigger id="pt_car_id">
                  <SelectValue placeholder="Select a car" />
                </SelectTrigger>
                <SelectContent>
                  {cars.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Date of receipt */}
          <div className="space-y-1.5">
            <Label htmlFor="pt_receipt_date">
              Date of Receipt <span className="text-destructive">*</span>
            </Label>
            <Input
              id="pt_receipt_date"
              type="date"
              value={form.pt_receipt_date}
              onChange={(e) =>
                setForm((p) => ({ ...p, pt_receipt_date: e.target.value }))
              }
              required
            />
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="pt_amount">
              Amount <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                $
              </span>
              <Input
                id="pt_amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className="pl-7"
                value={form.pt_amount}
                onChange={(e) =>
                  setForm((p) => ({ ...p, pt_amount: e.target.value }))
                }
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleReset}>
              Clear
            </Button>
            <Button
              type="submit"
              disabled={submitMutation.isPending || cars.length === 0}
              className="min-w-[140px]"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Submitting…
                </>
              ) : (
                "Submit Parking Ticket"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
