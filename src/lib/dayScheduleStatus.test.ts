import { describe, expect, it } from 'vitest';
import { scheduleTaskStatus } from './dayScheduleStatus';

describe('Day Schedule two-state status', () => {
  it.each(['new', 'in_progress', 'pending', 'car_blocked_off', null])('shows %s as New without changing source history', status => {
    const event = { status };
    expect(scheduleTaskStatus(event)).toBe('new');
    expect(event.status).toBe(status);
  });
  it.each(['completed', 'delivered', 'no_issues'])('shows historical %s as Completed', status => {
    expect(scheduleTaskStatus({ status })).toBe('completed');
  });
  it('uses recorded completion evidence', () => {
    expect(scheduleTaskStatus({ status: 'new', completed_day: '2026-11-01' })).toBe('completed');
  });
});
