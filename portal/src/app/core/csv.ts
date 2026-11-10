import { TransactionView } from './api.models';

export const CSV_HEADER = ['Date', 'Description', 'Merchant', 'Category', 'Direction', 'Amount', 'Balance after'];

/**
 * One CSV cell (RFC 4180): quoted if it contains a comma, quote or line break.
 * Text that starts with = + - @ or a tab is prefixed with ' so Excel shows it instead of running it as a
 * formula ("CSV injection"); a merchant name is data the bank doesn't control. Numbers are written as-is.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function transactionsToCsv(rows: TransactionView[]): string {
  const lines = [CSV_HEADER.map(csvCell).join(',')];
  for (const t of rows) {
    lines.push(
      [
        t.postedAt,
        t.description,
        t.merchant,
        t.category,
        t.direction,
        Number(t.signedAmount.toFixed(2)),
        Number(t.balanceAfter.toFixed(2)),
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return lines.join('\r\n') + '\r\n';
}

/** Saves text as a file. The BOM makes Excel read it as UTF-8 (so £ and accents survive). */
export function downloadCsv(filename: string, csv: string): void {
  const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
