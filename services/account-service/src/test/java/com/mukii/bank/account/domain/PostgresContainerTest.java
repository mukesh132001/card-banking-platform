package com.mukii.bank.account.domain;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * The same repository checks against a real PostgreSQL 16 in Docker (Testcontainers), so the Flyway SQL is
 * proven on the database we deploy to, not just H2. Skipped automatically when Docker isn't running;
 * GitHub Actions runners have Docker, so it always runs in CI.
 */
@SpringBootTest
@Testcontainers(disabledWithoutDocker = true)
class PostgresContainerTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    CustomerRepository customers;

    @Autowired
    AccountRepository accounts;

    @Autowired
    CardTransactionRepository transactions;

    @Test
    void flywayAndQueriesWorkOnPostgres() {
        RepositoryChecks.demoDataIsLoaded(customers, accounts, transactions);
        RepositoryChecks.filtersWork(customers, accounts, transactions);
    }
}
