import { describe, expect, it } from 'vitest';
import { isActiveFleetStatus, operationVehicleMatches, type OperationsVehicle } from '../operationsFleet';
import { taskDeadlineHasPassed } from '../dayScheduleDeadline';

const cars: OperationsVehicle[] = [
  { carId: 1, carName: '2024 Toyota Sienna', plateNumber: 'ACTIVE1', vinNumber: 'VIN1', carStatus: 'available' },
  { carId: 2, carName: '2024 Toyota Sienna', plateNumber: 'OLD2', vinNumber: 'VIN2', carStatus: 'off_fleet' },
];
describe('operational fleet filtering', () => {
  it('uses fleet status independently of ownership/management flags', () => {
    expect(isActiveFleetStatus(' IN_USE ')).toBe(true);
    expect(isActiveFleetStatus('off_fleet')).toBe(false);
    expect(isActiveFleetStatus(null)).toBe(false);
    expect(operationVehicleMatches({ car_id: 1, car_is_active: 0 }, cars, 'active')).toBe(true);
  });
  it('uses exact IDs/VINs/plates and does not substitute another same-model car', () => {
    expect(operationVehicleMatches({ car_id: 2, plate: 'ACTIVE1' }, cars, 'active')).toBe(false);
    expect(operationVehicleMatches({ vin: 'VIN2', plate: 'ACTIVE1' }, cars, 'active')).toBe(false);
    expect(operationVehicleMatches({ plate: 'ACTIVE1' }, cars, 'active')).toBe(true);
    expect(operationVehicleMatches({ car_name: 'Toyota Sienna 2024', plate: 'TEMP' }, cars, 'active')).toBe(false);
  });
  it('retains inactive and uncertain records under explicit All, plus generic employee work', () => {
    expect(operationVehicleMatches({ car_id: 2 }, cars, 'inactive')).toBe(true);
    expect(operationVehicleMatches({ car_id: 999 }, cars, 'all')).toBe(true);
    expect(operationVehicleMatches({ type: 'task_timer', car_name: null }, cars, 'active')).toBe(true);
  });
});
describe('schedule deadline appearance', () => {
  const now = Date.parse('2026-11-01T08:30:00Z');
  it('uses the exact deadline across the repeated DST hour and does not infer completion', () => {
    expect(taskDeadlineHasPassed({ due_at: '2026-11-01T07:30:00Z' }, '2026-11-04', 'America/Denver', now)).toBe(true);
    expect(taskDeadlineHasPassed({ due_at: '2026-11-01T08:30:00Z' }, '2026-11-04', 'America/Denver', now)).toBe(false);
    expect(taskDeadlineHasPassed({ due_at: '2026-11-01T09:30:00Z' }, '2026-11-04', 'America/Denver', now)).toBe(false);
  });
  it('uses original schedule/appointment dates for older feeds and never invents a missing time', () => {
    expect(taskDeadlineHasPassed({ scheduled_day: '2026-10-30', start_time: '09:00' }, '2026-11-04', 'America/Denver', now)).toBe(true);
    expect(taskDeadlineHasPassed({ appointment_end_local: '2026-11-02 12:00' }, '2026-11-01', 'America/Denver', now)).toBe(false);
    expect(taskDeadlineHasPassed({ scheduled_day: '2026-10-30' }, '2026-11-04', 'America/Denver', now)).toBe(false);
  });
});
