import { TransactionView } from './api.models';
import { CSV_HEADER, csvCell, transactionsToCsv } from './csv';

describe('CSV export', () => {
  it('quotes cells with commas, quotes and line breaks', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('Smith, John')).toBe('"Smith, John"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
  });

  it('neutralises spreadsheet formulas in text (CSV injection)', () => {
    expect(csvCell('=HYPERLINK("http://evil.example")')).toBe('"\'=HYPERLINK(""http://evil.example"")"');
    expect(csvCell('+44 shop')).toBe("'+44 shop");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvCell('-refund')).toBe("'-refund");
  });

  it('writes numbers as numbers, even negative ones', () => {
    expect(csvCell(-12.5)).toBe('-12.5');
    expect(csvCell(null)).toBe('');
    expect(csvCell(Number.NaN)).toBe('');
  });

  it('builds a header row and one row per transaction', () => {
    const t: TransactionView = {
      id: 1,
      postedAt: '2026-09-05T10:00:00Z',
      direction: 'DEBIT',
      amount: 12.5,
      signedAmount: -12.5,
      description: 'Card payment to Tesco',
      merchant: 'Tesco',
      category: 'GROCERIES',
      balanceAfter: 100,
    };
    const lines = transactionsToCsv([t]).trimEnd().split('\r\n');
    expect(lines[0]).toBe(CSV_HEADER.join(','));
    expect(lines[1]).toBe('2026-09-05T10:00:00Z,Card payment to Tesco,Tesco,GROCERIES,DEBIT,-12.5,100');
  });
});
