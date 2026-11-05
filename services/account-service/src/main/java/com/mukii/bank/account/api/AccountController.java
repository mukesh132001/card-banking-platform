package com.mukii.bank.account.api;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mukii.bank.account.domain.Direction;
import com.mukii.bank.account.service.AccountService;
import com.mukii.bank.account.service.AccountSummary;
import com.mukii.bank.account.service.PageResponse;
import com.mukii.bank.account.service.TransactionFilter;
import com.mukii.bank.account.service.TransactionView;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/**
 * Accounts and transactions for the signed-in customer.
 *
 * <p>Until JWT login lands (M1, issue 3), the caller identifies the customer with the {@value #CUSTOMER_HEADER}
 * header. After that, the customer comes from the token and the header goes away.
 */
@RestController
@RequestMapping("/api/accounts")
@Tag(name = "Accounts", description = "The customer's accounts, balances and transactions")
public class AccountController {

    public static final String CUSTOMER_HEADER = "X-Customer-Id";

    private final AccountService service;

    public AccountController(AccountService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "List the customer's accounts with balances")
    public List<AccountSummary> list(
            @Parameter(description = "Customer id (temporary, replaced by the JWT in M1 issue 3)")
            @RequestHeader(CUSTOMER_HEADER) @Positive long customerId) {
        return service.listAccounts(customerId);
    }

    @GetMapping("/{accountId}")
    @Operation(summary = "Get one account. 404 if it doesn't exist or isn't the customer's")
    public AccountSummary get(@RequestHeader(CUSTOMER_HEADER) @Positive long customerId,
            @PathVariable @Positive long accountId) {
        return service.getAccount(customerId, accountId);
    }

    @GetMapping("/{accountId}/transactions")
    @Operation(summary = "Page through an account's transactions, newest first, with optional filters")
    public PageResponse<TransactionView> transactions(
            @RequestHeader(CUSTOMER_HEADER) @Positive long customerId,
            @PathVariable @Positive long accountId,
            @Parameter(description = "Page number, from 0") @RequestParam(defaultValue = "0") @Min(0) int page,
            @Parameter(description = "Page size, 1 to 100") @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @Parameter(description = "On or after this date (YYYY-MM-DD)")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @Parameter(description = "On or before this date (YYYY-MM-DD)")
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @Parameter(description = "CREDIT (money in) or DEBIT (money out)")
            @RequestParam(required = false) Direction direction,
            @Parameter(description = "Search description and merchant")
            @RequestParam(name = "q", required = false) @Size(max = 100) String search) {
        return service.listTransactions(customerId, accountId, new TransactionFilter(from, to, direction, search), page, size);
    }
}
