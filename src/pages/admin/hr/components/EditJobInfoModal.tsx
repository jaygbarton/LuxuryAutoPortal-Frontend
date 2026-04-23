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
import { Textarea } from "@/components/ui/textarea";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface Employee {
  employee_aid: number;
  employee_number?: string;
  employee_job_pay_aid?: number | null;
  employee_job_pay_work_email?: string | null;
  employee_job_pay_department_name?: string | null;
  employee_job_pay_job_title_name?: string | null;
  employee_job_pay_hired?: string | null;
  employee_job_pay_regular_on?: string | null;
  employee_job_pay_separated?: string | null;
  employee_job_pay_comment?: string | null;
}

interface EditJobInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null | undefined;
}

export function EditJobInfoModal({ open, onOpenChange, employee }: EditJobInfoModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    employee_number: "",
    employee_job_pay_department_name: "",
    employee_job_pay_job_title_name: "",
    employee_job_pay_work_email: "",
    employee_job_pay_hired: "",
    employee_job_pay_regular_on: "",
    employee_job_pay_separated: "",
    employee_job_pay_comment: "",
  });

  const resetForm = () => {
    if (employee) {
      setForm({
        employee_number: employee.employee_number || "",
        employee_job_pay_department_name: employee.employee_job_pay_department_name || "",
        employee_job_pay_job_title_name: employee.employee_job_pay_job_title_name || "",
        employee_job_pay_work_email: employee.employee_job_pay_work_email || "",
        employee_job_pay_hired: (employee.employee_job_pay_hired || "").slice(0, 10),
        employee_job_pay_regular_on: (employee.employee_job_pay_regular_on || "").slice(0, 10),
        employee_job_pay_separated: (employee.employee_job_pay_separated || "").slice(0, 10),
        employee_job_pay_comment: employee.employee_job_pay_comment || "",
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
          employee_job_pay_department_name: values.employee_job_pay_department_name || null,
          employee_job_pay_job_title_name: values.employee_job_pay_job_title_name || null,
          employee_job_pay_work_email: values.employee_job_pay_work_email || null,
          employee_job_pay_hired: values.employee_job_pay_hired || null,
          employee_job_pay_regular_on: values.employee_job_pay_regular_on || null,
          employee_job_pay_separated: values.employee_job_pay_separated || null,
          employee_job_pay_comment: values.employee_job_pay_comment || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to update");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Updated", description: "Job information updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
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
      <DialogContent className="bg-card border-border text-muted-foreground max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-primary">Update Job Information</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate(form);
          }}
          className="space-y-4"
        >
          <div>
            <Label className="text-muted-foreground">Employee Number</Label>
            <Input
              value={form.employee_number}
              onChange={(e) => setForm((p) => ({ ...p, employee_number: e.target.value }))}
              className="bg-background border-border"
              disabled
            />
          </div>
          <div>
            <Label className="text-muted-foreground">Department</Label>
            <Input
              value={form.employee_job_pay_department_name}
              onChange={(e) => setForm((p) => ({ ...p, employee_job_pay_department_name: e.target.value }))}
              className="bg-background border-border"
              placeholder="e.g. Sales"
            />
          </div>
          <div>
            <Label className="text-muted-foreground">Job Title</Label>
            <Input
              value={form.employee_job_pay_job_title_name}
              onChange={(e) => setForm((p) => ({ ...p, employee_job_pay_job_title_name: e.target.value }))}
              className="bg-background border-border"
              placeholder="e.g. Sales Associate"
            />
          </div>
          <div>
            <Label className="text-muted-foreground">Work Email</Label>
            <Input
              type="email"
              value={form.employee_job_pay_work_email}
              onChange={(e) => setForm((p) => ({ ...p, employee_job_pay_work_email: e.target.value }))}
              className="bg-background border-border"
              placeholder="work@example.com"
            />
          </div>
          <div>
            <Label className="text-muted-foreground">Date Hired</Label>
            <Input
              type="date"
              value={form.employee_job_pay_hired}
              onChange={(e) => setForm((p) => ({ ...p, employee_job_pay_hired: e.target.value }))}
              className="bg-background border-border"
            />
          </div>
          <div>
            <Label className="text-muted-foreground">Regularized On</Label>
            <Input
              type="date"
              value={form.employee_job_pay_regular_on}
              onChange={(e) => setForm((p) => ({ ...p, employee_job_pay_regular_on: e.target.value }))}
              className="bg-background border-border"
            />
          </div>
          <div>
            <Label className="text-muted-foreground">Date Separated</Label>
            <Input
              type="date"
              value={form.employee_job_pay_separated}
              onChange={(e) => setForm((p) => ({ ...p, employee_job_pay_separated: e.target.value }))}
              className="bg-background border-border"
            />
          </div>
          <div>
            <Label className="text-muted-foreground">Comment</Label>
            <Textarea
              value={form.employee_job_pay_comment}
              onChange={(e) => setForm((p) => ({ ...p, employee_job_pay_comment: e.target.value }))}
              className="bg-background border-border min-h-[80px]"
              placeholder="Optional notes"
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
