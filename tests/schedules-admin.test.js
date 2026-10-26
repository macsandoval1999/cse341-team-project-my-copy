import { describe, expect, test } from "vitest";
import request from "supertest";
import app from "../app.js";
import Booking from "../src/models/schemas/bookings.js";
import Schedule from "../src/models/schemas/schedules.js";

const login = async (identifier) => {
    const agent = request.agent(app);
    const response = await agent
        .post("/api/auth/login")
        .send({ identifier, password: "known test password" });
    expect(response.status).toBe(200);
    return agent;
};

describe("admin schedule management", () => {
    test("renders schedule tools and missing-trip coverage for admins", async () => {
        const admin = await login("admin@example.com");
        const response = await admin.get("/schedules-admin");

        expect(response.status).toBe(200);
        expect(response.text).toContain("Manage Schedules");
        expect(response.text).toContain('id="missing-trips-list"');
        expect(response.text).toContain("Trips with no schedules");
        expect(response.text).toContain('id="schedule-create-form"');
        expect(response.text).toContain('id="schedule-create-days-error"');
        expect(response.text).toContain('name="tripId" id="schedule-create-trip" required');
        expect(response.text).toContain('name="departureTime" required');
        expect(response.text).toContain('name="arrivalTime" required');
        expect(response.text).toContain('id="schedule-filters"');
        expect(response.text).toContain('id="schedule-status-filter"');
        expect(response.text).toContain("/js/schedules-admin.js");
    });

    test("requires admin access for the schedule management page", async () => {
        const customer = await login("customer@example.com");
        const response = await customer.get("/schedules-admin");

        expect(response.status).toBe(403);
    });

    test("admin schedule listing marks booked schedules without exposing booking data", async () => {
        await Booking.create({
            id: "schedule-admin-booking",
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
        const admin = await login("admin@example.com");
        const response = await admin
            .get("/api/admin/schedules")
            .query({ tripId: "alpine-panorama" });

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 1, hasBookings: true }),
            expect.objectContaining({ id: 2, hasBookings: false }),
        ]));
        expect(response.body.data[0]).not.toHaveProperty("passengers");
    });

    test("requires admin access to the admin schedule listing", async () => {
        const customer = await login("customer@example.com");
        const response = await customer.get("/api/admin/schedules");

        expect(response.status).toBe(403);
    });

    test("schedule status filter distinguishes active and inactive departures", async () => {
        await Schedule.updateOne({ id: 1 }, { $set: { status: false } });

        const active = await request(app)
            .get("/api/schedules")
            .query({ tripId: "alpine-panorama", status: "true" });
        const inactive = await request(app)
            .get("/api/schedules")
            .query({ tripId: "alpine-panorama", status: "false" });

        expect(active.status).toBe(200);
        expect(active.body.data.map((schedule) => schedule.id)).toEqual([2]);
        expect(inactive.status).toBe(200);
        expect(inactive.body.data.map((schedule) => schedule.id)).toEqual([1]);
    });
});
