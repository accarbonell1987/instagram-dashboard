/**
 * Device ID management for device trust (Opción C — localStorage UUID).
 *
 * The hub generates a stable UUID per device and persists it in localStorage.
 * This UUID is sent to the backend on login and login/complete.
 * The backend computes SHA256(deviceId + userId) and stores it in device_trust.
 *
 * Why localStorage instead of browser fingerprinting:
 *   - Deterministic: same device always produces the same ID
 *   - Privacy-safe: no canvas/audio fingerprinting
 *   - User-controlled: clearing localStorage resets device trust
 */

const DEVICE_ID_KEY = 'hub_device_id';

/**
 * Returns the persisted device ID from localStorage, or creates a new one.
 * SSR-safe: returns an empty string on the server.
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return '';

  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/**
 * Clears the stored device ID (e.g. on logout or when the user explicitly
 * revokes device trust).
 */
export function clearDeviceId(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DEVICE_ID_KEY);
}
