package com.mukii.bank.account.api;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import com.mukii.bank.account.auth.AuthExceptions.AccountLockedException;
import com.mukii.bank.account.auth.AuthExceptions.EmailAlreadyRegisteredException;
import com.mukii.bank.account.auth.AuthExceptions.InvalidCredentialsException;
import com.mukii.bank.account.auth.AuthExceptions.InvalidRefreshTokenException;
import com.mukii.bank.account.auth.AuthExceptions.UserNotFoundException;
import com.mukii.bank.account.service.AccountNotFoundException;
import com.mukii.bank.account.service.InvalidRequestException;

/**
 * Every error comes back as an RFC 7807 problem detail ({"type","title","status","detail","instance"}).
 * The base class already turns validation failures, missing headers and bad parameter types into 400s.
 */
@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(AccountNotFoundException.class)
    public ProblemDetail accountNotFound(AccountNotFoundException e) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, e.getMessage());
        problem.setTitle("Account not found");
        return problem;
    }

    @ExceptionHandler(InvalidRequestException.class)
    public ProblemDetail invalidRequest(InvalidRequestException e) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, e.getMessage());
        problem.setTitle("Invalid request");
        return problem;
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    public ProblemDetail invalidCredentials(InvalidCredentialsException e) {
        return problem(HttpStatus.UNAUTHORIZED, "Login failed", e.getMessage());
    }

    @ExceptionHandler(InvalidRefreshTokenException.class)
    public ProblemDetail invalidRefreshToken(InvalidRefreshTokenException e) {
        return problem(HttpStatus.UNAUTHORIZED, "Invalid refresh token", e.getMessage());
    }

    @ExceptionHandler(AccountLockedException.class)
    public ProblemDetail locked(AccountLockedException e) {
        return problem(HttpStatus.LOCKED, "Account locked", e.getMessage());
    }

    @ExceptionHandler(EmailAlreadyRegisteredException.class)
    public ProblemDetail emailTaken(EmailAlreadyRegisteredException e) {
        return problem(HttpStatus.CONFLICT, "Email already registered", e.getMessage());
    }

    @ExceptionHandler(UserNotFoundException.class)
    public ProblemDetail userNotFound(UserNotFoundException e) {
        return problem(HttpStatus.NOT_FOUND, "User not found", e.getMessage());
    }

    /** e.g. an admin token calling a customer endpoint that needs a customer id. */
    @ExceptionHandler(AccessDeniedException.class)
    public ProblemDetail accessDenied(AccessDeniedException e) {
        return problem(HttpStatus.FORBIDDEN, "Forbidden", e.getMessage());
    }

    /** Two requests racing to create the same unique row (e.g. the same email): the loser gets a 409, not a 500. */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ProblemDetail conflict(DataIntegrityViolationException e) {
        log.warn("Constraint violation: {}", e.getMostSpecificCause().getMessage());
        return problem(HttpStatus.CONFLICT, "Conflict", "That conflicts with existing data. Please retry.");
    }

    private static ProblemDetail problem(HttpStatus status, String title, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setTitle(title);
        return problem;
    }

    /** Anything unexpected: log it, but never send internals (stack traces, SQL) to the client. */
    @ExceptionHandler(Exception.class)
    public ProblemDetail unexpected(Exception e) {
        log.error("Unhandled error", e);
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR,
                "Something went wrong on our side. Please try again.");
        problem.setTitle("Internal error");
        return problem;
    }
}
