package com.mukii.bank.account.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import com.mukii.bank.account.domain.Account;
import com.mukii.bank.account.domain.AccountRepository;
import com.mukii.bank.account.domain.CustomerRepository;

/** The whole service end to end (HTTP -> controller -> service -> JPA -> Flyway-built H2), using the demo data. */
@SpringBootTest
@AutoConfigureMockMvc
class AccountApiIntegrationTest {

    private static final String H = AccountController.CUSTOMER_HEADER;

    @Autowired
    MockMvc mvc;

    @Autowired
    CustomerRepository customers;

    @Autowired
    AccountRepository accounts;

    long alexId;
    long priyaId;
    long alexCheckingId;

    @BeforeEach
    void ids() {
        alexId = customers.findByEmail("alex.morgan@example.com").orElseThrow().getId();
        priyaId = customers.findByEmail("priya.shah@example.com").orElseThrow().getId();
        alexCheckingId = accounts.findByCustomerIdOrderByIdAsc(alexId).stream()
                .filter(a -> a.getAccountNumber().endsWith("1234")).map(Account::getId).findFirst().orElseThrow();
    }

    @Test
    void customerSeesOnlyTheirOwnAccounts() throws Exception {
        mvc.perform(get("/api/accounts").header(H, alexId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].maskedNumber").value("•••• 1234"))
                .andExpect(jsonPath("$[0].accountNumber").doesNotExist());

        mvc.perform(get("/api/accounts/" + alexCheckingId).header(H, priyaId))
                .andExpect(status().isNotFound());
    }

    @Test
    void transactionsArePagedNewestFirstAndFiltered() throws Exception {
        mvc.perform(get("/api/accounts/" + alexCheckingId + "/transactions").header(H, alexId).param("size", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(26))
                .andExpect(jsonPath("$.totalPages").value(6))
                .andExpect(jsonPath("$.content.length()").value(5))
                .andExpect(jsonPath("$.content[0].merchant").value("Netflix"));

        mvc.perform(get("/api/accounts/" + alexCheckingId + "/transactions").header(H, alexId)
                        .param("from", "2026-09-01").param("to", "2026-09-30"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(17));

        mvc.perform(get("/api/accounts/" + alexCheckingId + "/transactions").header(H, alexId).param("q", "tesco"))
                .andExpect(jsonPath("$.totalElements").value(4));

        mvc.perform(get("/api/accounts/" + alexCheckingId + "/transactions").header(H, alexId)
                        .param("from", "2026-10-01").param("to", "2026-09-01"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void openApiDocsArePublished() throws Exception {
        mvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.info.title").value("Account service"))
                .andExpect(jsonPath("$.paths['/api/accounts/{accountId}/transactions']").exists());
    }
}
