package com.mukii.bank.account.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import com.mukii.bank.account.domain.Account;
import com.mukii.bank.account.domain.AccountRepository;
import com.mukii.bank.account.domain.AccountType;
import com.mukii.bank.account.domain.CardTransaction;
import com.mukii.bank.account.domain.CardTransactionRepository;
import com.mukii.bank.account.domain.Customer;

/** Business rules with plain Mockito: no Spring context, no database. */
@ExtendWith(MockitoExtension.class)
class AccountServiceTest {

    @Mock
    private AccountRepository accounts;

    @Mock
    private CardTransactionRepository transactions;

    @InjectMocks
    private AccountService service;

    private final Account account = new Account(new Customer("a@example.com", "A"), "GB00DEMO00000012341234",
            AccountType.CHECKING, "GBP", new BigDecimal("10.00"));

    @Test
    void masksTheAccountNumber() {
        when(accounts.findByCustomerIdOrderByIdAsc(1L)).thenReturn(List.of(account));

        List<AccountSummary> result = service.listAccounts(1L);

        assertThat(result).singleElement().satisfies(a -> {
            assertThat(a.maskedNumber()).isEqualTo("•••• 1234");
            assertThat(a.balance()).isEqualByComparingTo("10.00");
        });
    }

    @Test
    void anotherCustomersAccountIsNotFound() {
        when(accounts.findByIdAndCustomerId(5L, 2L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getAccount(2L, 5L))
                .isInstanceOf(AccountNotFoundException.class)
                .hasMessage("Account 5 not found");
    }

    @Test
    void transactionsCheckOwnershipBeforeQuerying() {
        when(accounts.findByIdAndCustomerId(5L, 2L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.listTransactions(2L, 5L, TransactionFilter.none(), 0, 20))
                .isInstanceOf(AccountNotFoundException.class);
        verify(transactions, never()).findAll(any(Specification.class), any(Pageable.class));
    }

    @Test
    void dateRangeMustRunForwards() {
        when(accounts.findByIdAndCustomerId(1L, 1L)).thenReturn(Optional.of(account));
        TransactionFilter backwards = new TransactionFilter(LocalDate.parse("2026-10-01"), LocalDate.parse("2026-09-01"), null, null);

        assertThatThrownBy(() -> service.listTransactions(1L, 1L, backwards, 0, 20))
                .isInstanceOf(InvalidRequestException.class);
        verify(transactions, never()).findAll(any(Specification.class), any(Pageable.class));
    }

    @Test
    void signedAmountIsNegativeForDebits() {
        CardTransaction debit = new CardTransaction(account, null, com.mukii.bank.account.domain.Direction.DEBIT,
                new BigDecimal("12.50"), "x", null, null, BigDecimal.ZERO);
        assertThat(debit.signedAmount()).isEqualByComparingTo("-12.50");
    }
}
