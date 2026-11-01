import { scheduleTaskStatus } from './dayScheduleStatus';

type ScheduleOrderEvent = {
  is_carryover?: boolean;
  status: string | null;
  completed_day?: string | null;
  scheduled_day?: string | null;
  start_time: string | null;
};

export function pendingCarryover(event: ScheduleOrderEvent): boolean {
  // The server verifies actual overdue work. Browsing a future day must not
  // turn today's unfinished work into carryover merely because of its date.
  return event.is_carryover === true && scheduleTaskStatus(event) === 'new'
    && !/^cancel[le]+d$/i.test((event.status ?? '').trim());
}

/** Pending carryovers first (oldest day first), then the day's work by time. */
export function compareScheduleTasks(a: ScheduleOrderEvent, b: ScheduleOrderEvent): number {
  const aCarry = pendingCarryover(a), bCarry = pendingCarryover(b);
  if (aCarry !== bCarry) return aCarry ? -1 : 1;
  if (aCarry && bCarry) {
    const dayOrder = (a.scheduled_day || '9999-99-99').localeCompare(b.scheduled_day || '9999-99-99');
    if (dayOrder) return dayOrder;
  }
  return (a.start_time || '99:99').localeCompare(b.start_time || '99:99');
}
