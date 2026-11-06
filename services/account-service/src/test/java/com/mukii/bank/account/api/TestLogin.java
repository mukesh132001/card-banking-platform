package com.mukii.bank.account.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.jayway.jsonpath.JsonPath;

/** Logs in through the real /api/auth/login endpoint, for end-to-end tests. */
public final class TestLogin {

    private TestLogin() {
    }

    public static MvcResult login(MockMvc mvc, String email, String password) throws Exception {
        return mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
    }

    /** "Bearer <access token>" for an Authorization header. */
    public static String bearer(MockMvc mvc, String email, String password) throws Exception {
        String body = login(mvc, email, password).getResponse().getContentAsString();
        return "Bearer " + JsonPath.read(body, "$.accessToken");
    }
}
