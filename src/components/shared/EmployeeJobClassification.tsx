import { useId, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const EMPLOYEE_DEPARTMENTS = ['Operations', 'Sales & Marketing', 'Administration'] as const;
export const EMPLOYEE_JOB_TITLES = ['Car Driver', 'Car Cleaner', 'Mechanic'] as const;

export function EmployeeJobClassification({ label, options, value, onChange, disabled = false, hideLabel = false }: {
  label: string; options: readonly string[]; value: string; onChange: (value: string) => void;
  disabled?: boolean; hideLabel?: boolean;
}) {
  const id = useId();
  const [custom, setCustom] = useState(false);
  const isCustom = custom || (!!value && !options.includes(value));
  return <div className="min-w-0 space-y-1.5">
    <Label htmlFor={id} className={hideLabel ? 'sr-only' : 'text-muted-foreground'}>{label}</Label>
    <select id={id} value={isCustom ? '__custom__' : value} disabled={disabled}
      className="h-11 w-full min-w-0 rounded-md border border-border bg-background px-3 text-base text-foreground sm:text-sm"
      onChange={event => {
        const next = event.target.value;
        setCustom(next === '__custom__');
        onChange(next === '__custom__' ? '' : next);
      }}>
      <option value="">Not set</option>
      {options.map(option => <option key={option} value={option}>{option}</option>)}
      <option value="__custom__">Custom…</option>
    </select>
    {isCustom && <Input aria-label={`Custom ${label.toLowerCase()}`} value={value} onChange={event => onChange(event.target.value)}
      maxLength={200} disabled={disabled} placeholder={`Enter custom ${label.toLowerCase()}`}
      className="h-11 text-base sm:text-sm" />}
  </div>;
}
