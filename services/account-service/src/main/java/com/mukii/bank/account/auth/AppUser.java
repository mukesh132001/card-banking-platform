package com.mukii.bank.account.auth;

import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** A login. CUSTOMER users point at a customer; ADMIN users don't. */
@Entity
@Table(name = "app_user")
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role;

    @Column(name = "customer_id")
    private Long customerId;

    @Column(name = "failed_attempts", nullable = false)
    private int failedAttempts;

    @Column(name = "locked_until")
    private OffsetDateTime lockedUntil;

    protected AppUser() {
        // for JPA
    }

    private AppUser(String email, String passwordHash, Role role, Long customerId) {
        this.email = email;
        this.passwordHash = passwordHash;
        this.role = role;
        this.customerId = customerId;
    }

    public static AppUser customer(String email, String passwordHash, Long customerId) {
        return new AppUser(email, passwordHash, Role.CUSTOMER, customerId);
    }

    public static AppUser admin(String email, String passwordHash) {
        return new AppUser(email, passwordHash, Role.ADMIN, null);
    }

    public boolean isLocked(Instant now) {
        return lockedUntil != null && lockedUntil.toInstant().isAfter(now);
    }

    /**
     * Counts a wrong password. On the max-th failure the account locks for lockDuration and the counter resets,
     * so after the lock expires the user gets a fresh set of attempts. Returns true if this failure locked it.
     */
    public boolean recordFailedLogin(Instant now, int maxAttempts, Duration lockDuration) {
        failedAttempts++;
        if (failedAttempts >= maxAttempts) {
            lockedUntil = OffsetDateTime.ofInstant(now.plus(lockDuration), ZoneOffset.UTC);
            failedAttempts = 0;
            return true;
        }
        return false;
    }

    public void recordSuccessfulLogin() {
        failedAttempts = 0;
        lockedUntil = null;
    }

    public void unlock() {
        recordSuccessfulLogin();
    }

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public Role getRole() {
        return role;
    }

    public Long getCustomerId() {
        return customerId;
    }

    public int getFailedAttempts() {
        return failedAttempts;
    }

    public OffsetDateTime getLockedUntil() {
        return lockedUntil;
    }
}
