import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
export type ServiceDetailsDraft = { odometer: string; milesUntilNext: string; nextOdometer: string; nextDueDate: string };
export const emptyServiceDetails: ServiceDetailsDraft = { odometer: '', milesUntilNext: '', nextOdometer: '', nextDueDate: '' };
export function ServiceRecordDetailsFields({ value, onChange, oil }: { value: ServiceDetailsDraft; onChange: (value: ServiceDetailsDraft) => void; oil: boolean }) {
  return <fieldset className="rounded-lg border border-primary/25 bg-primary/5 p-3 sm:p-4">
    <legend className="px-1 text-sm font-semibold">Service record details</legend>
    <p className="mb-3 text-xs text-muted-foreground">This form and its receipts appear in vehicle service history and the service calendar. Approval updates last-serviced and due dates. These details do not schedule an appointment.</p>
    <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">{([
      ['odometer', 'Odometer at service (miles)', 'number', '0', '2000000'],
      ['milesUntilNext', 'Miles until next service', 'number', '1', '100000'],
      ['nextOdometer', 'Next service at (odometer miles)', 'number', '0', '2000000'],
      ['nextDueDate', 'Next service due date', 'date', undefined, undefined],
    ] as const).map(([key,label,type,min,max]) => <div key={key} className="min-w-0 space-y-1"><Label htmlFor={`service-form-${key}`}>{label}</Label><Input id={`service-form-${key}`} type={type} min={min} max={max} step={type === 'number' ? 1 : undefined} inputMode={type === 'number' ? 'numeric' : undefined} className="h-11 w-full min-w-0" value={value[key]} onChange={e => onChange({ ...value, [key]: e.target.value })} /></div>)}</div>
    <p className="mt-3 text-xs text-muted-foreground">{oil ? 'Printed oil-change reminders are suggested when readable. ' : ''}Enter missing conditions manually. Leave unknown values blank.</p>
  </fieldset>;
}
