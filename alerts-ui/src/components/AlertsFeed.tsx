import { useEffect, useMemo, useState } from 'react';
import { useAlertStream } from '../hooks/useAlertStream';
import { riskLevel, type RiskLevel } from '../types/alert';
import { AlertCard } from './AlertCard';
import { StatusBadge } from './StatusBadge';

type Filter = 'all' | RiskLevel;
const FILTERS: Filter[] = ['all', 'high', 'medium', 'low'];

export function AlertsFeed({ streamUrl }: { streamUrl: string }) {
  const { alerts, status, freshIds, paused, setPaused, clear } = useAlertStream(streamUrl);
  const [filter, setFilter] = useState<Filter>('all');
  const now = useNow(15000); // keeps "2 minutes ago" labels current

  const counts = useMemo(() => {
    const c = { all: alerts.length, high: 0, medium: 0, low: 0 };
    for (const a of alerts) c[riskLevel(a.riskScore)]++;
    return c;
  }, [alerts]);

  const visible = filter === 'all' ? alerts : alerts.filter((a) => riskLevel(a.riskScore) === filter);

  return (
    <section className="feed" aria-labelledby="feed-title">
      <header className="feed__header">
        <div>
          <h2 id="feed-title" className="feed__title">
            Live fraud alerts
          </h2>
          <p className="feed__subtitle">Streamed from notification-service over Server-Sent Events</p>
        </div>
        <StatusBadge status={status} />
      </header>

      <div className="feed__toolbar">
        <div className="chips" role="group" aria-label="Filter by risk">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={`chip chip--${f}`}
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f[0].toUpperCase() + f.slice(1)}
              <span className="chip__count">{counts[f]}</span>
            </button>
          ))}
        </div>
        <div className="feed__actions">
          <button type="button" className="btn" onClick={() => setPaused(!paused)}>
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button type="button" className="btn btn--ghost" onClick={clear} disabled={alerts.length === 0}>
            Clear
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="feed__empty">
          {alerts.length === 0
            ? status === 'live'
              ? 'No alerts yet. New ones appear here the moment fraud-service flags a payment.'
              : 'Waiting for the alert stream…'
            : `No ${filter}-risk alerts right now.`}
        </p>
      ) : (
        <ol className="feed__list" aria-live="polite" aria-relevant="additions">
          {visible.map((a) => (
            <AlertCard key={a.alertId} alert={a} fresh={freshIds.has(a.alertId)} now={now} />
          ))}
        </ol>
      )}
    </section>
  );
}

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
