/**
 * Money helpers that never go through floating point.
 *
 * The API sends amounts as exact decimal strings ("5309.01", "-12.50"). `0.1 + 0.2` is 0.30000000000000004 in
 * JavaScript, so totals are added as BigInt minor units (pence/cents) and formatted digit-for-digit.
 */

/** An exact decimal amount as sent by the API, e.g. "5309.01" or "-12.50". */
export type Money = string;

const DECIMAL = /^([+-])?(\d+)(?:\.(\d+))?$/;

/**
 * Turns whatever the API sent into a clean decimal string. Strings are kept as-is (only validated); a number is
 * accepted only as a fallback for an older API and converted with toString, which is exact for 2-decimal amounts
 * up to about 90 trillion.
 */
export function toMoney(value: string | number | null | undefined): Money {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '0';
  }
  const text = (value ?? '').trim();
  return DECIMAL.test(text) ? text : '0';
}

interface Parsed {
  negative: boolean;
  integer: bigint;
  /** Fraction digits, exactly as written (may be longer or shorter than the currency's). */
  fraction: string;
}

function parse(amount: Money): Parsed {
  const m = DECIMAL.exec(amount.trim());
  if (!m) {
    return { negative: false, integer: 0n, fraction: '' };
  }
  return { negative: m[1] === '-', integer: BigInt(m[2]), fraction: m[3] ?? '' };
}

/** Amount in minor units at the given scale, e.g. ("12.5", 2) -> 1250n. Extra digits are truncated, never rounded. */
export function toMinorUnits(amount: Money, scale = 2): bigint {
  const p = parse(amount);
  const fraction = BigInt((p.fraction + '0'.repeat(scale)).slice(0, scale) || '0');
  const units = p.integer * 10n ** BigInt(scale) + fraction;
  return p.negative ? -units : units;
}

/** Inverse of toMinorUnits: 1250n -> "12.50". */
export function fromMinorUnits(units: bigint, scale = 2): Money {
  const negative = units < 0n;
  const abs = negative ? -units : units;
  const digits = abs.toString().padStart(scale + 1, '0');
  const integer = digits.slice(0, digits.length - scale);
  const fraction = digits.slice(digits.length - scale);
  return `${negative ? '-' : ''}${integer}${scale > 0 ? '.' + fraction : ''}`;
}

/** Exact sum of decimal strings. */
export function sumMoney(amounts: Money[], scale = 2): Money {
  return fromMinorUnits(
    amounts.reduce((total, a) => total + toMinorUnits(a, scale), 0n),
    scale,
  );
}

export function isNegative(amount: Money): boolean {
  return toMinorUnits(amount) < 0n;
}

/**
 * Formats a decimal string as currency without converting it to a float.
 * Intl formats the whole-number part (exact for BigInt) to get the right symbol, grouping and sign for the locale;
 * the fraction digits are then dropped in exactly as the API sent them.
 */
export function formatMoney(amount: Money, currency: string, locale = 'en-GB'): string {
  let nf: Intl.NumberFormat;
  try {
    nf = new Intl.NumberFormat(locale, { style: 'currency', currency });
  } catch {
    nf = new Intl.NumberFormat(locale, { style: 'currency', currency: 'GBP' });
  }
  const scale = nf.resolvedOptions().maximumFractionDigits ?? 2;
  const units = toMinorUnits(amount, scale);
  const negative = units < 0n;
  const abs = negative ? -units : units;
  const whole = abs / 10n ** BigInt(scale);
  const fraction = scale > 0 ? (abs % 10n ** BigInt(scale)).toString().padStart(scale, '0') : '';

  // Format the whole part with the sign applied, so the locale decides where "-" goes ("-£12.50").
  // -0n is 0n, so for amounts like -0.50 format -1 and swap the digit back.
  const parts = nf.formatToParts(negative ? (whole === 0n ? -1n : -whole) : whole);
  let wroteFraction = false;
  const out = parts.map((part) => {
    if (part.type === 'integer' && negative && whole === 0n) {
      return '0';
    }
    if (part.type === 'fraction') {
      wroteFraction = true;
      return fraction;
    }
    return part.value;
  });
  if (!wroteFraction && scale > 0) {
    // Some engines drop the fraction for a BigInt; put it back after the last integer digit.
    const lastInteger = parts.map((p) => p.type).lastIndexOf('integer');
    out.splice(lastInteger + 1, 0, '.' + fraction);
  }
  return out.join('');
}
