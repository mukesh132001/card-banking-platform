package com.mukii.bank.account.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.mukii.bank.account.auth.AuthDtos.LoginRequest;
import com.mukii.bank.account.auth.AuthDtos.SignupRequest;
import com.mukii.bank.account.auth.AuthDtos.TokenResponse;
import com.mukii.bank.account.auth.AuthExceptions.AccountLockedException;
import com.mukii.bank.account.auth.AuthExceptions.EmailAlreadyRegisteredException;
import com.mukii.bank.account.auth.AuthExceptions.InvalidCredentialsException;
import com.mukii.bank.account.auth.AuthExceptions.InvalidRefreshTokenException;
import com.mukii.bank.account.domain.CustomerRepository;
import com.mukii.bank.account.security.JwtProperties;
import com.mukii.bank.account.security.LoginProperties;
import com.mukii.bank.account.security.TokenService;

/** Login rules with Mockito repositories, a real (fast) BCrypt and a clock the test can move. */
class AuthServiceTest {

    /** A clock the test can move forward. */
    static final class TestClock extends Clock {
        Instant now = Instant.parse("2026-11-05T12:00:00Z");

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    private final AppUserRepository users = mock(AppUserRepository.class);
    private final CustomerRepository customers = mock(CustomerRepository.class);
    private final RefreshTokenRepository refreshTokens = mock(RefreshTokenRepository.class);
    private final TokenService tokens = mock(TokenService.class);
    private final PasswordEncoder encoder = new BCryptPasswordEncoder(4); // low cost: fast tests
    private final TestClock clock = new TestClock();
    private AuthService service;
    private AppUser alex;

    @BeforeEach
    void setUp() {
        JwtProperties jwt = new JwtProperties("x".repeat(32), "test", Duration.ofMinutes(15), Duration.ofDays(7));
        LoginProperties login = new LoginProperties(5, Duration.ofMinutes(15));
        service = new AuthService(users, customers, refreshTokens, encoder, tokens, jwt, login, clock);
        alex = AppUser.customer("alex@example.com", encoder.encode("correct-password"), 1L);
        when(users.findByEmail("alex@example.com")).thenReturn(Optional.of(alex));
        when(tokens.accessToken(any(), any())).thenReturn("access-token");
    }

    private LoginRequest login(String password) {
        return new LoginRequest("Alex@Example.com ", password); // emails are trimmed and lower-cased
    }

    @Test
    void correctPasswordIssuesTokensAndStoresOnlyAHashOfTheRefreshToken() {
        TokenResponse response = service.login(login("correct-password"));

        assertThat(response.accessToken()).isEqualTo("access-token");
        assertThat(response.tokenType()).isEqualTo("Bearer");
        ArgumentCaptor<RefreshToken> saved = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshTokens).save(saved.capture());
        assertThat(saved.getValue().getTokenHash())
                .isEqualTo(TokenService.sha256(response.refreshToken()))
                .isNotEqualTo(response.refreshToken());
    }

    @Test
    void fiveWrongPasswordsLockForFifteenMinutes() {
        for (int i = 1; i <= 4; i++) {
            assertThatThrownBy(() -> service.login(login("wrong"))).isInstanceOf(InvalidCredentialsException.class);
            assertThat(alex.getFailedAttempts()).isEqualTo(i);
        }
        assertThatThrownBy(() -> service.login(login("wrong"))).isInstanceOf(AccountLockedException.class);
        assertThat(alex.isLocked(clock.now)).isTrue();

        // Even the right password is refused while locked...
        assertThatThrownBy(() -> service.login(login("correct-password"))).isInstanceOf(AccountLockedException.class);

        // ...until the lock expires.
        clock.now = clock.now.plus(Duration.ofMinutes(16));
        service.login(login("correct-password"));
        assertThat(alex.isLocked(clock.now)).isFalse();
        assertThat(alex.getFailedAttempts()).isZero();
    }

    @Test
    void aSuccessfulLoginResetsTheCounter() {
        assertThatThrownBy(() -> service.login(login("wrong"))).isInstanceOf(InvalidCredentialsException.class);
        service.login(login("correct-password"));
        assertThat(alex.getFailedAttempts()).isZero();
    }

    @Test
    void unknownEmailLooksExactlyLikeAWrongPassword() {
        when(users.findByEmail("nobody@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.login(new LoginRequest("nobody@example.com", "whatever-password")))
                .isInstanceOf(InvalidCredentialsException.class)
                .hasMessage("Invalid email or password");
        verify(refreshTokens, never()).save(any());
    }

    @Test
    void refreshRotatesTheToken() {
        RefreshToken current = new RefreshToken(alex, TokenService.sha256("current"), clock.now.plus(Duration.ofDays(1)));
        when(refreshTokens.findByTokenHash(TokenService.sha256("current"))).thenReturn(Optional.of(current));

        TokenResponse next = service.refresh("current");

        assertThat(current.isRevoked()).isTrue();
        assertThat(next.refreshToken()).isNotEqualTo("current");
        verify(refreshTokens).save(any(RefreshToken.class));
    }

    @Test
    void reusingAnOldRefreshTokenRevokesEveryTokenTheUserHas() {
        RefreshToken used = new RefreshToken(alex, TokenService.sha256("used"), clock.now.plus(Duration.ofDays(1)));
        used.revoke(clock.now.minusSeconds(60));
        when(refreshTokens.findByTokenHash(TokenService.sha256("used"))).thenReturn(Optional.of(used));

        assertThatThrownBy(() -> service.refresh("used")).isInstanceOf(InvalidRefreshTokenException.class);
        verify(refreshTokens).revokeAllForUser(any(), any());
        verify(refreshTokens, never()).save(any());
    }

    @Test
    void expiredAndUnknownRefreshTokensAreRejected() {
        RefreshToken old = new RefreshToken(alex, TokenService.sha256("old"), clock.now.minusSeconds(1));
        when(refreshTokens.findByTokenHash(TokenService.sha256("old"))).thenReturn(Optional.of(old));
        when(refreshTokens.findByTokenHash(TokenService.sha256("made-up"))).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.refresh("old")).isInstanceOf(InvalidRefreshTokenException.class);
        assertThatThrownBy(() -> service.refresh("made-up")).isInstanceOf(InvalidRefreshTokenException.class);
    }

    @Test
    void signupRejectsAnEmailThatIsTaken() {
        when(users.existsByEmail("alex@example.com")).thenReturn(true);

        assertThatThrownBy(() -> service.signup(new SignupRequest("ALEX@example.com", "a-long-password", "Alex")))
                .isInstanceOf(EmailAlreadyRegisteredException.class);
        verify(users, never()).save(any());
    }

    @Test
    void passwordsAreStoredAsBcryptHashes() {
        when(users.existsByEmail(anyString())).thenReturn(false);
        when(customers.findByEmail(anyString())).thenReturn(Optional.empty());
        when(customers.save(any())).thenAnswer(i -> i.getArgument(0));
        when(users.save(any())).thenAnswer(i -> i.getArgument(0));

        service.signup(new SignupRequest("new@example.com", "a-long-password", "New Person"));

        ArgumentCaptor<AppUser> saved = ArgumentCaptor.forClass(AppUser.class);
        verify(users).save(saved.capture());
        assertThat(saved.getValue().getPasswordHash()).startsWith("$2a$").doesNotContain("a-long-password");
        assertThat(encoder.matches("a-long-password", saved.getValue().getPasswordHash())).isTrue();
    }
}
