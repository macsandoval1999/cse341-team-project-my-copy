import Schedule from "./schemas/schedules.js";
import Trip from "./schemas/trips.js";

export async function getAllSchedules() {
    return Schedule.find({}).sort({ id: 1 }).lean();
}

export async function getScheduleById(id) {
    return Schedule.findOne({ id }).lean();
}

export async function getSchedulesByTripId(tripId, month = undefined) {
    const query = { tripId };
    if (month !== undefined && month !== null && month !== "") {
        const monthNumber = Number(month);
        const trip = await Trip.findOne({ id: tripId }).lean();
        if (!trip) {
            return [];
        }
        const operatingMonths = Array.isArray(trip.operatingMonths)
            ? trip.operatingMonths.map((value) => Number(value))
            : [];
        if (!operatingMonths.includes(Number(monthNumber))) {
            return [];
        }
    }
    return Schedule.find(query).sort({ id: 1 }).lean();
}
