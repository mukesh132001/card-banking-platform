package com.mukii.bank.account.api;

import java.time.LocalDate;
import java.util.List;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.mukii.bank.account.domain.Direction;
import com.mukii.bank.account.security.CurrentUser;
import com.mukii.bank.account.service.AccountService;
import com.mukii.bank.account.service.AccountSummary;
import com.mukii.bank.account.service.PageResponse;
import com.mukii.bank.account.service.TransactionFilter;
import com.mukii.bank.account.service.TransactionView;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/**
 * Accounts and transactions for the signed-in customer. The customer comes from the verified access token
 * (claim "cid"), never from the request, so nobody can ask for someone else's accounts by changing an id.
 */
@RestController
@RequestMapping("/api/accounts")
@Tag(name = "Accounts", description = "The customer's accounts, balances and transactions")
@SecurityRequirement(name = "bearerAuth")
public class AccountController {

    private final AccountService service;

    public AccountController(AccountService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "List the customer's accounts with balances")
    public List<AccountSummary> list(@Parameter(hidden = true) @AuthenticationPrincipal Jwt jwt) {
        return service.listAccounts(CurrentUser.customerId(jwt));
    }

    @GetMapping("/{accountId}")
    @Operation(summary = "Get one account. 404 if it doesn't exist or isn't the customer's")
    public AccountSummary get(@Parameter(hidden = true) @AuthenticationPrincipal Jwt jwt,
            @PathVariable @Positive long accountId) {
        return service.getAccount(CurrentUser.customerId(jwt), accountId);
    }

    @GetMapping("/{accountId}/transactions")
    @Operation(summary = "Page through an account's transactions, newest first, with optional filters")
    public PageResponse<TransactionView> transactions(
            @Parameter(hidden = true) @AuthenticationPrincipal Jwt jwt,
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
        return service.listTransactions(CurrentUser.customerId(jwt), accountId,
                new TransactionFilter(from, to, direction, search), page, size);
    }
}
