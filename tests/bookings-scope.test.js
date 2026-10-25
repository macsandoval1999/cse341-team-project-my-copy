import { describe, expect, test } from "vitest";
import request from "supertest";
import app from "../app.js";
import { createUser } from "../src/models/users.js";
import { Role } from "../src/models/schemas/roles.js";
import { User } from "../src/models/schemas/users.js";
import Booking from "../src/models/schemas/bookings.js";

const password = "Password123!";

const loginAs = async (role, suffix) => {
    const email = `${role}-${suffix}@example.com`;
    const userId = await createUser(
        `Test ${role}`,
        `test-${role}-${suffix}`,
        email,
        password
    );

    if (role === "admin") {
        const adminRole = await Role.findOne({ name: "admin" });
        await User.updateOne({ _id: userId }, { role: adminRole._id });
    }

    const agent = request.agent(app);
    const response = await agent
        .post("/api/auth/login")
        .send({ identifier: email, password });
    expect(response.status).toBe(200);

    return {
        agent,
        user: await User.findById(userId),
    };
};

const createBooking = async ({ id, userId, passengerEmail }) =>
    Booking.create({
        id,
        userId,
        scheduleId: 1,
        tripId: "alpine-panorama",
        ticketClass: "standard",
        selectedDay: "monday",
        passengers: [{
            firstName: "Test",
            lastName: "Passenger",
            email: passengerEmail,
            phone: "555-0100",
        }],
    });

describe("personal and admin bookings views", () => {
    test("an admin's View Your Bookings page lists only bookings associated with that admin", async () => {
        const { agent, user } = await loginAs("admin", "personal-bookings");
        const otherUserId = await createUser(
            "Other User",
            "other-user-personal-bookings",
            "other-personal-bookings@example.com",
            password
        );
        await createBooking({
            id: "admin-created",
            userId: user._id,
            passengerEmail: "traveler@example.com",
        });
        await createBooking({
            id: "admin-passenger",
            userId: otherUserId,
            passengerEmail: user.email,
        });
        await createBooking({
            id: "other-booking",
            userId: otherUserId,
            passengerEmail: "someone-else@example.com",
        });

        const dashboard = await agent.get("/dashboard");
        expect(dashboard.text).toContain('href="/bookings">View Your Bookings</a>');

        const page = await agent.get("/bookings");
        expect(page.status).toBe(200);
        expect(page.text).toContain("Your Bookings");
        expect(page.text).toContain('data-bookings-scope="mine"');

        const response = await agent.get("/api/bookings_paginated?scope=mine");
        expect(response.status).toBe(200);
        expect(response.body.bookings.map((booking) => booking.id)).toEqual(
            expect.arrayContaining(["admin-created", "admin-passenger"])
        );
        expect(response.body.bookings.map((booking) => booking.id)).not.toContain(
            "other-booking"
        );
    });

    test("the admin bookings page can still request all bookings", async () => {
        const { agent, user } = await loginAs("admin", "all-bookings");
        const otherUserId = await createUser(
            "Other User",
            "other-user-all",
            "other-all@example.com",
            password
        );
        await createBooking({
            id: "admin-booking",
            userId: user._id,
            passengerEmail: "traveler@example.com",
        });
        await createBooking({
            id: "other-booking",
            userId: otherUserId,
            passengerEmail: "someone-else@example.com",
        });

        const page = await agent.get("/bookings-admin");
        expect(page.status).toBe(200);
        expect(page.text).toContain("Manage Bookings");
        expect(page.text).toContain('data-bookings-scope="all"');

        const response = await agent.get("/api/bookings_paginated");
        expect(response.status).toBe(200);
        expect(response.body.bookings.map((booking) => booking.id)).toEqual(
            expect.arrayContaining(["admin-booking", "other-booking"])
        );
    });

    test("non-admin users stay scoped to their own bookings even if they request all", async () => {
        const { agent, user } = await loginAs("customer", "scope-enforcement");
        const otherUserId = await createUser(
            "Other User",
            "other-user-scope",
            "other-scope@example.com",
            password
        );
        await createBooking({
            id: "customer-booking",
            userId: user._id,
            passengerEmail: "traveler@example.com",
        });
        await createBooking({
            id: "other-booking-scope",
            userId: otherUserId,
            passengerEmail: "someone-else@example.com",
        });

        const personalPage = await agent.get("/bookings");
        expect(personalPage.status).toBe(200);
        expect(personalPage.text).toContain("Your Bookings");
        expect(personalPage.text).toContain('data-bookings-scope="mine"');
        expect((await agent.get("/bookings-admin")).status).toBe(403);

        const response = await agent.get("/api/bookings_paginated?scope=all");
        expect(response.status).toBe(200);
        expect(response.body.bookings.map((booking) => booking.id)).toEqual([
            "customer-booking",
        ]);
    });
});
