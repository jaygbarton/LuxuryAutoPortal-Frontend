import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareClockInPayload, readClockInLocation } from './clockInLocation';

afterEach(() => vi.unstubAllGlobals());
const policy = (required: boolean) => vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true, data: { required, configured: true } }) })));
const position = { coords: { latitude: 40.769046, longitude: -111.941818, accuracy: 12 }, timestamp: Date.now() };

describe('clock-in location permission', () => {
  it('does not request location for server-exempt admins and super admins', async () => {
    const getCurrentPosition = vi.fn();
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
    policy(false);
    expect(await prepareClockInPayload()).toEqual({});
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });
  it('asks for a fresh high-accuracy reading only when required', async () => {
    const getCurrentPosition = vi.fn((success: (value: typeof position) => void, _failure: unknown, _options: unknown) => success(position));
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
    policy(true);
    const locating = vi.fn();
    expect(await prepareClockInPayload(locating)).toEqual({ location: { ...position.coords, timestamp: position.timestamp } });
    expect(getCurrentPosition.mock.calls[0][2]).toEqual({ enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
    expect(locating.mock.calls).toEqual([[true], [false]]);
  });
  it('denies a failed permission attempt, then asks again on a new attempt', async () => {
    const getCurrentPosition = vi.fn().mockImplementationOnce((_success, failure) => failure({ code: 1 })).mockImplementationOnce(success => success(position));
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
    policy(true);
    await expect(prepareClockInPayload()).rejects.toThrow('site settings');
    expect(await prepareClockInPayload()).toHaveProperty('location');
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
  });
  it.each([[2, 'could not be determined'], [3, 'timed out']])('explains a location failure (%s)', async (code, message) => {
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: (_success: unknown, failure: (error: { code: number }) => void) => failure({ code: Number(code) }) } });
    await expect(readClockInLocation()).rejects.toThrow(String(message));
  });
  it('does not silently skip policy failures or an unavailable location API', async () => {
    vi.stubGlobal('navigator', {});
    await expect(readClockInLocation()).rejects.toThrow('unavailable');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    await expect(prepareClockInPayload()).rejects.toThrow('verify clock-in requirements');
  });
});
