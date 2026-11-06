package com.mukii.bank.account.security;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;

/** Reads who is calling from the verified access token. */
public final class CurrentUser {

    public static final String CUSTOMER_ID_CLAIM = "cid";

    private CurrentUser() {
    }

    /** The customer this token belongs to. Admin tokens have none, so they can't read customer accounts. */
    public static long customerId(Jwt jwt) {
        Object cid = jwt == null ? null : jwt.getClaims().get(CUSTOMER_ID_CLAIM);
        if (cid instanceof Number n) {
            return n.longValue();
        }
        throw new AccessDeniedException("This token isn't linked to a customer");
    }
}
