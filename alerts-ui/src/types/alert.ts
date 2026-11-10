/**
 * A fraud alert as notification-service pushes it over SSE (event name "fraud-alert").
 * This is the contract the M4 Spring Boot service must emit; the dev mock (mock/alertsMock.ts) follows it too.
 */
export interface FraudAlert {
  alertId: string;
  transactionId: string;
  accountId: number;
  cardLast4: string;
  merchant: string;
  merchantCountry: string; // ISO 3166-1 alpha-2
  category: string;
  /** Decimal string ("1249.99"), never a float, to match the BigDecimal money on the backend. */
  amount: string;
  currency: string; // ISO 4217
  /** 0..1 from fraud-service's rules. */
  riskScore: number;
  reasons: AlertReason[];
  occurredAt: string; // ISO-8601 instant
  status: AlertStatus;
}

export interface AlertReason {
  code: string;
  description: string;
}

export type AlertStatus = 'OPEN' | 'CONFIRMED_FRAUD' | 'CUSTOMER_APPROVED';

export type RiskLevel = 'high' | 'medium' | 'low';

export function riskLevel(score: number): RiskLevel {
  if (score >= 0.8) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

/** Narrow unknown JSON from the wire to a FraudAlert, so one bad message can't crash the feed. */
export function isFraudAlert(value: unknown): value is FraudAlert {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.alertId === 'string' &&
    typeof v.merchant === 'string' &&
    typeof v.amount === 'string' &&
    typeof v.currency === 'string' &&
    typeof v.riskScore === 'number' &&
    typeof v.occurredAt === 'string' &&
    Array.isArray(v.reasons)
  );
}
