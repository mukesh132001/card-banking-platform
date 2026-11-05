package com.mukii.bank.account.domain;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Locale;

import org.springframework.data.jpa.domain.Specification;

/** Composable filters for the transactions page. A null filter means "no filter". */
public final class TransactionSpecs {

    private TransactionSpecs() {
    }

    public static Specification<CardTransaction> forAccount(Long accountId) {
        return (root, query, cb) -> cb.equal(root.get("account").get("id"), accountId);
    }

    /** On or after the start of this day (UTC). */
    public static Specification<CardTransaction> postedFrom(LocalDate from) {
        if (from == null) {
            return null;
        }
        return (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("postedAt"), from.atStartOfDay().atOffset(ZoneOffset.UTC));
    }

    /** On or before the end of this day (UTC): everything before the next midnight. */
    public static Specification<CardTransaction> postedTo(LocalDate to) {
        if (to == null) {
            return null;
        }
        return (root, query, cb) -> cb.lessThan(root.get("postedAt"), to.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC));
    }

    public static Specification<CardTransaction> direction(Direction direction) {
        if (direction == null) {
            return null;
        }
        return (root, query, cb) -> cb.equal(root.get("direction"), direction);
    }

    /** Case-insensitive match on description or merchant. */
    public static Specification<CardTransaction> search(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String pattern = "%" + text.trim().toLowerCase(Locale.ROOT) + "%";
        return (root, query, cb) -> cb.or(
                cb.like(cb.lower(root.get("description")), pattern),
                cb.like(cb.lower(root.get("merchant")), pattern));
    }
}
