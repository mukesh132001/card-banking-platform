package com.mukii.bank.account.service;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.mukii.bank.account.domain.Account;
import com.mukii.bank.account.domain.AccountStatus;
import com.mukii.bank.account.domain.AccountType;

/**
 * What the API returns for an account. The full account number is never exposed.
 * Money is sent as an exact decimal string ("5309.01"), never a JSON number, so no client parses it into a float.
 */
public record AccountSummary(
        Long id,
        String maskedNumber,
        AccountType type,
        String currency,
        @JsonFormat(shape = JsonFormat.Shape.STRING) BigDecimal balance,
        AccountStatus status,
        OffsetDateTime openedAt) {

    public static AccountSummary from(Account a) {
        return new AccountSummary(a.getId(), a.maskedNumber(), a.getType(), a.getCurrency(), a.getBalance(), a.getStatus(),
                a.getOpenedAt());
    }
}
