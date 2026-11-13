export type OperationsFleetFilter = "active" | "inactive" | "all";
export interface OperationsVehicle { carId: number; carName: string; plateNumber: string | null; vinNumber: string | null; carStatus: string | null }
export const isActiveFleetStatus = (status: unknown) => ['active', 'available', 'in_use'].includes(String(status ?? '').trim().toLowerCase());
const identifier = (v: unknown) => String(v ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
const nameKey = (v: unknown) => String(v ?? '').toLowerCase().replace(/\b(?:19|20)\d{2}\b/g, '').replace(/[^a-z0-9]/g, '');
const usablePlate = (v: unknown) => !['', 'TEMP', 'TEMPORARY', 'TBD', 'NA', 'UNKNOWN'].includes(identifier(v));

/**
 * Filtering only: source identities and authorization are never rewritten.
 *
 * Identity is tried strongest first (car id, VIN, plate, name). A weaker key
 * is used only when the stronger one is absent or names no catalogue car, so a
 * stale VIN does not hide a trip whose plate is known. When a key names
 * several car rows (a model shared by two cars, or a re-onboarded duplicate),
 * the row counts as Active if any of those cars is in the fleet and as
 * Inactive only if none is: real work must not disappear from the default
 * Active view because its identity is ambiguous. G161UZ (Subaru Outback) was
 * hidden that way whenever a Turo email omitted the plate.
 */
export function operationVehicleMatches(row: any, cars: OperationsVehicle[], fleet: OperationsFleetFilter): boolean {
  if (fleet === 'all') return true;
  const id = row.carId ?? row.car_id ?? row.tv_car_id ?? row.ti_car_id ?? row.cr_car_id;
  const vin = row.vinNumber ?? row.vin_number ?? row.vin;
  const plate = row.plateNumber ?? row.plate_number ?? row.plate ?? row.car_plate;
  const label = row.carName ?? row.car_name ?? row.tv_car_label ?? row.ti_car_label ?? row.cr_car_label;
  const usableVin = usablePlate(vin) && !['NONE', 'NULL', '0'].includes(identifier(vin));
  const attempts: Array<() => OperationsVehicle[]> = [];
  if (Number(id) > 0) attempts.push(() => cars.filter(c => c.carId === Number(id)));
  if (usableVin) attempts.push(() => cars.filter(c => identifier(c.vinNumber) === identifier(vin)));
  if (usablePlate(plate)) attempts.push(() => cars.filter(c => identifier(c.plateNumber) === identifier(plate)));
  if (nameKey(label)) attempts.push(() => cars.filter(c => nameKey(c.carName) === nameKey(label)));
  if (attempts.length === 0) return true; // Non-vehicle employee tasks remain visible.
  for (const attempt of attempts) {
    const matches = attempt();
    if (matches.length === 0) continue;
    const anyActive = matches.some(c => isActiveFleetStatus(c.carStatus));
    return fleet === 'active' ? anyActive : !anyActive;
  }
  // No catalogue car at all: reviewable under All vehicles / records.
  return false;
}
