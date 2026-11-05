package com.mukii.bank.account.service;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

import com.mukii.bank.account.domain.CardTransaction;
import com.mukii.bank.account.domain.Direction;

public record TransactionView(
        Long id,
        OffsetDateTime postedAt,
        Direction direction,
        BigDecimal amount,
        BigDecimal signedAmount,
        String description,
        String merchant,
        String category,
        BigDecimal balanceAfter) {

    public static TransactionView from(CardTransaction t) {
        return new TransactionView(t.getId(), t.getPostedAt(), t.getDirection(), t.getAmount(), t.signedAmount(),
                t.getDescription(), t.getMerchant(), t.getCategory(), t.getBalanceAfter());
    }
}
