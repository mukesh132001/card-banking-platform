package com.mukii.bank.account.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jayway.jsonpath.JsonPath;
import com.mukii.bank.account.api.TestLogin;

/**
 * Real HTTP flows through the security filter chain. Uses its own in-memory database (authtest) so the logins,
 * lockouts and revoked tokens created here can't affect the other test classes.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties =
        "spring.datasource.url=jdbc:h2:mem:authtest;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1")
class AuthIntegrationTest {

    private static final AtomicInteger SEQ = new AtomicInteger();

    @Autowired
    MockMvc mvc;

    @Autowired
    JwtEncoder jwtEncoder;

    @Autowired
    ObjectMapper json;

    // ---------- helpers ----------

    private ResultActions postJson(String path, Map<String, String> body) throws Exception {
        return mvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));
    }

    private ResultActions login(String email, String password) throws Exception {
        return postJson("/api/auth/login", Map.of("email", email, "password", password));
    }

    private static String field(ResultActions result, String path) throws Exception {
        return JsonPath.read(result.andReturn().getResponse().getContentAsString(), path).toString();
    }

    private String newCustomer() throws Exception {
        String email = "test" + SEQ.incrementAndGet() + "@example.com";
        postJson("/api/auth/signup", Map.of("email", email, "password", "a-long-test-password", "fullName", "Test User"))
                .andExpect(status().isCreated());
        return email;
    }

    private String token(Instant issuedAt, Instant expiresAt, String issuer) {
        JwtClaimsSet claims = JwtClaimsSet.builder().issuer(issuer).subject("1").issuedAt(issuedAt).expiresAt(expiresAt)
                .claim("roles", List.of("CUSTOMER")).claim("cid", 1L).build();
        return jwtEncoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
    }

    // ---------- tests ----------

    @Test
    void loginGivesTokensThatIdentifyTheUser() throws Exception {
        ResultActions result = login(DemoUsers.ALEX, DemoUsers.ALEX_PASSWORD)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.expiresIn").value(900))
                .andExpect(jsonPath("$.refreshToken").isNotEmpty());
        String bearer = "Bearer " + field(result, "$.accessToken");

        mvc.perform(get("/api/auth/me").header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(DemoUsers.ALEX))
                .andExpect(jsonPath("$.role").value("CUSTOMER"))
                .andExpect(jsonPath("$.customerId").isNumber());
        mvc.perform(get("/api/accounts").header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    void wrongPasswordAndUnknownEmailGiveTheSameAnswer() throws Exception {
        String wrongPassword = login(DemoUsers.PRIYA, "not-the-password").andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();
        String unknownEmail = login("nobody@example.com", "not-the-password").andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();
        assertThat(JsonPath.<String>read(wrongPassword, "$.detail")).isEqualTo(JsonPath.read(unknownEmail, "$.detail"));

        login(DemoUsers.PRIYA, DemoUsers.PRIYA_PASSWORD).andExpect(status().isOk()); // resets Priya's counter
    }

    @Test
    void badTokensAreRejected() throws Exception {
        mvc.perform(get("/api/accounts")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/accounts").header("Authorization", "Bearer not-a-jwt")).andExpect(status().isUnauthorized());

        Instant now = Instant.now();
        String expired = token(now.minusSeconds(7200), now.minusSeconds(3600), "card-banking-platform/account-service");
        mvc.perform(get("/api/accounts").header("Authorization", "Bearer " + expired)).andExpect(status().isUnauthorized());

        String wrongIssuer = token(now, now.plusSeconds(600), "someone-else");
        mvc.perform(get("/api/accounts").header("Authorization", "Bearer " + wrongIssuer)).andExpect(status().isUnauthorized());

        // Tampering: change the customer id inside a real token. The signature no longer matches.
        String real = field(login(DemoUsers.ALEX, DemoUsers.ALEX_PASSWORD), "$.accessToken");
        String[] parts = real.split("\\.");
        @SuppressWarnings("unchecked")
        Map<String, Object> claims = json.readValue(Base64.getUrlDecoder().decode(parts[1]), Map.class);
        claims.put("cid", 999_999);
        String forgedPayload = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(json.writeValueAsString(claims).getBytes(StandardCharsets.UTF_8));
        String forged = parts[0] + "." + forgedPayload + "." + parts[2];
        mvc.perform(get("/api/accounts").header("Authorization", "Bearer " + forged)).andExpect(status().isUnauthorized());
    }

    @Test
    void rolesAreEnforced() throws Exception {
        String alex = TestLogin.bearer(mvc, DemoUsers.ALEX, DemoUsers.ALEX_PASSWORD);
        String admin = TestLogin.bearer(mvc, DemoUsers.ADMIN, DemoUsers.ADMIN_PASSWORD);

        mvc.perform(get("/api/admin/customers").header("Authorization", alex)).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/customers").header("Authorization", admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.email == '" + DemoUsers.ALEX + "')].accounts").value(2));
        mvc.perform(get("/api/accounts").header("Authorization", admin)).andExpect(status().isForbidden());
    }

    @Test
    void signupCreatesACustomerWhoCanLogIn() throws Exception {
        String email = newCustomer();
        String bearer = TestLogin.bearer(mvc, email, "a-long-test-password");
        mvc.perform(get("/api/accounts").header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        postJson("/api/auth/signup", Map.of("email", email.toUpperCase(), "password", "a-long-test-password", "fullName", "Dup"))
                .andExpect(status().isConflict());
        postJson("/api/auth/signup", Map.of("email", "short@example.com", "password", "short", "fullName", "Short"))
                .andExpect(status().isBadRequest());
        postJson("/api/auth/signup", Map.of("email", "not-an-email", "password", "a-long-test-password", "fullName", "X"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void fiveWrongPasswordsLockTheLoginUntilAnAdminUnlocksIt() throws Exception {
        String email = newCustomer();
        for (int i = 0; i < 4; i++) {
            login(email, "wrong-password").andExpect(status().isUnauthorized());
        }
        login(email, "wrong-password").andExpect(status().isLocked()).andExpect(jsonPath("$.title").value("Account locked"));
        login(email, "a-long-test-password").andExpect(status().isLocked());

        String admin = TestLogin.bearer(mvc, DemoUsers.ADMIN, DemoUsers.ADMIN_PASSWORD);
        String users = mvc.perform(get("/api/admin/users").header("Authorization", admin))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        List<Number> ids = JsonPath.read(users, "$[?(@.email == '" + email + "')].id");
        List<Boolean> locked = JsonPath.read(users, "$[?(@.email == '" + email + "')].locked");
        assertThat(locked).containsExactly(true);

        mvc.perform(post("/api/admin/users/" + ids.get(0) + "/unlock").header("Authorization", admin))
                .andExpect(status().isNoContent());
        login(email, "a-long-test-password").andExpect(status().isOk());
    }

    @Test
    void refreshTokensWorkOnceAndReuseRevokesEverything() throws Exception {
        String email = newCustomer();
        String first = field(login(email, "a-long-test-password"), "$.refreshToken");

        ResultActions refreshed = postJson("/api/auth/refresh", Map.of("refreshToken", first)).andExpect(status().isOk());
        String second = field(refreshed, "$.refreshToken");
        assertThat(second).isNotEqualTo(first);
        mvc.perform(get("/api/accounts").header("Authorization", "Bearer " + field(refreshed, "$.accessToken")))
                .andExpect(status().isOk());

        // Someone replays the first token: rejected, and the second one is revoked too.
        postJson("/api/auth/refresh", Map.of("refreshToken", first)).andExpect(status().isUnauthorized());
        postJson("/api/auth/refresh", Map.of("refreshToken", second)).andExpect(status().isUnauthorized());
    }

    @Test
    void logoutRevokesTheRefreshToken() throws Exception {
        String email = newCustomer();
        String refresh = field(login(email, "a-long-test-password"), "$.refreshToken");

        postJson("/api/auth/logout", Map.of("refreshToken", refresh)).andExpect(status().isNoContent());
        postJson("/api/auth/refresh", Map.of("refreshToken", refresh)).andExpect(status().isUnauthorized());
        postJson("/api/auth/logout", Map.of("refreshToken", "never-issued")).andExpect(status().isNoContent());
    }

    @Test
    void docsAndHealthStayPublic() throws Exception {
        mvc.perform(get("/api/health")).andExpect(status().isOk());
        mvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.components.securitySchemes.bearerAuth.scheme").value("bearer"));
    }
}
