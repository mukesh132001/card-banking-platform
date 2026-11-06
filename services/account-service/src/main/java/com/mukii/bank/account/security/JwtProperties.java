package com.mukii.bank.account.security;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** security.jwt.* in application.yml */
@ConfigurationProperties(prefix = "security.jwt")
public record JwtProperties(String secret, String issuer, Duration accessTokenTtl, Duration refreshTokenTtl) {
}
