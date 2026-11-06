package com.mukii.bank.account.auth;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.mukii.bank.account.auth.AuthDtos.LoginRequest;
import com.mukii.bank.account.auth.AuthDtos.MeResponse;
import com.mukii.bank.account.auth.AuthDtos.RefreshRequest;
import com.mukii.bank.account.auth.AuthDtos.SignupRequest;
import com.mukii.bank.account.auth.AuthDtos.TokenResponse;
import com.mukii.bank.account.security.CurrentUser;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Auth", description = "Sign up, log in, refresh and log out")
public class AuthController {

    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create a customer login and get tokens")
    public TokenResponse signup(@Valid @RequestBody SignupRequest request) {
        return auth.signup(request);
    }

    @PostMapping("/login")
    @Operation(summary = "Log in. 401 for a wrong email or password; 423 after 5 failures in a row")
    public TokenResponse login(@Valid @RequestBody LoginRequest request) {
        return auth.login(request);
    }

    @PostMapping("/refresh")
    @Operation(summary = "Swap a refresh token for new tokens. Each refresh token works once")
    public TokenResponse refresh(@Valid @RequestBody RefreshRequest request) {
        return auth.refresh(request.refreshToken());
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Revoke a refresh token")
    public void logout(@Valid @RequestBody RefreshRequest request) {
        auth.logout(request.refreshToken());
    }

    @GetMapping("/me")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Who the access token belongs to")
    public MeResponse me(@Parameter(hidden = true) @AuthenticationPrincipal Jwt jwt) {
        List<String> roles = jwt.getClaimAsStringList("roles");
        Object cid = jwt.getClaims().get(CurrentUser.CUSTOMER_ID_CLAIM);
        return new MeResponse(Long.valueOf(jwt.getSubject()), jwt.getClaimAsString("email"),
                roles == null || roles.isEmpty() ? null : roles.get(0), cid instanceof Number n ? n.longValue() : null);
    }
}
