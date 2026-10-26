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
        expect(response.body.data).toBeInstanceOf(Array);
        expect(response.body.data.length).toBeGreaterThan(0);
    });

    // 2. Test that the response includes known seeded station data
    test("returns stations with the expected fields and seeded values", async () => {
        // Arrange
        // Nagoya Station is included in the shared station seed data.

        // Act
        const response = await request(app).get("/api/stations");

        // Assert
        expect(response.status).toBe(200);
        expect(response.body.data).toEqual(
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
        const stationIds = response.body.data.map((station) => station.id);

        // Assert
        expect(response.status).toBe(200);
        expect(stationIds).toEqual([...stationIds].sort());
        expect(new Set(stationIds).size).toBe(stationIds.length);
    });

    test("supports filtering, sorting, and pagination", async () => {
        const response = await request(app)
            .get("/api/stations")
            .query({ region: "central", sort: "name", order: "desc", limit: "2" });

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(2);
        expect(response.body.data[0].name.localeCompare(response.body.data[1].name))
            .toBeGreaterThan(0);
        expect(response.body.pagination.totalItems).toBeGreaterThan(2);
        expect(response.body.query.region).toBe("central");
    });

    test("provides available station filter values", async () => {
        const response = await request(app).get("/api/stations/filters");

        expect(response.status).toBe(200);
        expect(response.body.regions).toContain("central");
        expect(response.body.prefectures).toContain("Aichi");
        expect(response.body.facilities).toContain("restaurant");
    });

    test("rejects invalid station filters and sort fields", async () => {
        const filterResponse = await request(app)
            .get("/api/stations")
            .query({ q: "" });
        const sortResponse = await request(app)
            .get("/api/stations")
            .query({ sort: "unknown" });

        expect(filterResponse.status).toBe(400);
        expect(filterResponse.body.errors[0].field).toBe("q");
        expect(sortResponse.status).toBe(400);
        expect(sortResponse.body.errors[0].field).toBe("sort");
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
        const listedStation = listResponse.body.data.find(
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

    test("accepts a station's exact display name as a lookup key", async () => {
        const response = await request(app).get(
            "/api/stations/aomori%20station"
        );

        expect(response.status).toBe(200);
        expect(response.body.id).toBe("aomori");
    });
});

describe("station management pages and admin API", () => {
    test("renders the public station browser", async () => {
        const response = await request(app).get("/stations");

        expect(response.status).toBe(200);
        expect(response.text).toContain("Explore Stations");
        expect(response.text).toContain("station-card-template");
        expect(response.text).not.toContain("station-create-form");
    });

    test("requires an admin to access the station management page", async () => {
        const guestResponse = await request(app).get("/stations-admin");
        expect(guestResponse.status).toBe(302);
        expect(guestResponse.headers.location).toBe("/login");

        const customer = request.agent(app);
        await customer
            .post("/api/auth/login")
            .send({ identifier: "customer@example.com", password: "known test password" });
        const customerResponse = await customer.get("/stations-admin");
        expect(customerResponse.status).toBe(403);

        const admin = request.agent(app);
        await admin
            .post("/api/auth/login")
            .send({ identifier: "admin@example.com", password: "known test password" });
        const adminResponse = await admin.get("/stations-admin");
        expect(adminResponse.status).toBe(200);
        expect(adminResponse.text).toContain("Manage Stations");
        expect(adminResponse.text).toContain("station-create-form");
    });

    test("protects station create, update, and delete endpoints", async () => {
        const guestResponse = await request(app)
            .post("/api/stations")
            .send({ id: "new-station", name: "New Station" });
        expect(guestResponse.status).toBe(401);
        const guestListResponse = await request(app).get("/api/admin/stations");
        expect(guestListResponse.status).toBe(401);

        const customer = request.agent(app);
        await customer
            .post("/api/auth/login")
            .send({ identifier: "customer@example.com", password: "known test password" });
        const customerResponse = await customer
            .post("/api/stations")
            .send({ id: "new-station", name: "New Station" });
        expect(customerResponse.status).toBe(403);
        const customerListResponse = await customer.get("/api/admin/stations");
        expect(customerListResponse.status).toBe(403);

        const admin = request.agent(app);
        await admin
            .post("/api/auth/login")
            .send({ identifier: "admin@example.com", password: "known test password" });
        const adminListResponse = await admin.get("/api/admin/stations");
        expect(adminListResponse.status).toBe(200);
        expect(adminListResponse.body.data.find((station) => station.id === "nagoya").inUse)
            .toBe(true);
        expect(adminListResponse.body.data.find((station) => station.id === "kushiro").inUse)
            .toBe(true);
    });

    test("validates and supports station create, update, and delete", async () => {
        const admin = request.agent(app);
        await admin
            .post("/api/auth/login")
            .send({ identifier: "admin@example.com", password: "known test password" });

        const invalid = await admin.post("/api/stations").send({
            id: "Not Valid",
            name: "Invalid Station",
        });
        expect(invalid.status).toBe(400);

        const created = await admin.post("/api/stations").send({
            id: "new-station",
            name: "New Station",
            prefecture: "Tokyo",
            region: "kanto",
            facilities: ["restaurant", "restroom"],
            description: "New station description",
        });
        expect(created.status).toBe(201);
        expect(created.body.id).toBe("new-station");

        const usage = await admin.get("/api/admin/stations?q=new-station");
        expect(usage.status).toBe(200);
        expect(usage.body.data[0].inUse).toBe(false);

        const updated = await admin
            .put("/api/stations/new-station")
            .send({ name: "Updated Station", facilities: ["shop"] });
        expect(updated.status).toBe(200);
        expect(updated.body.name).toBe("Updated Station");
        expect(updated.body.facilities).toEqual(["shop"]);

        const deleted = await admin.delete("/api/stations/new-station");
        expect(deleted.status).toBe(204);
    });

    test("prevents any modifications or deletion of a station referenced by a trip", async () => {
        const admin = request.agent(app);
        await admin
            .post("/api/auth/login")
            .send({ identifier: "admin@example.com", password: "known test password" });

        const update = await admin
            .put("/api/stations/nagoya")
            .send({ description: "Modified description" });
        expect(update.status).toBe(409);
        expect(update.body.error).toContain("cannot be modified");

        const deletion = await admin.delete("/api/stations/nagoya");
        expect(deletion.status).toBe(409);
    });
});