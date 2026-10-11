import { useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface ClockOutPropertyCheckProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function ClockOutPropertyCheck({ checked, onCheckedChange, disabled }: ClockOutPropertyCheckProps) {
  const id = useId();

  return (
    <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
      <p className="text-sm leading-relaxed">
        <strong>Reminder:</strong> Please check your person and pockets for company cards or car keys.
      </p>
      <div className="flex items-start gap-3">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          disabled={disabled}
          className="mt-3 h-5 w-5"
        />
        <Label htmlFor={id} className="flex min-h-11 flex-1 cursor-pointer items-center py-2 text-sm leading-relaxed">
          I confirm that I have checked and do not have any company cards or car keys.
        </Label>
      </div>
    </div>
  );
}
