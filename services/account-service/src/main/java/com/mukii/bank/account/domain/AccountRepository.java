package com.mukii.bank.account.domain;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AccountRepository extends JpaRepository<Account, Long> {

    List<Account> findByCustomerIdOrderByIdAsc(Long customerId);

    /** Ownership check built into the query: another customer's account is simply "not found". */
    Optional<Account> findByIdAndCustomerId(Long id, Long customerId);
}
