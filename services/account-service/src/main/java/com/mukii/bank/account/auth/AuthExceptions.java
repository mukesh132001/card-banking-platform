package com.mukii.bank.account.auth;

import java.time.OffsetDateTime;

/** Login and token failures. Each maps to one HTTP status in ApiExceptionHandler. */
public final class AuthExceptions {

    private AuthExceptions() {
    }

    /** 401. Same message for "no such email" and "wrong password", so emails can't be discovered. */
    public static class InvalidCredentialsException extends RuntimeException {
        public InvalidCredentialsException() {
            super("Invalid email or password");
        }
    }

    /** 423 Locked. */
    public static class AccountLockedException extends RuntimeException {
        public AccountLockedException(OffsetDateTime until) {
            super("Too many failed login attempts. Try again after " + until + ".");
        }
    }

    /** 409. */
    public static class EmailAlreadyRegisteredException extends RuntimeException {
        public EmailAlreadyRegisteredException() {
            super("An account with this email already exists");
        }
    }

    /** 401. Unknown, expired, revoked or reused refresh token. */
    public static class InvalidRefreshTokenException extends RuntimeException {
        public InvalidRefreshTokenException() {
            super("Refresh token is invalid or expired. Please log in again.");
        }
    }

    /** 404. */
    public static class UserNotFoundException extends RuntimeException {
        public UserNotFoundException(Long id) {
            super("User " + id + " not found");
        }
    }
}
