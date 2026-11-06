package com.mukii.bank.account.api;

import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.security.SecurityScheme;

/**
 * Swagger UI: http://localhost:8080/swagger-ui.html · OpenAPI JSON: /v3/api-docs.
 * Log in with POST /api/auth/login, then paste the accessToken into Swagger's "Authorize" button.
 */
@Configuration
@OpenAPIDefinition(info = @Info(
        title = "Account service",
        version = "0.2.0",
        description = "Accounts, balances, transactions and authentication for the card banking platform."))
@SecurityScheme(name = "bearerAuth", type = SecuritySchemeType.HTTP, scheme = "bearer", bearerFormat = "JWT")
public class OpenApiConfig {
}
