package com.mukii.bank.account.service;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.mukii.bank.account.domain.CardTransaction;
import com.mukii.bank.account.domain.Direction;

/** Money fields are exact decimal strings ("-12.50"), never JSON numbers. */
public record TransactionView(
        Long id,
        OffsetDateTime postedAt,
        Direction direction,
        @JsonFormat(shape = JsonFormat.Shape.STRING) BigDecimal amount,
        @JsonFormat(shape = JsonFormat.Shape.STRING) BigDecimal signedAmount,
        String description,
        String merchant,
        String category,
        @JsonFormat(shape = JsonFormat.Shape.STRING) BigDecimal balanceAfter) {

    public static TransactionView from(CardTransaction t) {
        return new TransactionView(t.getId(), t.getPostedAt(), t.getDirection(), t.getAmount(), t.signedAmount(),
                t.getDescription(), t.getMerchant(), t.getCategory(), t.getBalanceAfter());
    }
}
