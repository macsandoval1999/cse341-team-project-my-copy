import Trip from "../models/schemas/trips.js";

export async function getAllTrips() {
    return Trip.find({}).lean();
}

export async function getTripById(id) {
    return Trip.findOne({ id }).lean();
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
