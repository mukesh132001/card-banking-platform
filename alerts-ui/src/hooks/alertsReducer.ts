import type { FraudAlert } from '../types/alert';

export const MAX_ALERTS = 50;

/**
 * Newest first, de-duplicated by alertId (SSE can redeliver after a reconnect), capped at MAX_ALERTS
 * so a long-open tab doesn't grow forever. Pure, so it is easy to unit test.
 */
export function addAlert(alerts: FraudAlert[], incoming: FraudAlert, max = MAX_ALERTS): FraudAlert[] {
  if (alerts.some((a) => a.alertId === incoming.alertId)) return alerts;
  return [incoming, ...alerts].slice(0, max);
}
