import { describe, expect, test } from "vitest";
import request from "supertest";
import app from "../app.js";
import { createUser } from "../src/models/users.js";
import Trip from "../src/models/schemas/trips.js";
import Booking from "../src/models/schemas/bookings.js";
import Schedule from "../src/models/schemas/schedules.js";

const markTripUnavailable = async () => {
    await Trip.collection.updateOne(
        { id: "alpine-panorama" },
        { $unset: { trainId: "" } }
    );
};

const loginAsCustomer = async () => {
    const email = "trip-availability@example.com";
    const password = "Password123!";
    await createUser("Availability Customer", "availability-customer", email, password);

    const agent = request.agent(app);
    const response = await agent
        .post("/api/auth/login")
        .send({ identifier: email, password });
    expect(response.status).toBe(200);
    return agent;
};

describe("trip booking availability", () => {
    test("filters trip lists by availability before paginating", async () => {
        await markTripUnavailable();

        const unavailable = await request(app).get(
            "/api/trips?availability=unavailable"
        );
        const available = await request(app).get(
            "/api/trips?availability=available"
        );
        const all = await request(app).get("/api/trips?availability=all");

        expect(unavailable.status).toBe(200);
        expect(unavailable.body.data).toHaveLength(1);
        expect(unavailable.body.data[0].id).toBe("alpine-panorama");
        expect(unavailable.body.filters.availability).toBe("unavailable");
        expect(available.status).toBe(200);
        expect(available.body.data.length).toBeGreaterThan(0);
        expect(available.body.data.every((trip) => trip.availability.isAvailable)).toBe(true);
        expect(all.body.pagination.totalItems).toBe(
            unavailable.body.pagination.totalItems +
            available.body.pagination.totalItems
        );
    });

    test("rejects an unsupported availability filter", async () => {
        const response = await request(app).get("/api/trips?availability=missing");

        expect(response.status).toBe(400);
        expect(response.body.errors[0].field).toBe("availability");
    });

    test("scheduleStatus=none excludes trips that have only inactive schedules", async () => {
        await Schedule.updateMany(
            { tripId: "alpine-panorama" },
            { $set: { status: false } }
        );

        const withSchedules = await request(app).get(
            "/api/trips?availability=all&scheduleStatus=none"
        );
        expect(withSchedules.status).toBe(200);
        expect(withSchedules.body.data.map((trip) => trip.id))
            .not.toContain("alpine-panorama");

        await Schedule.deleteMany({ tripId: "alpine-panorama" });
        const withoutSchedules = await request(app).get(
            "/api/trips?availability=all&scheduleStatus=none"
        );
        expect(withoutSchedules.status).toBe(200);
        expect(withoutSchedules.body.data.map((trip) => trip.id))
            .toContain("alpine-panorama");
    });

    test("reports trips without active schedules as unavailable and supports an admin filter", async () => {
        await Schedule.deleteMany({ tripId: "alpine-panorama" });

        const unavailable = await request(app).get(
            "/api/trips?availability=unavailable&scheduleStatus=missing"
        );
        const tripResponse = await request(app).get("/api/trips/alpine-panorama");
        const detailsPage = await request(app).get("/trips/alpine-panorama");

        expect(unavailable.status).toBe(200);
        expect(unavailable.body.data.map((trip) => trip.id)).toContain("alpine-panorama");
        expect(unavailable.body.data.find((trip) => trip.id === "alpine-panorama"))
            .toMatchObject({
                scheduleCount: 0,
                availability: {
                    isAvailable: false,
                    message: "No active schedules have been added for this trip yet.",
                },
            });
        expect(tripResponse.body.availability.isAvailable).toBe(false);
        expect(detailsPage.text).toContain(
            "No active schedules have been added for this trip yet."
        );
        expect(detailsPage.text).not.toContain("Book Now");
    });

    test("exposes availability in trip and schedule API responses", async () => {
        await markTripUnavailable();

        const listResponse = await request(app).get("/api/trips?search=Alpine");
        const tripResponse = await request(app).get("/api/trips/alpine-panorama");
        const schedulesResponse = await request(app).get(
            "/api/trips/alpine-panorama/schedules"
        );

        expect(listResponse.status).toBe(200);
        expect(listResponse.body.data[0].availability).toEqual({
            isAvailable: false,
            message: "Temporarily unavailable for booking.",
        });
        expect(tripResponse.body.availability).toEqual({
            isAvailable: false,
            message: "Temporarily unavailable for booking.",
        });
        expect(schedulesResponse.body.availability).toEqual({
            isAvailable: false,
            message: "Temporarily unavailable for booking.",
        });
    });

    test("keeps unavailable trips visible and disables their booking actions", async () => {
        await markTripUnavailable();

        const listPage = await request(app).get("/trips");
        const detailPage = await request(app).get("/trips/alpine-panorama");

        expect(listPage.status).toBe(200);
        expect(listPage.text).not.toContain("trip-availability-notice");
        expect(listPage.text).not.toContain(
            "Temporarily unavailable for booking. Please check back later."
        );
        expect(listPage.text).not.toContain("trip-unavailable-btn");
        expect(listPage.text).toContain('class="view-details-btn">View Details &amp; Book →</a>');
        expect(detailPage.status).toBe(200);
        expect(detailPage.text).toContain('data-is-available="false"');
        expect(detailPage.text).toContain(
            "Temporarily unavailable for booking. Please check back later."
        );
    });

    test("redirects direct booking-page visits for unavailable trips", async () => {
        await markTripUnavailable();

        const response = await request(app).get("/trips/booking/1");

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe("/trips/alpine-panorama");
    });

    test("blocks unavailable bookings submitted through the trip form", async () => {
        await markTripUnavailable();
        const agent = await loginAsCustomer();

        const response = await agent.post("/trips/book").type("form").send({
            scheduleId: "1",
            tripId: "alpine-panorama",
            ticketClass: "standard",
            selectedDay: "monday",
            passengers: [{
                firstName: "Test",
                lastName: "Passenger",
                email: "passenger@example.com",
                phone: "555-0100",
            }],
        });

        expect(response.status).toBe(302);
        expect(response.headers.location).toBe("/trips/alpine-panorama");
        expect(await Booking.countDocuments()).toBe(0);
    });

    test("rejects API booking attempts for unavailable trips", async () => {
        await markTripUnavailable();
        const agent = await loginAsCustomer();

        const response = await agent.post("/api/bookings").send({
            scheduleId: 1,
            tripId: "alpine-panorama",
            ticketClass: "standard",
            selectedDay: "monday",
            passengers: [{
                firstName: "Test",
                lastName: "Passenger",
                email: "passenger@example.com",
                phone: "555-0100",
            }],
        });

        expect(response.status).toBe(409);
        expect(response.body.error).toBe("Temporarily unavailable for booking.");
        expect(await Booking.countDocuments()).toBe(0);
    });

    test("blocks direct booking against inactive schedules", async () => {
        await Schedule.updateOne({ id: 1 }, { $set: { status: false } });
        const agent = await loginAsCustomer();

        const response = await agent.post("/api/bookings").send({
            scheduleId: 1,
            tripId: "alpine-panorama",
            ticketClass: "standard",
            selectedDay: "monday",
            passengers: [{
                firstName: "Test",
                lastName: "Passenger",
                email: "passenger@example.com",
                phone: "555-0100",
            }],
        });

        expect(response.status).toBe(409);
        expect(response.body.error).toBe("This schedule is inactive");
        expect(await Booking.countDocuments()).toBe(0);
    });

    test("still accepts API bookings for trips with a linked train", async () => {
        const agent = await loginAsCustomer();

        const response = await agent.post("/api/bookings").send({
            scheduleId: 1,
            tripId: "alpine-panorama",
            ticketClass: "standard",
            selectedDay: "monday",
            passengers: [{
                firstName: "Test",
                lastName: "Passenger",
                email: "passenger@example.com",
                phone: "555-0100",
            }],
        });

        expect(response.status).toBe(201);
        expect(await Booking.countDocuments()).toBe(1);
    });
});
