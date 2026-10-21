import { getActiveTimezone } from '@/hooks/use-timezone';
import type { ServiceMileage } from '@/lib/serviceWorkspace';
export function ServiceMileageReading({ reading }: { reading?: ServiceMileage }) {
  if (!reading) return null;
  return <div className="mt-2 min-w-0 rounded-lg border border-primary/20 bg-primary/5 p-2 text-xs"><p className="font-medium">{reading.miles !== null ? `${reading.miles.toLocaleString()} miles` : 'Current mileage needs checking'}{reading.source ? ` · ${reading.source === 'bouncie' ? 'Bouncie' : reading.source === 'turo_return' ? 'Trip return odometer' : 'Trip start odometer'}` : ''}{reading.state === 'last_known' ? ' · Last known' : ''}</p>{reading.observedAt && <p className="mt-1 text-muted-foreground">Reading: {new Date(reading.observedAt).toLocaleString('en-US', { timeZone: getActiveTimezone(), month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}</p>}{reading.warning && <p className="mt-1 text-amber-900">{reading.warning}</p>}</div>;
}
