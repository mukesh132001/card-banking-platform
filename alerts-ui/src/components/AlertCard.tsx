import { riskLevel, type FraudAlert } from '../types/alert';
import { countryName, formatMoney, timeAgo } from '../lib/format';

interface Props {
  alert: FraudAlert;
  fresh: boolean;
  now: number;
}

export function AlertCard({ alert, fresh, now }: Props) {
  const level = riskLevel(alert.riskScore);
  return (
    <li className={`alert-card alert-card--${level}${fresh ? ' alert-card--fresh' : ''}`}>
      <div className="alert-card__main">
        <div className="alert-card__title">
          <span className="alert-card__merchant">{alert.merchant}</span>
          {fresh && <span className="alert-card__new">New</span>}
        </div>
        <div className="alert-card__meta">
          Card •••• {alert.cardLast4} · {countryName(alert.merchantCountry)} ·{' '}
          <time dateTime={alert.occurredAt} title={new Date(alert.occurredAt).toLocaleString()}>
            {timeAgo(alert.occurredAt, now)}
          </time>
        </div>
        <ul className="alert-card__reasons">
          {alert.reasons.map((r) => (
            <li key={r.code} title={r.code}>
              {r.description}
            </li>
          ))}
        </ul>
      </div>
      <div className="alert-card__side">
        <span className="alert-card__amount">{formatMoney(alert.amount, alert.currency)}</span>
        <span className={`risk-pill risk-pill--${level}`} aria-label={`Risk score ${Math.round(alert.riskScore * 100)} out of 100`}>
          {level} · {Math.round(alert.riskScore * 100)}
        </span>
      </div>
    </li>
  );
}
