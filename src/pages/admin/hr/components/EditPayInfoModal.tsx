import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface Employee {
  employee_aid: number;
  employee_job_pay_eligible?: number | null;
  employee_job_pay_salary_rate?: string | null;
  employee_job_pay_bank_acc?: string | null;
}

interface EditPayInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null | undefined;
}

export function EditPayInfoModal({ open, onOpenChange, employee }: EditPayInfoModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    employee_job_pay_eligible: false,
    employee_job_pay_salary_rate: "",
    employee_job_pay_bank_acc: "",
  });

  const resetForm = () => {
    if (employee) {
      setForm({
        employee_job_pay_eligible: Number(employee.employee_job_pay_eligible) === 1,
        employee_job_pay_salary_rate: employee.employee_job_pay_salary_rate || "",
        employee_job_pay_bank_acc: employee.employee_job_pay_bank_acc || "",
      });
    }
  };

  const mutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const res = await fetch(buildApiUrl(`/api/employees/${employee?.employee_aid}/job-and-pay`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          employee_job_pay_eligible: values.employee_job_pay_eligible ? 1 : 0,
          employee_job_pay_salary_rate: values.employee_job_pay_salary_rate || null,
          employee_job_pay_bank_acc: values.employee_job_pay_bank_acc || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to update");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Updated", description: "Pay information updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employee?.employee_aid] });
      onOpenChange(false);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (open && employee) resetForm();
  }, [open, employee]);

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
  };

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-card border-border text-muted-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="text-primary">Update Pay Information</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(form);
          }}
          className="space-y-4"
        >
          <div className="flex items-center gap-2">
            <Checkbox
              id="eligible"
              checked={form.employee_job_pay_eligible}
              onCheckedChange={(v) => setForm((p) => ({ ...p, employee_job_pay_eligible: !!v }))}
              className="border-border data-[state=checked]:bg-[#D3BC8D] data-[state=checked]:border-primary"
            />
            <Label htmlFor="eligible" className="text-muted-foreground cursor-pointer">Payroll Eligibility</Label>
          </div>
          <div>
            <Label className="text-muted-foreground">Employee Rate per Hour ($)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.employee_job_pay_salary_rate}
              onChange={(e) => setForm((p) => ({ ...p, employee_job_pay_salary_rate: e.target.value }))}
              className="bg-background border-border"
              placeholder="0.00"
            />
          </div>
          <div>
            <Label className="text-muted-foreground">Bank Account</Label>
            <Input
              value={form.employee_job_pay_bank_acc}
              onChange={(e) => setForm((p) => ({ ...p, employee_job_pay_bank_acc: e.target.value }))}
              className="bg-background border-border"
              placeholder="Account number"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="border-border">
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
