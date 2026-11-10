import type { StreamStatus } from '../hooks/useAlertStream';

const LABELS: Record<StreamStatus, string> = {
  connecting: 'Connecting…',
  live: 'Live',
  reconnecting: 'Reconnecting…',
  paused: 'Paused',
};

export function StatusBadge({ status }: { status: StreamStatus }) {
  return (
    <span className={`status-badge status-badge--${status}`} role="status" aria-live="polite">
      <span className="status-badge__dot" aria-hidden="true" />
      {LABELS[status]}
    </span>
  );
}
