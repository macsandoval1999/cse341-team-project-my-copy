import { describe, expect, test } from "vitest";
import request from "supertest";
import app from "../app.js";

/* Tests for the GET /api/stations endpoint */
describe("GET /api/stations", () => {
    // 1. Test that the endpoint returns all stations as JSON
    test("returns all stations successfully", async () => {
        // Arrange
        // The shared test setup seeds the temporary database with stations.

        // Act
        const response = await request(app).get("/api/stations");

        // Assert
        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toContain("application/json");
        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBeGreaterThan(0);
    });

    // 2. Test that the response includes known seeded station data
    test("returns stations with the expected fields and seeded values", async () => {
        // Arrange
        // Nagoya Station is included in the shared station seed data.

        // Act
        const response = await request(app).get("/api/stations");

        // Assert
        expect(response.status).toBe(200);
        expect(response.body).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: "nagoya",
                    name: "Nagoya Station",
                    prefecture: "Aichi",
                    region: "central",
                    facilities: expect.arrayContaining([
                        "restaurant",
                        "shop",
                        "restroom",
                    ]),
                }),
            ])
        );
    });

    // 3. Test that station records are returned in a stable order without duplicates
    test("returns stations sorted by id with unique station ids", async () => {
        // Arrange
        // The endpoint returns all seeded stations.

        // Act
        const response = await request(app).get("/api/stations");
        const stationIds = response.body.map((station) => station.id);

        // Assert
        expect(response.status).toBe(200);
        expect(stationIds).toEqual([...stationIds].sort());
        expect(new Set(stationIds).size).toBe(stationIds.length);
    });
});

/* Tests for the GET /api/stations/:id endpoint */
describe("GET /api/stations/:id", () => {
    // 1. Test that the endpoint returns one seeded station by id
    test("returns the requested station with its expected fields", async () => {
        // Arrange
        const stationId = "toyama";

        // Act
        const response = await request(app).get(`/api/stations/${stationId}`);

        // Assert
        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toContain("application/json");
        expect(response.body).toMatchObject({
            id: "toyama",
            name: "Toyama Station",
            prefecture: "Toyama",
            region: "central",
            description: "Gateway to the Northern Alps.",
        });
        expect(response.body.facilities).toEqual(
            expect.arrayContaining(["restaurant", "shop", "restroom"])
        );
    });

    // 2. Test that the station detail matches its record in the station list
    test("returns the same station data as the station list", async () => {
        // Arrange
        const stationId = "nagoya";

        // Act
        const listResponse = await request(app).get("/api/stations");
        const detailResponse = await request(app).get(
            `/api/stations/${stationId}`
        );
        const listedStation = listResponse.body.find(
            (station) => station.id === stationId
        );

        // Assert
        expect(listResponse.status).toBe(200);
        expect(detailResponse.status).toBe(200);
        expect(listedStation).toBeDefined();
        expect(detailResponse.body).toMatchObject(listedStation);
    });

    // 3. Test that an unknown station id returns a not-found response
    test("returns 404 when the station does not exist", async () => {
        // Arrange
        const stationId = "not-a-real-station";

        // Act
        const response = await request(app).get(`/api/stations/${stationId}`);

        // Assert
        expect(response.status).toBe(404);
        expect(response.body.error).toContain("not found");
        expect(response.body).not.toHaveProperty("id");
    });
});