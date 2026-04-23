import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { buildApiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Loader2 } from "lucide-react";

interface FormValues {
  employee_emergency_contact_person: string;
  employee_emergency_relationship: string;
  employee_emergency_number: string;
  employee_emergency_address: string;
}

interface Employee {
  employee_aid: number;
  employee_emergency_contact_person?: string;
  employee_emergency_relationship?: string;
  employee_emergency_number?: string;
  employee_emergency_address?: string;
}

interface EditEmergencyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee;
}

export function EditEmergencyModal({ open, onOpenChange, employee }: EditEmergencyModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    defaultValues: {
      employee_emergency_contact_person: employee.employee_emergency_contact_person || "",
      employee_emergency_relationship: employee.employee_emergency_relationship || "",
      employee_emergency_number: employee.employee_emergency_number || "",
      employee_emergency_address: employee.employee_emergency_address || "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        employee_emergency_contact_person: employee.employee_emergency_contact_person || "",
        employee_emergency_relationship: employee.employee_emergency_relationship || "",
        employee_emergency_number: employee.employee_emergency_number || "",
        employee_emergency_address: employee.employee_emergency_address || "",
      });
    }
  }, [open, employee]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const res = await fetch(buildApiUrl(`/api/employees/${employee.employee_aid}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: "Success", description: "Emergency contact updated successfully." });
      onOpenChange(false);
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const onSubmit = (values: FormValues) => mutation.mutate(values);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card border-border text-muted-foreground">
        <DialogHeader>
          <DialogTitle className="text-primary">Update Emergency Contact</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="employee_emergency_contact_person"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">Name</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-card border-border" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="employee_emergency_relationship"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">Relationship</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-card border-border" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="employee_emergency_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">Number</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-card border-border" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="employee_emergency_address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground">Address</FormLabel>
                  <FormControl>
                    <Textarea {...field} className="bg-card border-border" rows={3} />
                  </FormControl>
                </FormItem>
              )}
            />
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={mutation.isPending}
                className="border-border"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
