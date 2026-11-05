package com.mukii.bank.account.service;

import java.time.LocalDate;

import com.mukii.bank.account.domain.Direction;

/** Optional filters for the transactions page; any field may be null. */
public record TransactionFilter(LocalDate from, LocalDate to, Direction direction, String search) {

    public static TransactionFilter none() {
        return new TransactionFilter(null, null, null, null);
    }
}
