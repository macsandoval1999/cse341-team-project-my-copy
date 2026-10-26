import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import schedules from "./seeds/schedules.json" with { type: "json" };
import Schedule from "../models/schemas/schedules.js";
import Trip from "../models/schemas/trips.js";
import { closeDb, connectToDb } from "./connect.js";

export async function repairMissingStarterSchedules() {
    const schedulesByTrip = new Map();
    schedules.forEach((schedule) => {
        const tripSchedules = schedulesByTrip.get(schedule.tripId) || [];
        tripSchedules.push(schedule);
        schedulesByTrip.set(schedule.tripId, tripSchedules);
    });

    const [starterTrips, allTrips, activeTripIds] = await Promise.all([
        Trip.find({ id: { $in: [...schedulesByTrip.keys()] } })
            .select("id")
            .lean(),
        Trip.find({}).select("id").lean(),
        Schedule.distinct("tripId", { status: true }),
    ]);
    const latestSchedule = await Schedule.findOne({})
        .sort({ id: -1 })
        .select("id")
        .lean();
    let nextId = latestSchedule?.id ?? 0;
    const restoredTrips = [];

    for (const trip of starterTrips) {
        if (await Schedule.exists({ tripId: trip.id })) {
            continue;
        }

        const tripSchedules = schedulesByTrip.get(trip.id) || [];
        const repairedSchedules = tripSchedules.map((schedule) => ({
            ...schedule,
            id: ++nextId,
        }));
        if (repairedSchedules.length > 0) {
            await Schedule.insertMany(repairedSchedules);
            restoredTrips.push(trip.id);
        }
    }

    return { restoredTrips, restoredScheduleCount: restoredTrips.reduce(
        (count, tripId) => count + schedulesByTrip.get(tripId).length,
        0
    ), tripsNeedingAdminSchedules: allTrips
        .map((trip) => trip.id)
        .filter((tripId) => !activeTripIds.includes(tripId) &&
            !restoredTrips.includes(tripId)) };
}

const runRepair = async () => {
    try {
        await connectToDb();
        const result = await repairMissingStarterSchedules();
        if (result.restoredScheduleCount === 0) {
            console.log("No missing starter schedules found.");
        } else {
            console.log(
                `Restored ${result.restoredScheduleCount} starter schedule(s) for: ${result.restoredTrips.join(", ")}.`
            );
        }
        if (result.tripsNeedingAdminSchedules.length > 0) {
            console.warn(
                `Add schedules in Manage Trips for: ${result.tripsNeedingAdminSchedules.join(", ")}.`
            );
        } else {
            console.log("Every trip now has at least one active schedule.");
        }
    } finally {
        await closeDb();
    }
};

if (
    process.argv[1] &&
    import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
    await runRepair();
}
