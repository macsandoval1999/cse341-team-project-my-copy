import { describe, expect, test } from "vitest";
import {
    createListResponse,
    parseListQuery,
    parseOptionalFilters,
    parseOptionalString,
} from "../src/utils/list-query.js";

describe("list query helpers", () => {
    test("validates pagination and returns the requested sort order", () => {
        const options = parseListQuery(
            { page: "2", limit: "5", sort: "name", order: "DESC" },
            ["name", "region"],
            "name"
        );

        expect(options).toMatchObject({
            page: 2,
            limit: 5,
            sort: "name",
            order: -1,
            orderName: "desc",
            errors: [],
        });
    });

    test("reports all invalid optional filters with their field names", () => {
        const result = parseOptionalFilters(
            { q: "   ", region: ["north"], status: "active" },
            { q: { maxLength: 10 }, region: {}, status: {} }
        );

        expect(result.errors).toEqual([
            { field: "q", message: "q must not be empty." },
            { field: "region", message: "region must be a single string value." },
        ]);
        expect(result.values.status).toEqual({ value: "active" });
    });

    test("limits optional string lengths and builds standard response metadata", () => {
        expect(parseOptionalString("too long", "q", { maxLength: 3 }).error)
            .toBe("q must be between 1 and 3 characters.");
        expect(createListResponse({
            data: ["item"],
            page: 1,
            limit: 10,
            totalItems: 1,
            sort: "name",
            order: -1,
        })).toMatchObject({
            data: ["item"],
            sort: { field: "name", order: "desc" },
            pagination: { page: 1, limit: 10, totalItems: 1, totalPages: 1 },
        });
    });
});
