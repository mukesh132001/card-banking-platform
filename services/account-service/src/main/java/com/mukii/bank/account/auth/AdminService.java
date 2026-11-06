package com.mukii.bank.account.auth;

import java.util.List;

import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.mukii.bank.account.auth.AuthDtos.CustomerSummary;
import com.mukii.bank.account.auth.AuthDtos.UserSummary;
import com.mukii.bank.account.auth.AuthExceptions.UserNotFoundException;
import com.mukii.bank.account.domain.AccountRepository;
import com.mukii.bank.account.domain.CustomerRepository;

import java.time.Clock;

@Service
public class AdminService {

    private final CustomerRepository customers;
    private final AccountRepository accounts;
    private final AppUserRepository users;
    private final Clock clock;

    public AdminService(CustomerRepository customers, AccountRepository accounts, AppUserRepository users, Clock clock) {
        this.customers = customers;
        this.accounts = accounts;
        this.users = users;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<CustomerSummary> customers() {
        return customers.findAll(Sort.by("id")).stream()
                .map(c -> new CustomerSummary(c.getId(), c.getEmail(), c.getFullName(), accounts.countByCustomerId(c.getId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<UserSummary> users() {
        return users.findAll(Sort.by("id")).stream()
                .map(u -> new UserSummary(u.getId(), u.getEmail(), u.getRole(), u.getCustomerId(), u.getFailedAttempts(),
                        u.isLocked(clock.instant())))
                .toList();
    }

    @Transactional
    public void unlock(Long userId) {
        users.findById(userId).orElseThrow(() -> new UserNotFoundException(userId)).unlock();
    }
}
