package com.mukii.bank.account.auth;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.mukii.bank.account.auth.AuthDtos.CustomerSummary;
import com.mukii.bank.account.auth.AuthDtos.UserSummary;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;

/** ADMIN only (enforced in SecurityConfig). */
@RestController
@RequestMapping("/api/admin")
@Tag(name = "Admin", description = "Back-office tools, role ADMIN only")
@SecurityRequirement(name = "bearerAuth")
public class AdminController {

    private final AdminService admin;

    public AdminController(AdminService admin) {
        this.admin = admin;
    }

    @GetMapping("/customers")
    @Operation(summary = "All customers with their number of accounts")
    public List<CustomerSummary> customers() {
        return admin.customers();
    }

    @GetMapping("/users")
    @Operation(summary = "All logins, with failed attempts and lock status")
    public List<UserSummary> users() {
        return admin.users();
    }

    @PostMapping("/users/{userId}/unlock")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Unlock a login that hit the failed-attempt limit")
    public void unlock(@PathVariable Long userId) {
        admin.unlock(userId);
    }
}
