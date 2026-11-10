import { Money, TransactionView } from './api.models';

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

/**
 * A money cell, written exactly as the API sent it ("-12.50"), so Excel reads a number. Only a strict decimal is let
 * through unquoted; anything else is treated as text by csvCell (and so formula-neutralised).
 */
export function csvMoney(value: Money | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  return /^-?\d+(\.\d+)?$/.test(value) ? value : csvCell(value);
}

export function transactionsToCsv(rows: TransactionView[]): string {
  const lines = [CSV_HEADER.map(csvCell).join(',')];
  for (const t of rows) {
    lines.push(
      [
        csvCell(t.postedAt),
        csvCell(t.description),
        csvCell(t.merchant),
        csvCell(t.category),
        csvCell(t.direction),
        csvMoney(t.signedAmount),
        csvMoney(t.balanceAfter),
      ].join(','),
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
