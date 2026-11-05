package com.mukii.bank.account.service;

import static com.mukii.bank.account.domain.TransactionSpecs.direction;
import static com.mukii.bank.account.domain.TransactionSpecs.forAccount;
import static com.mukii.bank.account.domain.TransactionSpecs.postedFrom;
import static com.mukii.bank.account.domain.TransactionSpecs.postedTo;
import static com.mukii.bank.account.domain.TransactionSpecs.search;

import java.util.List;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mukii.bank.account.domain.Account;
import com.mukii.bank.account.domain.AccountRepository;
import com.mukii.bank.account.domain.CardTransaction;
import com.mukii.bank.account.domain.CardTransactionRepository;

@Service
@Transactional(readOnly = true)
public class AccountService {

    /** Newest first; id breaks ties so paging is stable when two transactions share a timestamp. */
    static final Sort NEWEST_FIRST = Sort.by(Sort.Order.desc("postedAt"), Sort.Order.desc("id"));

    private final AccountRepository accounts;
    private final CardTransactionRepository transactions;

    public AccountService(AccountRepository accounts, CardTransactionRepository transactions) {
        this.accounts = accounts;
        this.transactions = transactions;
    }

    public List<AccountSummary> listAccounts(long customerId) {
        return accounts.findByCustomerIdOrderByIdAsc(customerId).stream().map(AccountSummary::from).toList();
    }

    public AccountSummary getAccount(long customerId, long accountId) {
        return AccountSummary.from(ownedAccount(customerId, accountId));
    }

    public PageResponse<TransactionView> listTransactions(long customerId, long accountId, TransactionFilter filter,
            int page, int size) {
        Account account = ownedAccount(customerId, accountId);
        if (filter.from() != null && filter.to() != null && filter.from().isAfter(filter.to())) {
            throw new InvalidRequestException("'from' must be on or before 'to'");
        }
        Specification<CardTransaction> spec = Specification.where(forAccount(account.getId()))
                .and(postedFrom(filter.from()))
                .and(postedTo(filter.to()))
                .and(direction(filter.direction()))
                .and(search(filter.search()));
        return PageResponse.from(transactions.findAll(spec, PageRequest.of(page, size, NEWEST_FIRST)).map(TransactionView::from));
    }

    private Account ownedAccount(long customerId, long accountId) {
        return accounts.findByIdAndCustomerId(accountId, customerId)
                .orElseThrow(() -> new AccountNotFoundException(accountId));
    }
}
