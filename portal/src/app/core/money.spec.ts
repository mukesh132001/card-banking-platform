import { formatMoney, fromMinorUnits, isNegative, sumMoney, toMinorUnits, toMoney } from './money';
import { MoneyPipe } from './money.pipe';

describe('money', () => {
  it('formats decimal strings as currency, digit for digit', () => {
    expect(formatMoney('5309.01', 'GBP')).toBe('£5,309.01');
    expect(formatMoney('-12.50', 'GBP')).toBe('-£12.50');
    expect(formatMoney('-0.50', 'GBP')).toBe('-£0.50');
    expect(formatMoney('0', 'GBP')).toBe('£0.00');
    expect(formatMoney('12.5', 'GBP')).toBe('£12.50');
  });

  it('stays exact beyond what a JavaScript number can hold', () => {
    // As a float this is 1234567890123456.8 (the last digit is lost).
    expect(formatMoney('1234567890123456.78', 'USD', 'en-US')).toBe('$1,234,567,890,123,456.78');
  });

  it('adds amounts without floating-point drift', () => {
    expect(0.1 + 0.2).not.toBe(0.3); // the problem
    expect(sumMoney(['0.10', '0.20'])).toBe('0.30'); // the fix
    expect(sumMoney(['5309.01', '13084.00', '-0.01'])).toBe('18393.00');
    expect(sumMoney([])).toBe('0.00');
  });

  it('converts to and from minor units', () => {
    expect(toMinorUnits('12.5')).toBe(1250n);
    expect(toMinorUnits('-0.05')).toBe(-5n);
    expect(fromMinorUnits(-5n)).toBe('-0.05');
    expect(fromMinorUnits(130840n)).toBe('1308.40');
    expect(isNegative('-12.50')).toBeTrue();
    expect(isNegative('0.00')).toBeFalse();
  });

  it('accepts the old number format and rejects junk', () => {
    expect(toMoney('5309.01')).toBe('5309.01');
    expect(toMoney(13084)).toBe('13084');
    expect(toMoney('12,50')).toBe('0');
    expect(toMoney(null)).toBe('0');
  });

  it('is available in templates as the money pipe', () => {
    const pipe = new MoneyPipe();
    expect(pipe.transform('-12.50', 'GBP')).toBe('-£12.50');
    expect(pipe.transform(null)).toBe('');
  });
});
