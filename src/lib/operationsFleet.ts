export type OperationsFleetFilter = "active" | "inactive" | "all";
export interface OperationsVehicle { carId: number; carName: string; plateNumber: string | null; vinNumber: string | null; carStatus: string | null }
export const isActiveFleetStatus = (status: unknown) => ['active', 'available', 'in_use'].includes(String(status ?? '').trim().toLowerCase());
const identifier = (v: unknown) => String(v ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
const nameKey = (v: unknown) => String(v ?? '').toLowerCase().replace(/\b(?:19|20)\d{2}\b/g, '').replace(/[^a-z0-9]/g, '');
const usablePlate = (v: unknown) => !['', 'TEMP', 'TEMPORARY', 'TBD', 'NA', 'UNKNOWN'].includes(identifier(v));

/** Filtering only: source identities and authorization are never rewritten. */
export function operationVehicleMatches(row: any, cars: OperationsVehicle[], fleet: OperationsFleetFilter): boolean {
  if (fleet === 'all') return true;
  const id = row.carId ?? row.car_id ?? row.tv_car_id ?? row.ti_car_id ?? row.cr_car_id;
  const vin = row.vinNumber ?? row.vin_number ?? row.vin;
  const plate = row.plateNumber ?? row.plate_number ?? row.plate ?? row.car_plate;
  const label = row.carName ?? row.car_name ?? row.tv_car_label ?? row.ti_car_label ?? row.cr_car_label;
  let matches: OperationsVehicle[];
  if (Number(id) > 0) matches = cars.filter(c => c.carId === Number(id));
  else if (usablePlate(vin) && !['NONE', 'NULL', '0'].includes(identifier(vin))) matches = cars.filter(c => identifier(c.vinNumber) === identifier(vin));
  else if (usablePlate(plate)) matches = cars.filter(c => identifier(c.plateNumber) === identifier(plate));
  else if (nameKey(label)) matches = cars.filter(c => nameKey(c.carName) === nameKey(label));
  else return true; // Non-vehicle employee tasks remain visible.
  // Unknown/ambiguous identities can be reviewed explicitly under All vehicles.
  return matches.length === 1 && isActiveFleetStatus(matches[0].carStatus) === (fleet === 'active');
}
