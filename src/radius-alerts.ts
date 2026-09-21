const RADIUS_ALERTS_KEY = 'socbizmap.radiusAlerts';

/** In-app radius alerts, separate from browser geolocation permission. */
export function readRadiusAlertsEnabled(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(RADIUS_ALERTS_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeRadiusAlertsEnabled(on: boolean): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (on) localStorage.setItem(RADIUS_ALERTS_KEY, '1');
    else localStorage.removeItem(RADIUS_ALERTS_KEY);
  } catch {
    // private mode / blocked storage
  }
}
