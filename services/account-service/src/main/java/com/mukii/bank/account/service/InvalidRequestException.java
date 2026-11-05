package com.mukii.bank.account.service;

/** A request that is well-formed but doesn't make sense, e.g. a date range that ends before it starts. */
public class InvalidRequestException extends RuntimeException {

    public InvalidRequestException(String message) {
        super(message);
    }
}
