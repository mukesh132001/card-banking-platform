package com.mukii.bank.account.service;

/** Thrown when an account doesn't exist or belongs to someone else (the API doesn't say which). */
public class AccountNotFoundException extends RuntimeException {

    public AccountNotFoundException(Long accountId) {
        super("Account " + accountId + " not found");
    }
}
