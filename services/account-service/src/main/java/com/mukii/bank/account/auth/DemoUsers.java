package com.mukii.bank.account.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.mukii.bank.account.domain.CustomerRepository;

/**
 * Demo logins for local runs and tests (app.demo-users=true). Created at startup, hashed with the real
 * PasswordEncoder, only if they don't exist yet. Never enable this anywhere real.
 */
@Component
@ConditionalOnProperty(name = "app.demo-users", havingValue = "true")
public class DemoUsers implements ApplicationRunner {

    public static final String ALEX = "alex.morgan@example.com";
    public static final String ALEX_PASSWORD = "alex-demo-password";
    public static final String PRIYA = "priya.shah@example.com";
    public static final String PRIYA_PASSWORD = "priya-demo-password";
    public static final String ADMIN = "admin@example.com";
    public static final String ADMIN_PASSWORD = "admin-demo-password";

    private static final Logger log = LoggerFactory.getLogger(DemoUsers.class);

    private final AppUserRepository users;
    private final CustomerRepository customers;
    private final PasswordEncoder passwordEncoder;

    public DemoUsers(AppUserRepository users, CustomerRepository customers, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.customers = customers;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        customer(ALEX, ALEX_PASSWORD);
        customer(PRIYA, PRIYA_PASSWORD);
        if (!users.existsByEmail(ADMIN)) {
            users.save(AppUser.admin(ADMIN, passwordEncoder.encode(ADMIN_PASSWORD)));
            log.warn("Created demo admin login {} (app.demo-users=true: local use only)", ADMIN);
        }
    }

    private void customer(String email, String password) {
        if (users.existsByEmail(email)) {
            return;
        }
        customers.findByEmail(email).ifPresentOrElse(
                c -> users.save(AppUser.customer(email, passwordEncoder.encode(password), c.getId())),
                () -> log.info("Demo customer {} not loaded, so no demo login for it", email));
    }
}
