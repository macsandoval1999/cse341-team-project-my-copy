import { describe, expect, test } from "vitest";
import Schedule from "../src/models/schemas/schedules.js";
import { repairMissingStarterSchedules } from "../src/db/repair-schedules.js";

describe("repairMissingStarterSchedules", () => {
    test("restores missing starter schedules without replacing existing schedule data", async () => {
        await Schedule.deleteMany({ tripId: "alpine-panorama" });
        const existingSchedule = await Schedule.create({
            id: 1,
            tripId: "coastal-breeze",
            departureTime: "08:00",
            arrivalTime: "11:00",
            daysOfWeek: ["monday"],
            status: true,
        });

        const repairResult = await repairMissingStarterSchedules();

        expect(repairResult).toEqual({
            restoredTrips: ["alpine-panorama"],
            restoredScheduleCount: 2,
            tripsNeedingAdminSchedules: [],
        });
        const alpineSchedules = await Schedule.find({
            tripId: "alpine-panorama",
        }).sort({ id: 1 }).lean();
        expect(alpineSchedules).toMatchObject([
            {
                id: 15,
                tripId: "alpine-panorama",
                departureTime: "08:30",
                arrivalTime: "13:00",
            },
            {
                id: 16,
                tripId: "alpine-panorama",
                departureTime: "13:15",
                arrivalTime: "17:45",
            },
        ]);
        expect(await Schedule.findOne({ id: existingSchedule.id }).lean())
            .toMatchObject({
                tripId: "coastal-breeze",
                departureTime: "08:00",
                arrivalTime: "11:00",
            });
        expect((await repairMissingStarterSchedules()).restoredScheduleCount)
            .toBe(0);
    });

    test("leaves intentionally inactive schedules unchanged and reports trips needing admin setup", async () => {
        await Schedule.updateMany(
            { tripId: "coastal-breeze" },
            { $set: { status: false } }
        );

        const repairResult = await repairMissingStarterSchedules();

        expect(repairResult.restoredTrips).toEqual([]);
        expect(repairResult.tripsNeedingAdminSchedules)
            .toContain("coastal-breeze");
        expect(await Schedule.countDocuments({ tripId: "coastal-breeze" })).toBe(2);
        expect(await Schedule.countDocuments({
            tripId: "coastal-breeze",
            status: true,
        })).toBe(0);
    });

    test("rejects schedules that reference nonexistent trips", async () => {
        await expect(
            Schedule.create({
                id: 1000,
                tripId: "missing-trip",
                departureTime: "08:00",
                arrivalTime: "11:00",
                daysOfWeek: ["monday"],
            })
        ).rejects.toThrow("does not exist");
    });
});
