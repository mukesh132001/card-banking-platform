package com.mukii.bank.account.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

/**
 * JPA mappings + Flyway migrations + query filters, on the H2 (PostgreSQL mode) database from application.yml.
 * The same checks run against real PostgreSQL in {@link PostgresContainerTest}.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class RepositoryTest {

    @Autowired
    CustomerRepository customers;

    @Autowired
    AccountRepository accounts;

    @Autowired
    CardTransactionRepository transactions;

    @Test
    void flywayLoadsTheSchemaAndDemoData() {
        RepositoryChecks.demoDataIsLoaded(customers, accounts, transactions);
    }

    @Test
    void filtersCombine() {
        RepositoryChecks.filtersWork(customers, accounts, transactions);
    }
}

/** Shared assertions so H2 and PostgreSQL are held to exactly the same expectations. */
final class RepositoryChecks {

    static final String ALEX = "alex.morgan@example.com";
    static final String ALEX_CHECKING = "GB00DEMO00000012341234";

    private RepositoryChecks() {
    }

    static Account alexChecking(CustomerRepository customers, AccountRepository accounts) {
        Long alexId = customers.findByEmail(ALEX).orElseThrow().getId();
        return accounts.findByCustomerIdOrderByIdAsc(alexId).stream()
                .filter(a -> a.getAccountNumber().equals(ALEX_CHECKING)).findFirst().orElseThrow();
    }

    static void demoDataIsLoaded(CustomerRepository customers, AccountRepository accounts, CardTransactionRepository transactions) {
        assertThat(customers.count()).isEqualTo(2);
        assertThat(accounts.count()).isEqualTo(3);
        assertThat(transactions.count()).isEqualTo(56);

        Customer alex = customers.findByEmail(ALEX).orElseThrow();
        assertThat(accounts.findByCustomerIdOrderByIdAsc(alex.getId())).hasSize(2);

        Account checking = alexChecking(customers, accounts);
        assertThat(checking.getBalance()).isEqualByComparingTo("5309.01");
        assertThat(checking.getType()).isEqualTo(AccountType.CHECKING);
        assertThat(checking.maskedNumber()).isEqualTo("•••• 1234");

        // Ownership is part of the query: Alex's account is invisible to Priya.
        Long priyaId = customers.findByEmail("priya.shah@example.com").orElseThrow().getId();
        assertThat(accounts.findByIdAndCustomerId(checking.getId(), priyaId)).isEmpty();
        assertThat(accounts.findByIdAndCustomerId(checking.getId(), alex.getId())).isPresent();
    }

    static void filtersWork(CustomerRepository customers, AccountRepository accounts, CardTransactionRepository transactions) {
        Long id = alexChecking(customers, accounts).getId();
        Sort newest = Sort.by(Sort.Order.desc("postedAt"), Sort.Order.desc("id"));

        Page<CardTransaction> all = transactions.findAll(TransactionSpecs.forAccount(id), PageRequest.of(0, 5, newest));
        assertThat(all.getTotalElements()).isEqualTo(26);
        assertThat(all.getTotalPages()).isEqualTo(6);
        assertThat(all.getContent().get(0).getMerchant()).isEqualTo("Netflix");
        assertThat(all.getContent().get(0).getBalanceAfter()).isEqualByComparingTo("5309.01");

        assertThat(count(transactions, Specification.where(TransactionSpecs.forAccount(id))
                .and(TransactionSpecs.direction(Direction.CREDIT)))).isEqualTo(2);
        assertThat(count(transactions, Specification.where(TransactionSpecs.forAccount(id))
                .and(TransactionSpecs.search("TESCO")))).isEqualTo(4);
        assertThat(count(transactions, Specification.where(TransactionSpecs.forAccount(id))
                .and(TransactionSpecs.postedFrom(LocalDate.parse("2026-09-01")))
                .and(TransactionSpecs.postedTo(LocalDate.parse("2026-09-30"))))).isEqualTo(17);
        // Null filters are ignored.
        assertThat(count(transactions, Specification.where(TransactionSpecs.forAccount(id))
                .and(TransactionSpecs.search(null)).and(TransactionSpecs.direction(null)))).isEqualTo(26);
    }

    private static long count(CardTransactionRepository transactions, Specification<CardTransaction> spec) {
        return transactions.count(spec);
    }
}
