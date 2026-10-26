import Trip from "../models/schemas/trips.js";
import Train from "../models/schemas/trains.js";
import Schedule from "../models/schemas/schedules.js";

export const TRIP_UNAVAILABLE_MESSAGE = "Temporarily unavailable for booking.";
export const TRIP_NO_SCHEDULES_MESSAGE =
    "No active schedules have been added for this trip yet.";

export async function getTripAvailability(trip) {
    let trainLookup = Promise.resolve(false);
    if (trip?.trainId) {
        trainLookup = Train.exists({ id: trip.trainId });
    }
    let scheduleLookup = Promise.resolve(false);
    if (trip?.id) {
        scheduleLookup = Schedule.exists({ tripId: trip.id, status: true });
    }
    const [trainExists, activeScheduleExists] = await Promise.all([
        trainLookup,
        scheduleLookup,
    ]);

    let message = null;
    if (!trainExists) {
        message = TRIP_UNAVAILABLE_MESSAGE;
    } else if (!activeScheduleExists) {
        message = TRIP_NO_SCHEDULES_MESSAGE;
    }

    return {
        isAvailable: trainExists && Boolean(activeScheduleExists),
        message,
    };
}

export async function getTrainIds() {
    return Train.distinct("id");
}

export async function getTripsWithActiveSchedules() {
    return Schedule.distinct("tripId", { status: true });
}

export async function getTripsWithSchedules() {
    return Schedule.distinct("tripId");
}

export async function addTripAvailability(trips) {
    const trainIds = [...new Set(
        trips.map((trip) => trip.trainId).filter(Boolean)
    )];
    const tripIds = trips.map((trip) => trip.id);
    const [trains, activeSchedules, scheduleCounts] = await Promise.all([
        Train.find({ id: { $in: trainIds } }).select("id").lean(),
        Schedule.find({ tripId: { $in: tripIds }, status: true })
            .select("tripId")
            .lean(),
        Schedule.aggregate([
            { $match: { tripId: { $in: tripIds }, status: true } },
            { $group: { _id: "$tripId", count: { $sum: 1 } } },
        ]),
    ]);
    const availableTrainIds = new Set(trains.map((train) => train.id));
    const activeScheduleTripIds = new Set(
        activeSchedules.map((schedule) => schedule.tripId)
    );
    const scheduleCountByTripId = new Map(
        scheduleCounts.map(({ _id, count }) => [_id, count])
    );

    return trips.map((trip) => {
        const hasTrain = Boolean(
            trip.trainId && availableTrainIds.has(trip.trainId)
        );
        const hasActiveSchedule = activeScheduleTripIds.has(trip.id);
        const isAvailable = hasTrain && hasActiveSchedule;
        let message = null;
        if (!hasTrain) {
            message = TRIP_UNAVAILABLE_MESSAGE;
        } else if (!hasActiveSchedule) {
            message = TRIP_NO_SCHEDULES_MESSAGE;
        }
        return {
            ...trip,
            scheduleCount: scheduleCountByTripId.get(trip.id) || 0,
            availability: {
                isAvailable,
                message,
            },
        };
    });
}

export async function getAllTrips() {
    return Trip.find({}).lean();
}

export async function getTripById(id) {
    return Trip.findOne({ id }).lean();
}

export async function createTrip(tripData) {
    const trip = await Trip.create(tripData);
    return trip.toObject();
}

export async function getTripsByTrainId(trainId) {
    return Trip.find({ trainId }).lean();
}

// runValidators makes the schema check that the new train exists
export async function updateTripTrain(tripId, trainId) {
    return Trip.findOneAndUpdate(
        { id: tripId },
        { $set: { trainId } },
        { returnDocument: "after", runValidators: true }
    ).lean();
}

export async function getTripFilters() {
    const [regions, seasons] = await Promise.all([
        Trip.distinct("region"),
        Trip.distinct("bestSeason"),
    ]);

    return { regions, seasons };
}

export async function getPaginatedTrips({ filter = {}, page, limit, sort, order }) {
    const skip = (page - 1) * limit;
    const sortOptions = { [sort]: order, id: 1 };

    const [trips, totalItems] = await Promise.all([
        Trip.find(filter).sort(sortOptions).skip(skip).limit(limit).lean(),
        Trip.countDocuments(filter),
    ]);

    return { trips, totalItems };
}

export async function updateTrip(id, updateData) {
    return Trip.updateOne({ id }, { $set: updateData }, { runValidators: true });
}

export async function deleteTrip (id) {
    return Trip.deleteOne({id:id})
}
