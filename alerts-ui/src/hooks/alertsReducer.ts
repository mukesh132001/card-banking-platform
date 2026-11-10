import type { FraudAlert } from '../types/alert';

export const MAX_ALERTS = 50;

/**
 * Newest first by occurredAt (a replayed or late event lands in its right place, not on top),
 * de-duplicated by alertId (SSE can redeliver after a reconnect), capped at MAX_ALERTS so a long-open
 * tab doesn't grow forever. Pure, so it is easy to unit test.
 */
export function addAlert(alerts: FraudAlert[], incoming: FraudAlert, max = MAX_ALERTS): FraudAlert[] {
  if (alerts.some((a) => a.alertId === incoming.alertId)) return alerts;
  const t = Date.parse(incoming.occurredAt);
  const at = alerts.findIndex((a) => Date.parse(a.occurredAt) < t);
  const next = at === -1 ? [...alerts, incoming] : [...alerts.slice(0, at), incoming, ...alerts.slice(at)];
  return next.slice(0, max);
}
