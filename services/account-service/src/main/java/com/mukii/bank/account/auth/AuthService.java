package com.mukii.bank.account.auth;

import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Locale;
import java.util.Optional;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mukii.bank.account.auth.AuthDtos.LoginRequest;
import com.mukii.bank.account.auth.AuthDtos.SignupRequest;
import com.mukii.bank.account.auth.AuthDtos.TokenResponse;
import com.mukii.bank.account.auth.AuthExceptions.AccountLockedException;
import com.mukii.bank.account.auth.AuthExceptions.EmailAlreadyRegisteredException;
import com.mukii.bank.account.auth.AuthExceptions.InvalidCredentialsException;
import com.mukii.bank.account.auth.AuthExceptions.InvalidRefreshTokenException;
import com.mukii.bank.account.domain.Customer;
import com.mukii.bank.account.domain.CustomerRepository;
import com.mukii.bank.account.security.JwtProperties;
import com.mukii.bank.account.security.LoginProperties;
import com.mukii.bank.account.security.TokenService;

@Service
public class AuthService {

    private final AppUserRepository users;
    private final CustomerRepository customers;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder passwordEncoder;
    private final TokenService tokens;
    private final JwtProperties jwt;
    private final LoginProperties login;
    private final Clock clock;

    /** Checked when the email doesn't exist, so "unknown email" takes as long as "wrong password". */
    private final String dummyHash;

    public AuthService(AppUserRepository users, CustomerRepository customers, RefreshTokenRepository refreshTokens,
            PasswordEncoder passwordEncoder, TokenService tokens, JwtProperties jwt, LoginProperties login, Clock clock) {
        this.users = users;
        this.customers = customers;
        this.refreshTokens = refreshTokens;
        this.passwordEncoder = passwordEncoder;
        this.tokens = tokens;
        this.jwt = jwt;
        this.login = login;
        this.clock = clock;
        this.dummyHash = passwordEncoder.encode("timing-equaliser-not-a-real-password");
    }

    @Transactional
    public TokenResponse signup(SignupRequest request) {
        String email = normalise(request.email());
        if (users.existsByEmail(email) || customers.findByEmail(email).isPresent()) {
            throw new EmailAlreadyRegisteredException();
        }
        Customer customer = customers.save(new Customer(email, request.fullName().trim()));
        AppUser user = users.save(AppUser.customer(email, passwordEncoder.encode(request.password()), customer.getId()));
        return issueTokens(user, clock.instant());
    }

    /**
     * noRollbackFor matters: a wrong password throws, and without it the transaction would roll back and the
     * failed-attempt counter would never be saved, so the lockout would never trigger.
     */
    @Transactional(noRollbackFor = {InvalidCredentialsException.class, AccountLockedException.class})
    public TokenResponse login(LoginRequest request) {
        Instant now = clock.instant();
        Optional<AppUser> found = users.findByEmail(normalise(request.email()));
        if (found.isEmpty()) {
            passwordEncoder.matches(request.password(), dummyHash);
            throw new InvalidCredentialsException();
        }
        AppUser user = found.get();
        if (user.isLocked(now)) {
            throw new AccountLockedException(user.getLockedUntil());
        }
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            if (user.recordFailedLogin(now, login.maxFailedAttempts(), login.lockDuration())) {
                throw new AccountLockedException(user.getLockedUntil());
            }
            throw new InvalidCredentialsException();
        }
        user.recordSuccessfulLogin();
        return issueTokens(user, now);
    }

    /**
     * Rotation: each refresh token works once. If a token that was already used comes back, someone copied it,
     * so every live token for that user is revoked and both the attacker and the user must log in again.
     */
    @Transactional(noRollbackFor = {InvalidRefreshTokenException.class, AccountLockedException.class})
    public TokenResponse refresh(String rawToken) {
        Instant now = clock.instant();
        RefreshToken token = refreshTokens.findByTokenHash(TokenService.sha256(rawToken))
                .orElseThrow(InvalidRefreshTokenException::new);
        if (token.isRevoked()) {
            refreshTokens.revokeAllForUser(token.getUser().getId(), OffsetDateTime.ofInstant(now, ZoneOffset.UTC));
            throw new InvalidRefreshTokenException();
        }
        if (token.isExpired(now)) {
            throw new InvalidRefreshTokenException();
        }
        AppUser user = token.getUser();
        if (user.isLocked(now)) {
            throw new AccountLockedException(user.getLockedUntil());
        }
        token.revoke(now);
        return issueTokens(user, now);
    }

    /** Always succeeds, so logout never reveals whether a token existed. */
    @Transactional
    public void logout(String rawToken) {
        refreshTokens.findByTokenHash(TokenService.sha256(rawToken)).ifPresent(t -> t.revoke(clock.instant()));
    }

    private TokenResponse issueTokens(AppUser user, Instant now) {
        String raw = TokenService.newRefreshToken();
        refreshTokens.save(new RefreshToken(user, TokenService.sha256(raw), now.plus(jwt.refreshTokenTtl())));
        return new TokenResponse(tokens.accessToken(user, now), "Bearer", tokens.accessTokenSeconds(), raw);
    }

    static String normalise(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
