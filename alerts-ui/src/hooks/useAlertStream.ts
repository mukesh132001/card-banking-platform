import { useEffect, useRef, useState } from 'react';
import { isFraudAlert, type FraudAlert } from '../types/alert';
import { addAlert } from './alertsReducer';

export type StreamStatus = 'connecting' | 'live' | 'reconnecting' | 'paused';

export interface AlertStream {
  alerts: FraudAlert[];
  status: StreamStatus;
  /** Ids that arrived in the last few seconds, for the "new" highlight. */
  freshIds: ReadonlySet<string>;
  lastEventAt: number | null;
  paused: boolean;
  setPaused: (paused: boolean) => void;
  clear: () => void;
}

const FRESH_MS = 4000;

/**
 * Subscribes to notification-service's Server-Sent Events stream.
 *
 * EventSource reconnects on its own and resends the last `id:` as Last-Event-ID, so the server can
 * replay anything missed; addAlert() drops duplicates if it replays too much.
 */
export function useAlertStream(url: string): AlertStream {
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [status, setStatus] = useState<StreamStatus>('connecting');
  const [freshIds, setFreshIds] = useState<ReadonlySet<string>>(new Set());
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [reconnectKey, setReconnectKey] = useState(0); // bumped to reopen after the browser gives up
  const failures = useRef(0);
  const timers = useRef<number[]>([]);
  const seen = useRef(new Set<string>()); // ids already shown, so replays after a reconnect aren't flagged "new"

  useEffect(() => {
    if (paused) {
      setStatus('paused');
      return;
    }
    setStatus('connecting');
    const source = new EventSource(url);

    const onAlert = (event: MessageEvent<string>) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        console.warn('[alerts] ignoring malformed event', event.data);
        return;
      }
      if (!isFraudAlert(parsed)) {
        console.warn('[alerts] ignoring event that is not a FraudAlert', parsed);
        return;
      }
      const alert = parsed;
      if (seen.current.has(alert.alertId)) return;
      seen.current.add(alert.alertId);
      if (seen.current.size > 500) seen.current.delete(seen.current.values().next().value!); // oldest first
      setAlerts((prev) => addAlert(prev, alert));
      setLastEventAt(Date.now());
      setFreshIds((prev) => new Set(prev).add(alert.alertId));
      timers.current.push(
        window.setTimeout(() => {
          setFreshIds((prev) => {
            const next = new Set(prev);
            next.delete(alert.alertId);
            return next;
          });
        }, FRESH_MS),
      );
    };

    source.onopen = () => {
      setStatus('live');
      failures.current = 0;
    };
    source.onerror = () => {
      setStatus('reconnecting');
      // CONNECTING: the browser is already retrying (network blip, server restart).
      // CLOSED: it gave up (a non-200 or wrong content type), so retry ourselves with capped backoff.
      if (source.readyState === EventSource.CLOSED) {
        const delay = Math.min(30000, 1000 * 2 ** failures.current++);
        timers.current.push(window.setTimeout(() => setReconnectKey((k) => k + 1), delay));
      }
    };
    source.addEventListener('fraud-alert', onAlert as EventListener);

    return () => {
      source.removeEventListener('fraud-alert', onAlert as EventListener);
      source.close();
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [url, paused, reconnectKey]);

  return {
    alerts,
    status,
    freshIds,
    lastEventAt,
    paused,
    setPaused,
    clear: () => setAlerts([]), // `seen` is kept, so cleared alerts don't come back on a replay
  };
}
