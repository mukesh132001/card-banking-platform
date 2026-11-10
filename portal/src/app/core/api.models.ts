/** Shapes returned by the account service (see services/account-service). */

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
  balance: number;
  status: 'ACTIVE' | 'FROZEN' | 'CLOSED';
  openedAt: string;
}

export interface TransactionView {
  id: number;
  postedAt: string;
  direction: Direction;
  amount: number;
  signedAmount: number;
  description: string;
  merchant: string | null;
  category: string | null;
  balanceAfter: number;
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

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CHECKING: 'Current account',
  SAVINGS: 'Savings',
  CREDIT_CARD: 'Credit card',
};
