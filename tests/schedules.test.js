import { describe, expect, test } from "vitest";
import request from "supertest";
import app from "../app.js";

/* Tests for the GET /api/schedules endpoint */
describe("GET /api/schedules", () => {
    // 1. Test that the endpoint returns all schedules as JSON
    test("returns all schedules successfully", async () => {
        // Arrange
        // The shared test setup seeds the temporary database with schedules.

        // Act
        const response = await request(app).get("/api/schedules");

        // Assert
        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toContain("application/json");
        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBeGreaterThan(0);
    });

    // 2. Test that the response includes known seeded schedule data
    test("returns schedules with the expected fields and seeded values", async () => {
        // Arrange
        // Schedule 1 is included in the shared schedule seed data.

        // Act
        const response = await request(app).get("/api/schedules");

        // Assert
        expect(response.status).toBe(200);
        expect(response.body).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 1,
                    tripId: "alpine-panorama",
                    departureTime: "08:30",
                    arrivalTime: "13:00",
                    daysOfWeek: [
                        "monday",
                        "tuesday",
                        "wednesday",
                        "thursday",
                        "friday",
                    ],
                    status: true,
                }),
            ])
        );
    });

    // 3. Test that schedules are returned in a stable order without duplicates
    test("returns schedules sorted by id with unique schedule ids", async () => {
        // Arrange
        // The endpoint returns all seeded schedules.

        // Act
        const response = await request(app).get("/api/schedules");
        const scheduleIds = response.body.map((schedule) => schedule.id);

        // Assert
        expect(response.status).toBe(200);
        expect(scheduleIds).toEqual([...scheduleIds].sort((a, b) => a - b));
        expect(new Set(scheduleIds).size).toBe(scheduleIds.length);
    });
});

/* Tests for the GET /api/schedules/:id endpoint */
describe("GET /api/schedules/:id", () => {
    // 1. Test that the endpoint returns one seeded schedule by id
    test("returns the requested schedule with its expected fields", async () => {
        // Arrange
        const scheduleId = 1;

        // Act
        const response = await request(app).get(`/api/schedules/${scheduleId}`);

        // Assert
        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toContain("application/json");
        expect(response.body).toMatchObject({
            id: scheduleId,
            tripId: "alpine-panorama",
            departureTime: "08:30",
            arrivalTime: "13:00",
            daysOfWeek: [
                "monday",
                "tuesday",
                "wednesday",
                "thursday",
                "friday",
            ],
            status: true,
        });
    });

    // 2. Test that schedule detail matches its record in the schedule list
    test("returns the same schedule data as the schedule list", async () => {
        // Arrange
        const scheduleId = 2;

        // Act
        const listResponse = await request(app).get("/api/schedules");
        const detailResponse = await request(app).get(
            `/api/schedules/${scheduleId}`
        );
        const listedSchedule = listResponse.body.find(
            (schedule) => schedule.id === scheduleId
        );

        // Assert
        expect(listResponse.status).toBe(200);
        expect(detailResponse.status).toBe(200);
        expect(listedSchedule).toBeDefined();
        expect(detailResponse.body).toMatchObject(listedSchedule);
    });

    // 3. Test that an unknown schedule id returns a not-found response
    test("returns 404 when the schedule does not exist", async () => {
        // Arrange
        const scheduleId = 9999;

        // Act
        const response = await request(app).get(`/api/schedules/${scheduleId}`);

        // Assert
        expect(response.status).toBe(404);
        expect(response.body.error).toContain("not found");
        expect(response.body).not.toHaveProperty("id");
    });

    // 4. Test that a non-integer schedule id is rejected
    test("returns 400 when the schedule id is not an integer", async () => {
        // Arrange
        const scheduleId = "not-a-number";

        // Act
        const response = await request(app).get(`/api/schedules/${scheduleId}`);

        // Assert
        expect(response.status).toBe(400);
        expect(response.body.error).toContain("integer");
    });
});