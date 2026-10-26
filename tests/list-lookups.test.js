import { describe, expect, test } from "vitest";
import request from "supertest";
import app from "../app.js";

describe("paginated lookup collection endpoints", () => {
    test("reports all invalid station filters with their corresponding fields", async () => {
        const response = await request(app)
            .get("/api/stations")
            .query({ q: "", region: "" });

        expect(response.status).toBe(400);
        expect(response.body.errors.map((error) => error.field))
            .toEqual(["q", "region"]);
    });

    test("filters and sorts stations with standard pagination metadata", async () => {
        const response = await request(app)
            .get("/api/stations")
            .query({ q: "Nagoya", sort: "name", order: "desc" });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].id).toBe("nagoya");
        expect(response.body).toMatchObject({
            query: { q: "Nagoya" },
            sort: { field: "name", order: "desc" },
            pagination: {
                page: 1,
                limit: 10,
                totalItems: 1,
                totalPages: 1,
                hasNextPage: false,
                hasPreviousPage: false,
            },
        });
    });

    test("filters and paginates schedules", async () => {
        const response = await request(app)
            .get("/api/schedules")
            .query({ day: "monday", limit: 1, sort: "departureTime", order: "desc" });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].daysOfWeek).toContain("monday");
        expect(response.body).toMatchObject({
            query: { day: "monday" },
            sort: { field: "departureTime", order: "desc" },
            pagination: { page: 1, limit: 1, hasNextPage: true },
        });
    });

    test("filters and paginates ticket classes", async () => {
        const response = await request(app)
            .get("/api/ticket-classes")
            .query({ day: "Monday", limit: 1, sort: "priceMultiplier", order: "desc" });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(
            response.body.data[0].availableDays.map((day) => day.toLowerCase())
        ).toContain("monday");
        expect(response.body.pagination).toMatchObject({
            page: 1,
            limit: 1,
            totalItems: expect.any(Number),
        });
        expect(response.body.pagination.totalItems).toBeGreaterThan(0);
    });

    test("searches roles and returns standard pagination metadata for admins", async () => {
        const agent = request.agent(app);
        const login = await agent
            .post("/api/auth/login")
            .send({ email: "admin@example.com", password: "known test password" });
        expect(login.status).toBe(200);

        const response = await agent.get("/api/roles").query({ q: "admin", limit: 1 });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].name).toBe("admin");
        expect(response.body.pagination).toMatchObject({
            page: 1,
            limit: 1,
            totalItems: 1,
            totalPages: 1,
        });
    });
});
