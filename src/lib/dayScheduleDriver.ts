type DriverTask = { type: string; location?: string | null; requires_driver?: boolean; airport_parking_required?: boolean; driver_assignment_type?: string | null; driver_assigned_to_id?: number | null };

export function needsTaskDriver(event: DriverTask): boolean {
  if (/\b50\s*(?:s|south)\.?\s+redwood\b/i.test(event.location || '')) return false;
  if (event.requires_driver !== undefined) return event.requires_driver;
  return event.type === 'custom' || event.type === 'airport' || event.airport_parking_required === true
    || ['pickup', 'delivery'].includes(event.type) && /\bair\s*port\b|\bterminal\b|^(SLC|ILM|LAS|MCO|TPA|DEN|PHX|LAX|SFO)$/i.test((event.location || '').trim());
}

export function hasTaskDriver(event: DriverTask): boolean {
  return event.driver_assignment_type === 'employee' && Number.isSafeInteger(event.driver_assigned_to_id) && Number(event.driver_assigned_to_id) > 0;
}
