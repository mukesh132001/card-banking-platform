package com.mukii.bank.account.security;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** security.login.* in application.yml: how many wrong passwords lock an account, and for how long. */
@ConfigurationProperties(prefix = "security.login")
public record LoginProperties(int maxFailedAttempts, Duration lockDuration) {
}
