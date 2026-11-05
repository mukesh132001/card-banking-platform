package com.mukii.bank.account.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface CardTransactionRepository
        extends JpaRepository<CardTransaction, Long>, JpaSpecificationExecutor<CardTransaction> {
}
