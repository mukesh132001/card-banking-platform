/** Shapes returned by the account service (see services/account-service). */

import { Money } from './money';

export type { Money } from './money';

export interface TokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  refreshToken: string;
}

export type AccountType = 'CHECKING' | 'SAVINGS' | 'CREDIT_CARD';
export type Direction = 'CREDIT' | 'DEBIT';

export interface AccountSummary {
  id: number;
  maskedNumber: string;
  type: AccountType;
  currency: string;
  /** Exact decimal string, e.g. "5309.01". */
  balance: Money;
  status: 'ACTIVE' | 'FROZEN' | 'CLOSED';
  openedAt: string;
}

export interface TransactionView {
  id: number;
  postedAt: string;
  direction: Direction;
  amount: Money;
  /** Negative for money out. */
  signedAmount: Money;
  description: string;
  merchant: string | null;
  category: string | null;
  balanceAfter: Money;
}

export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** RFC 7807 problem detail, the body of every API error. */
export interface ProblemDetail {
  title?: string;
  status?: number;
  detail?: string;
}

export interface TransactionFilters {
  from?: string;
  to?: string;
  direction?: Direction | '';
  q?: string;
}

export type Role = 'CUSTOMER' | 'ADMIN';

/** GET /api/admin/users */
export interface AdminUser {
  id: number;
  email: string;
  role: Role;
  customerId: number | null;
  failedAttempts: number;
  locked: boolean;
}

/** GET /api/admin/customers */
export interface AdminCustomer {
  id: number;
  email: string;
  fullName: string;
  accounts: number;
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CHECKING: 'Current account',
  SAVINGS: 'Savings',
  CREDIT_CARD: 'Credit card',
};
