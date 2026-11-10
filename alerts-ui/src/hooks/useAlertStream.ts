import { useEffect, useMemo, useRef, useState } from 'react';
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
const REPLAY_CUTOFF_MS = 10000;

/**
 * Subscribes to notification-service's Server-Sent Events stream.
 *
 * EventSource reconnects on its own and resends the last `id:` as Last-Event-ID, so the server can
 * replay anything missed; addAlert() drops duplicates if it replays too much.
 */
export function useAlertStream(url: string): AlertStream {
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [status, setStatus] = useState<StreamStatus>('connecting');
  // alertId -> when it arrived. Freshness is worked out from timestamps rather than one timer per alert,
  // because browsers throttle timers in background tabs and a "New" badge could otherwise stick.
  const [arrivals, setArrivals] = useState<Record<string, number>>({});
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
      // Only flag it "New" if it happened just now; a backlog replayed on connect isn't news.
      if (Date.now() - Date.parse(alert.occurredAt) < REPLAY_CUTOFF_MS) {
        setArrivals((prev) => ({ ...prev, [alert.alertId]: Date.now() }));
      }
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

  // While anything is fresh, tick once a second to expire it; stop ticking once nothing is.
  const hasArrivals = Object.keys(arrivals).length > 0;
  useEffect(() => {
    if (!hasArrivals) return;
    const id = window.setInterval(() => {
      setArrivals((prev) => {
        const cutoff = Date.now() - FRESH_MS;
        const kept = Object.fromEntries(Object.entries(prev).filter(([, t]) => t > cutoff));
        return Object.keys(kept).length === Object.keys(prev).length ? prev : kept;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [hasArrivals]);

  const freshIds = useMemo(() => {
    const cutoff = Date.now() - FRESH_MS;
    return new Set(Object.entries(arrivals).filter(([, t]) => t > cutoff).map(([id]) => id));
  }, [arrivals]);

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
