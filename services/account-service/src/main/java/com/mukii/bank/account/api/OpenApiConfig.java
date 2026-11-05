package com.mukii.bank.account.api;

import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.info.Info;

/** Swagger UI: http://localhost:8080/swagger-ui.html · OpenAPI JSON: /v3/api-docs */
@Configuration
@OpenAPIDefinition(info = @Info(
        title = "Account service",
        version = "0.1.0",
        description = "Accounts, balances and transactions for the card banking platform's customer portal."))
public class OpenApiConfig {
}
