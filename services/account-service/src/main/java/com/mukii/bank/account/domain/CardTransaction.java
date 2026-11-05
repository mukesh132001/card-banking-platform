package com.mukii.bank.account.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "card_transaction")
public class CardTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    @Column(name = "posted_at", nullable = false)
    private OffsetDateTime postedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 6)
    private Direction direction;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false)
    private String description;

    private String merchant;

    private String category;

    @Column(name = "balance_after", nullable = false, precision = 19, scale = 2)
    private BigDecimal balanceAfter;

    protected CardTransaction() {
        // for JPA
    }

    public CardTransaction(Account account, OffsetDateTime postedAt, Direction direction, BigDecimal amount,
            String description, String merchant, String category, BigDecimal balanceAfter) {
        this.account = account;
        this.postedAt = postedAt;
        this.direction = direction;
        this.amount = amount;
        this.description = description;
        this.merchant = merchant;
        this.category = category;
        this.balanceAfter = balanceAfter;
    }

    /** Positive for money in, negative for money out. */
    public BigDecimal signedAmount() {
        return direction == Direction.CREDIT ? amount : amount.negate();
    }

    public Long getId() {
        return id;
    }

    public Account getAccount() {
        return account;
    }

    public OffsetDateTime getPostedAt() {
        return postedAt;
    }

    public Direction getDirection() {
        return direction;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public String getDescription() {
        return description;
    }

    public String getMerchant() {
        return merchant;
    }

    public String getCategory() {
        return category;
    }

    public BigDecimal getBalanceAfter() {
        return balanceAfter;
    }
}
