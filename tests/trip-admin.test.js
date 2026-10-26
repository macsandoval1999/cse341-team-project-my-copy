import { describe, expect, test } from "vitest";
import request from "supertest";
import app from "../app.js";
import Booking from "../src/models/schemas/bookings.js";
import Schedule from "../src/models/schemas/schedules.js";
import Station from "../src/models/schemas/stations.js";
import Trip from "../src/models/schemas/trips.js";

const adminAgent = async () => {
    const agent = request.agent(app);
    const response = await agent
        .post("/api/auth/login")
        .send({
            identifier: "admin@example.com",
            password: "known test password",
        });
    expect(response.status).toBe(200);
    return agent;
};

describe("admin trip editing", () => {
    test("places trip search first and exposes the editable train field", async () => {
        const admin = await adminAgent();
        const response = await admin.get("/trips-admin");

        expect(response.status).toBe(200);
        expect(response.text.indexOf('for="trip-keyword-search"'))
            .toBeLessThan(response.text.indexOf('for="region-filter"'));
        expect(response.text).toContain('id="availability-filter"');
        expect(response.text).toContain('<option value="available">Available</option>');
        expect(response.text).toContain('<option value="unavailable">Unavailable</option>');
        expect(response.text).toContain('id="edit-train"');
        expect(response.text).toContain('No train assigned (temporarily unavailable)');
        expect(response.text).toContain('id="edit-region"');
        expect(response.text).toContain('id="edit-months"');
        expect(response.text).toContain('id="trip-create-form"');
        expect(response.text).toContain('<summary>');
        expect(response.text).toContain('A trip needs an initial schedule before it can be saved.');
        expect(response.text).toContain('id="schedule-filter"');
        expect(response.text).toContain('Missing active schedules');
        expect(response.text).not.toContain('manage-schedules-btn');
        expect(response.text).toContain('class="edit-action-btn">Edit</button>');
        expect(response.text).toContain('name="scheduleDepartureTime"');
        expect(response.text).toContain('name="scheduleArrivalTime" type="time" required');
        expect(response.text).toContain('name="trainId" required');
        expect(response.text).toContain('name="startStation" required');
        expect(response.text).toContain('name="endStation" required');
        expect(response.text).toContain('id="create-schedule-days-error"');
        expect(response.text).toContain('id="trip-create-validation"');
        expect(response.text).toContain('id="admin-edit-validation"');
        expect(response.text).toContain('id="trip-schedule-create-form"');
        expect(response.text).toContain('Each schedule belongs to this trip only.');
        expect(response.text).toContain('id="admin-delete-dialog"');
        expect(response.text).toContain('/js/admin-delete-confirm.js');
    });

    test("creates a trip from the admin API", async () => {
        const admin = await adminAgent();
        const response = await admin.post("/api/trips").send({
            id: "coastal-express-test",
            name: "Coastal Express Test",
            description: "A test trip along the coast.",
            startStation: "aomori",
            endStation: "akita",
            distance: 125,
            trainId: "series-e353",
            region: "tohoku",
            duration: "2.5 hours",
            bestSeason: "spring",
            operatingMonths: [3, 4, 5],
            highlights: ["Ocean views"],
            imageUrl: "",
            schedules: [{
                departureTime: "08:30",
                arrivalTime: "11:00",
                daysOfWeek: ["monday", "friday"],
            }],
        });

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
            id: "coastal-express-test",
            trainId: "series-e353",
            availability: { isAvailable: true, message: null },
        });
        expect(await Trip.findOne({ id: "coastal-express-test" })).not.toBeNull();
        expect(await Schedule.countDocuments({ tripId: "coastal-express-test" })).toBe(1);
    });

    test("rejects trip creation when no initial schedule is supplied", async () => {
        const admin = await adminAgent();
        const response = await admin.post("/api/trips").send({
            id: "trip-without-schedule",
            name: "Trip Without Schedule",
            description: "This trip must not be created without a schedule.",
            startStation: "aomori",
            endStation: "akita",
            distance: 125,
            trainId: "series-e353",
            region: "tohoku",
            duration: "2.5 hours",
            bestSeason: "spring",
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/at least one schedule/i);
        expect(await Trip.findOne({ id: "trip-without-schedule" })).toBeNull();
    });

    test("rejects trip creation when the initial schedule list is empty", async () => {
        const admin = await adminAgent();
        const response = await admin.post("/api/trips").send({
            id: "trip-with-empty-schedules",
            name: "Trip With Empty Schedules",
            description: "This trip must include at least one schedule.",
            startStation: "aomori",
            endStation: "akita",
            distance: 125,
            trainId: "series-e353",
            region: "tohoku",
            duration: "2.5 hours",
            bestSeason: "spring",
            schedules: [],
        });

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/at least one schedule/i);
        expect(await Trip.findOne({ id: "trip-with-empty-schedules" })).toBeNull();
        expect(await Schedule.countDocuments({
            tripId: "trip-with-empty-schedules",
        })).toBe(0);
    });

    test("does not allow an existing schedule to be reassigned when creating a trip", async () => {
        const admin = await adminAgent();
        const response = await admin.post("/api/trips").send({
            id: "schedule-conflict-test",
            name: "Schedule Conflict Test",
            description: "A test trip that must not claim an assigned schedule.",
            startStation: "aomori",
            endStation: "akita",
            distance: 125,
            trainId: "series-e353",
            region: "tohoku",
            duration: "2.5 hours",
            bestSeason: "spring",
            schedules: [{
                departureTime: "08:30",
                arrivalTime: "11:00",
                daysOfWeek: ["monday"],
            }],
            scheduleIds: [1],
        });

        expect(response.status).toBe(400);
        expect(await Trip.findOne({ id: "schedule-conflict-test" })).toBeNull();
        expect((await Schedule.findOne({ id: 1 }).lean()).tripId)
            .toBe("alpine-panorama");
    });

    test("creates schedules owned by the selected trip", async () => {
        const admin = await adminAgent();
        const response = await admin.post("/api/trips/alpine-panorama/schedules").send({
            departureTime: "07:15",
            arrivalTime: "10:45",
            daysOfWeek: ["monday", "friday"],
        });

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
            tripId: "alpine-panorama",
            departureTime: "07:15",
            arrivalTime: "10:45",
            daysOfWeek: ["monday", "friday"],
            status: true,
        });
        expect(await Schedule.findOne({ id: response.body.id }).lean())
            .toMatchObject({ tripId: "alpine-panorama" });
    });

    test("rejects attempts to transfer schedule ownership", async () => {
        const admin = await adminAgent();
        const scheduleBefore = await Schedule.findOne({ id: 1 }).lean();
        const response = await admin.put("/api/schedules/1").send({
            tripId: "another-trip",
        });

        expect(response.status).toBe(400);
        expect((await Schedule.findOne({ id: 1 }).lean()).tripId)
            .toBe(scheduleBefore.tripId);
    });

    test("keeps booked departure details stable", async () => {
        const admin = await adminAgent();
        const originalSchedule = await Schedule.findOne({ id: 1 }).lean();
        await Booking.create({
            id: "booked-schedule-edit-protection",
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

        const response = await admin.put("/api/schedules/1").send({
            departureTime: "23:00",
        });

        expect(response.status).toBe(409);
        expect((await Schedule.findOne({ id: 1 }).lean()).departureTime)
            .toBe(originalSchedule.departureTime);
    });

    test("does not allow trip updates to reassign schedules", async () => {
        const admin = await adminAgent();
        await Schedule.create({
            id: 999,
            tripId: "coastal-breeze",
            departureTime: "08:00",
            arrivalTime: "11:00",
            daysOfWeek: ["monday"],
            status: true,
        });
        const response = await admin.put("/api/trips/alpine-panorama").send({
            scheduleIds: [999],
        });

        expect(response.status).toBe(400);
        expect((await Schedule.findOne({ id: 999 }).lean()).tripId)
            .toBe("coastal-breeze");
    });

    test("prevents deleting trips that have bookings", async () => {
        const admin = await adminAgent();
        await Booking.create({
            id: "trip-delete-protection",
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

        const response = await admin.delete("/api/trips/alpine-panorama");
        expect(response.status).toBe(409);
        expect(await Trip.findOne({ id: "alpine-panorama" })).not.toBeNull();
        expect(await Schedule.findOne({ id: 1 })).not.toBeNull();
    });

    test("accepts existing station IDs when updating a trip", async () => {
        const admin = await adminAgent();
        const station = await Station.findOne({ id: "aomori" });
        expect(station).not.toBeNull();

        const response = await admin.put("/api/trips/alpine-panorama").send({
            startStation: station.id,
        });

        expect(response.status).toBe(200);
        expect((await Trip.findOne({ id: "alpine-panorama" }).lean()).startStation)
            .toBe(station.id);
    });

    test("updates trip train and editable trip details", async () => {
        const admin = await adminAgent();

        const response = await admin.put("/api/trips/alpine-panorama").send({
            trainId: "kiha-261",
            region: "hokkaido",
            duration: "5 hours",
            bestSeason: "winter",
            operatingMonths: [1, 2, 12],
            highlights: ["Snowy scenery", "Hot springs"],
            imageUrl: "/images/routes/winter-trip.png",
        });

        expect(response.status).toBe(200);
        expect(await Trip.findOne({ id: "alpine-panorama" }).lean()).toMatchObject({
            trainId: "kiha-261",
            region: "hokkaido",
            duration: "5 hours",
            bestSeason: "winter",
            operatingMonths: [1, 2, 12],
            highlights: ["Snowy scenery", "Hot springs"],
            imageUrl: "/images/routes/winter-trip.png",
        });
    });

    test("rejects a nonexistent train assignment", async () => {
        const admin = await adminAgent();

        const response = await admin.put("/api/trips/alpine-panorama").send({
            trainId: "missing-train",
        });

        expect(response.status).toBe(400);
        expect((await Trip.findOne({ id: "alpine-panorama" }).lean()).trainId)
            .toBe("series-e353");
    });

    test("rejects operating months outside the calendar", async () => {
        const admin = await adminAgent();

        const response = await admin.put("/api/trips/alpine-panorama").send({
            operatingMonths: [0, 13],
        });

        expect(response.status).toBe(400);
    });
});
