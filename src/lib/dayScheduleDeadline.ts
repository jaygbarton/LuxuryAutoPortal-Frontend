import { mtLocalInputToUtcIso } from './mt-datetime';

/** Time passing never changes a task's recorded completion state. */
export function taskDeadlineHasPassed(event: { due_at?: string | null; scheduled_day?: string | null; start_time?: string | null; end_time?: string | null; appointment_end_local?: string | null }, viewedDay: string, timezone: string, now: number): boolean {
  let deadline = event.due_at;
  if (!deadline && event.appointment_end_local) deadline = mtLocalInputToUtcIso(event.appointment_end_local.replace(' ', 'T'), timezone);
  if (!deadline) {
    const time = event.end_time || event.start_time;
    const day = event.scheduled_day || viewedDay;
    if (!time || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
    deadline = mtLocalInputToUtcIso(`${day}T${time.slice(0, 5)}`, timezone);
  }
  return !!deadline && Number.isFinite(Date.parse(deadline)) && Date.parse(deadline) < now;
}
