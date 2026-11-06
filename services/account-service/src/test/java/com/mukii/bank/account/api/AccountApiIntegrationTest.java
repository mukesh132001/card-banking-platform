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

import com.mukii.bank.account.auth.DemoUsers;
import com.mukii.bank.account.domain.Account;
import com.mukii.bank.account.domain.AccountRepository;
import com.mukii.bank.account.domain.CustomerRepository;

/**
 * The whole service end to end (HTTP -> security -> controller -> service -> JPA -> Flyway-built H2), using the demo
 * data and real logins.
 */
@SpringBootTest
@AutoConfigureMockMvc
class AccountApiIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    CustomerRepository customers;

    @Autowired
    AccountRepository accounts;

    String alex;
    String priya;
    long alexCheckingId;

    @BeforeEach
    void loginAndIds() throws Exception {
        alex = TestLogin.bearer(mvc, DemoUsers.ALEX, DemoUsers.ALEX_PASSWORD);
        priya = TestLogin.bearer(mvc, DemoUsers.PRIYA, DemoUsers.PRIYA_PASSWORD);
        long alexId = customers.findByEmail(DemoUsers.ALEX).orElseThrow().getId();
        alexCheckingId = accounts.findByCustomerIdOrderByIdAsc(alexId).stream()
                .filter(a -> a.getAccountNumber().endsWith("1234")).map(Account::getId).findFirst().orElseThrow();
    }

    @Test
    void customerSeesOnlyTheirOwnAccounts() throws Exception {
        mvc.perform(get("/api/accounts").header("Authorization", alex))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].maskedNumber").value("•••• 1234"))
                .andExpect(jsonPath("$[0].accountNumber").doesNotExist());

        mvc.perform(get("/api/accounts/" + alexCheckingId).header("Authorization", priya))
                .andExpect(status().isNotFound());
    }

    @Test
    void transactionsArePagedNewestFirstAndFiltered() throws Exception {
        mvc.perform(get("/api/accounts/" + alexCheckingId + "/transactions").header("Authorization", alex).param("size", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(26))
                .andExpect(jsonPath("$.totalPages").value(6))
                .andExpect(jsonPath("$.content.length()").value(5))
                .andExpect(jsonPath("$.content[0].merchant").value("Netflix"));

        mvc.perform(get("/api/accounts/" + alexCheckingId + "/transactions").header("Authorization", alex)
                        .param("from", "2026-09-01").param("to", "2026-09-30"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(17));

        mvc.perform(get("/api/accounts/" + alexCheckingId + "/transactions").header("Authorization", alex).param("q", "tesco"))
                .andExpect(jsonPath("$.totalElements").value(4));

        mvc.perform(get("/api/accounts/" + alexCheckingId + "/transactions").header("Authorization", alex)
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
