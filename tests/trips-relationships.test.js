import { describe, expect, test } from "vitest";
import request from "supertest";
import app from "../app.js";

/* Tests for the relationship between trips and stations */
describe("GET /api/trips/:id station relationships", () => {
    // 1. Test that a trip's origin and destination reference real stations
    test("returns the stations connected to the trip", async () => {
        // Arrange
        const tripId = "alpine-panorama";

        // Act
        const tripResponse = await request(app).get(`/api/trips/${tripId}`);
        expect(tripResponse.status).toBe(200);

        const originResponse = await request(app).get(
            `/api/stations/${tripResponse.body.startStation}`
        );
        const destinationResponse = await request(app).get(
            `/api/stations/${tripResponse.body.endStation}`
        );

        // Assert
        expect(tripResponse.body).toMatchObject({
            id: "alpine-panorama",
            startStation: "nagoya",
            endStation: "toyama",
        });
        expect(originResponse.status).toBe(200);
        expect(originResponse.body).toMatchObject({
            id: "nagoya",
            name: "Nagoya Station",
        });
        expect(destinationResponse.status).toBe(200);
        expect(destinationResponse.body).toMatchObject({
            id: "toyama",
            name: "Toyama Station",
        });
    });

    // 2. Test that a trip's station references match records in the station list
    test("trip station ids are present in the station list", async () => {
        // Arrange
        const tripId = "alpine-panorama";

        // Act
        const tripResponse = await request(app).get(`/api/trips/${tripId}`);
        const stationsResponse = await request(app).get("/api/stations");

        // Assert
        expect(tripResponse.status).toBe(200);
        expect(stationsResponse.status).toBe(200);
        const stationIds = stationsResponse.body.map((station) => station.id);
        expect(stationIds).toContain(tripResponse.body.startStation);
        expect(stationIds).toContain(tripResponse.body.endStation);
    });

    // 3. Test that an unknown trip returns a not-found response
    test("returns 404 when the trip does not exist", async () => {
        // Arrange
        const tripId = "not-a-real-trip";

        // Act
        const response = await request(app).get(`/api/trips/${tripId}`);

        // Assert
        expect(response.status).toBe(404);
        expect(response.body.message).toContain("not found");
        expect(response.body).not.toHaveProperty("startStation");
        expect(response.body).not.toHaveProperty("endStation");
    });
});

/* Tests for the relationship between schedules and trips */
describe("GET /api/trips/:tripId/schedules schedule relationships", () => {
    // 1. Test that a known schedule references its expected trip
    test("returns the trip referenced by a known schedule", async () => {
        // Arrange
        const scheduleId = 1;

        // Act
        const scheduleResponse = await request(app).get(
            `/api/schedules/${scheduleId}`
        );
        const tripResponse = await request(app).get(
            `/api/trips/${scheduleResponse.body.tripId}`
        );

        // Assert
        expect(scheduleResponse.status).toBe(200);
        expect(scheduleResponse.body.tripId).toBe("alpine-panorama");
        expect(tripResponse.status).toBe(200);
        expect(tripResponse.body).toMatchObject({
            id: "alpine-panorama",
            name: "Alpine Panorama Express",
        });
    });

    // 2. Test that a trip's schedules contain only schedules connected to it
    test("returns only schedules connected to the selected trip", async () => {
        // Arrange
        const tripId = "alpine-panorama";

        // Act
        const response = await request(app).get(
            `/api/trips/${tripId}/schedules`
        );

        // Assert
        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toContain("application/json");
        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.map((schedule) => schedule.id)).toEqual([1, 2]);
        expect(
            response.body.every((schedule) => schedule.tripId === tripId)
        ).toBe(true);
    });

    // 3. Test that an unknown trip returns a not-found response
    test("returns 404 when the selected trip does not exist", async () => {
        // Arrange
        const tripId = "not-a-real-trip";

        // Act
        const response = await request(app).get(
            `/api/trips/${tripId}/schedules`
        );

        // Assert
        expect(response.status).toBe(404);
        expect(response.body.error).toContain("not found");
        expect(response.body).not.toBeInstanceOf(Array);
    });

    // 4. Test that the trip schedule endpoint rejects an invalid month
    test("returns 400 when the requested month is invalid", async () => {
        // Arrange
        const tripId = "alpine-panorama";

        // Act
        const response = await request(app).get(
            `/api/trips/${tripId}/schedules?month=13`
        );

        // Assert
        expect(response.status).toBe(400);
        expect(response.body.error).toContain("month");
    });
});
