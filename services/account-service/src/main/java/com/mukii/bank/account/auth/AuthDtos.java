package com.mukii.bank.account.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Request and response bodies for /api/auth and /api/admin. */
public final class AuthDtos {

    private AuthDtos() {
    }

    /** Passwords: 12 to 64 characters. Length beats complexity rules (NIST SP 800-63B); BCrypt reads at most 72 bytes. */
    public record SignupRequest(
            @NotBlank @Email @Size(max = 255) String email,
            @NotBlank @Size(min = 12, max = 64) String password,
            @NotBlank @Size(max = 200) String fullName) {
    }

    public record LoginRequest(@NotBlank @Email String email, @NotBlank @Size(max = 64) String password) {
    }

    public record RefreshRequest(@NotBlank @Size(max = 200) String refreshToken) {
    }

    public record TokenResponse(String accessToken, String tokenType, long expiresIn, String refreshToken) {
    }

    public record MeResponse(Long userId, String email, String role, Long customerId) {
    }

    public record CustomerSummary(Long id, String email, String fullName, long accounts) {
    }

    public record UserSummary(Long id, String email, Role role, Long customerId, int failedAttempts, boolean locked) {
    }
}
