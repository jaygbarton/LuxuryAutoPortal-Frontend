import { buildApiUrl } from './queryClient';

export type ClockInLocation = { latitude: number; longitude: number; accuracy: number; timestamp: number };

/** Called on each employee clock-in attempt, never on clock-out or in the
 * background. Do not cache permission decisions: a retry must ask the browser. */
export function readClockInLocation(): Promise<ClockInLocation> {
  return new Promise((resolve, reject) => {
    if (!globalThis.navigator?.geolocation) {
      reject(new Error('Location is unavailable in this browser. Use a device with location services enabled to clock in.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(position => resolve({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp,
    }), error => reject(new Error(error.code === 1
      ? 'Location permission is required to clock in. Allow location in this browser’s site settings, then tap Clock in again.'
      : error.code === 3
        ? 'Location lookup timed out. Check location services and try Clock in again.'
        : 'Your location could not be determined. Enable precise location and try Clock in again.')),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 });
  });
}

/** Server roles decide exemption; no permission prompt for admins/super admins,
 * even when they are also employees or are using an employee-facing screen. */
export async function prepareClockInPayload(onLocating: (locating: boolean) => void = () => {}): Promise<{ location?: ClockInLocation }> {
  const response = await fetch(buildApiUrl('/api/me/time-sheet/clock-in-policy'), { credentials: 'include', cache: 'no-store' });
  const policy = await response.json().catch(() => null);
  if (!response.ok || policy?.success !== true || typeof policy?.data?.required !== 'boolean') {
    throw new Error('Could not verify clock-in requirements. Refresh and try again.');
  }
  if (!policy.data.required) return {};
  if (policy.data.configured !== true) throw new Error('The clock-in location has not been configured. Please contact an administrator.');
  onLocating(true);
  try { return { location: await readClockInLocation() }; }
  finally { onLocating(false); }
}
