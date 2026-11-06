package com.mukii.bank.account.api;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import com.mukii.bank.account.domain.AccountStatus;
import com.mukii.bank.account.domain.AccountType;
import com.mukii.bank.account.domain.Direction;
import com.mukii.bank.account.security.SecurityConfig;
import com.mukii.bank.account.service.AccountNotFoundException;
import com.mukii.bank.account.service.AccountService;
import com.mukii.bank.account.service.AccountSummary;
import com.mukii.bank.account.service.InvalidRequestException;
import com.mukii.bank.account.service.PageResponse;
import com.mukii.bank.account.service.TransactionFilter;
import com.mukii.bank.account.service.TransactionView;

/**
 * Web layer only, with the real security rules: the service is a Mockito mock, and requests carry a test JWT
 * (spring-security-test builds it, so no login is needed). Checks routing, auth, validation and error shapes.
 */
@WebMvcTest(AccountController.class)
@Import(SecurityConfig.class)
class AccountControllerTest {

    /** A signed-in customer: role CUSTOMER and claim cid = customer id. */
    private static RequestPostProcessor customer(long customerId) {
        return jwt().jwt(j -> j.claim("cid", customerId)).authorities(new SimpleGrantedAuthority("ROLE_CUSTOMER"));
    }

    private static RequestPostProcessor admin() {
        return jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }

    @Autowired
    private MockMvc mvc;

    @MockBean
    private AccountService service;

    private static AccountSummary checking() {
        return new AccountSummary(1L, "•••• 1234", AccountType.CHECKING, "GBP", new BigDecimal("5309.01"),
                AccountStatus.ACTIVE, OffsetDateTime.parse("2026-08-01T09:00:00Z"));
    }

    @Test
    void listsTheCustomersAccounts() throws Exception {
        when(service.listAccounts(1L)).thenReturn(List.of(checking()));

        mvc.perform(get("/api/accounts").with(customer(1L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].maskedNumber").value("•••• 1234"))
                .andExpect(jsonPath("$[0].balance").value(5309.01))
                .andExpect(jsonPath("$[0].type").value("CHECKING"));
    }

    @Test
    void unknownOrSomeoneElsesAccountIs404ProblemDetail() throws Exception {
        when(service.getAccount(1L, 99L)).thenThrow(new AccountNotFoundException(99L));

        mvc.perform(get("/api/accounts/99").with(customer(1L)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.title").value("Account not found"))
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.detail").value("Account 99 not found"));
    }

    @Test
    void noTokenIs401() throws Exception {
        mvc.perform(get("/api/accounts")).andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }

    @Test
    void adminTokenCantReadCustomerAccounts() throws Exception {
        mvc.perform(get("/api/accounts").with(admin())).andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }

    @Test
    void customerRoleWithoutCustomerIdIs403() throws Exception {
        mvc.perform(get("/api/accounts").with(jwt().authorities(new SimpleGrantedAuthority("ROLE_CUSTOMER"))))
                .andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }

    @Test
    void nonNumericAccountIdIs400() throws Exception {
        mvc.perform(get("/api/accounts/abc").with(customer(1L))).andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }

    @Test
    void pageSizeOver100Is400() throws Exception {
        mvc.perform(get("/api/accounts/1/transactions").with(customer(1L)).param("size", "500"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }

    @Test
    void unknownDirectionIs400() throws Exception {
        mvc.perform(get("/api/accounts/1/transactions").with(customer(1L)).param("direction", "SIDEWAYS"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }

    @Test
    void passesFiltersAndPagingToTheService() throws Exception {
        TransactionView t = new TransactionView(7L, OffsetDateTime.parse("2026-09-05T10:00:00Z"), Direction.DEBIT,
                new BigDecimal("12.50"), new BigDecimal("-12.50"), "Card payment to Tesco", "Tesco", "GROCERIES",
                new BigDecimal("100.00"));
        when(service.listTransactions(eq(1L), eq(1L), any(), anyInt(), anyInt()))
                .thenReturn(new PageResponse<>(List.of(t), 2, 5, 11, 3));

        mvc.perform(get("/api/accounts/1/transactions").with(customer(1L))
                        .param("page", "2").param("size", "5")
                        .param("from", "2026-09-01").param("to", "2026-09-30")
                        .param("direction", "DEBIT").param("q", "tesco"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(2))
                .andExpect(jsonPath("$.totalElements").value(11))
                .andExpect(jsonPath("$.content[0].signedAmount").value(-12.50))
                .andExpect(jsonPath("$.content[0].merchant").value("Tesco"));

        verify(service).listTransactions(1L, 1L,
                new TransactionFilter(LocalDate.parse("2026-09-01"), LocalDate.parse("2026-09-30"), Direction.DEBIT, "tesco"),
                2, 5);
    }

    @Test
    void invalidDateRangeFromServiceIs400() throws Exception {
        when(service.listTransactions(anyLong(), anyLong(), any(), anyInt(), anyInt()))
                .thenThrow(new InvalidRequestException("'from' must be on or before 'to'"));

        mvc.perform(get("/api/accounts/1/transactions").with(customer(1L)).param("from", "2026-10-01").param("to", "2026-09-01"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.title").value("Invalid request"));
    }

    @Test
    void unexpectedErrorsDontLeakDetails() throws Exception {
        when(service.listAccounts(1L)).thenThrow(new IllegalStateException("db password is hunter2"));

        mvc.perform(get("/api/accounts").with(customer(1L)))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.detail").value("Something went wrong on our side. Please try again."));
    }
}
