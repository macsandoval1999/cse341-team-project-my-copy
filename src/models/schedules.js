import Schedule from "./schemas/schedules.js";
import Trip from "./schemas/trips.js";

export async function getAllSchedules() {
    return Schedule.find({}).sort({ id: 1 }).lean();
}

export async function getScheduleById(id) {
    return Schedule.findOne({ id }).lean();
}

export async function createSchedule(scheduleData) {
    return Schedule.create(scheduleData);
}

export async function updateSchedule(id, updates) {
    return Schedule.findOneAndUpdate(
        { id },
        { $set: updates },
        { new: true, runValidators: true }
    ).lean();
}

export async function getSchedulesByTripId(tripId, month = undefined) {
    const query = { tripId };
    if (month !== undefined && month !== null && month !== "") {
        const monthNumber = Number(month);
        const trip = await Trip.findOne({ id: tripId }).lean();
        if (!trip) {
            return [];
        }
        let operatingMonths = [];
        if (Array.isArray(trip.operatingMonths)) {
            operatingMonths = trip.operatingMonths.map((value) => Number(value));
        }
        if (!operatingMonths.includes(Number(monthNumber))) {
            return [];
        }
    }
    return Schedule.find(query).sort({ id: 1 }).lean();
}

export async function getPaginatedSchedules({ filter = {}, page, limit, sort, order }) {
    const skip = (page - 1) * limit;
    const [schedules, totalItems] = await Promise.all([
        Schedule.find(filter).sort({ [sort]: order, id: 1 }).skip(skip).limit(limit).lean(),
        Schedule.countDocuments(filter),
    ]);

    return { schedules, totalItems };
}
