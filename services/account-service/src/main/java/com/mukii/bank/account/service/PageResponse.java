package com.mukii.bank.account.service;

import java.util.List;

import org.springframework.data.domain.Page;

/** A stable JSON shape for paged results (Spring's own Page JSON is not a stable contract). */
public record PageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages) {

    public static <T> PageResponse<T> from(Page<T> page) {
        return new PageResponse<>(page.getContent(), page.getNumber(), page.getSize(), page.getTotalElements(),
                page.getTotalPages());
    }
}
