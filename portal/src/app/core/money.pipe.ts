import { Pipe, PipeTransform } from '@angular/core';

import { Money, formatMoney } from './money';

/** `{{ account.balance | money: account.currency }}`: formats an exact decimal string, never a float. */
@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(amount: Money | null | undefined, currency = 'GBP'): string {
    return amount == null ? '' : formatMoney(amount, currency);
  }
}
