package com.mukii.bank.account.service;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

import com.mukii.bank.account.domain.Account;
import com.mukii.bank.account.domain.AccountStatus;
import com.mukii.bank.account.domain.AccountType;

/** What the API returns for an account. The full account number is never exposed. */
public record AccountSummary(
        Long id,
        String maskedNumber,
        AccountType type,
        String currency,
        BigDecimal balance,
        AccountStatus status,
        OffsetDateTime openedAt) {

    public static AccountSummary from(Account a) {
        return new AccountSummary(a.getId(), a.maskedNumber(), a.getType(), a.getCurrency(), a.getBalance(), a.getStatus(),
                a.getOpenedAt());
    }
}
