import Station from "./schemas/stations.js";

export async function getAllStations() {
    return Station.find({}).sort({ id: 1 }).lean();
}

export async function getStationById(id) {
    return Station.findOne({ id }).lean();
}

export async function getPaginatedStations({ filter = {}, page, limit, sort, order }) {
    const skip = (page - 1) * limit;
    const [stations, totalItems] = await Promise.all([
        Station.find(filter).sort({ [sort]: order, id: 1 }).skip(skip).limit(limit).lean(),
        Station.countDocuments(filter),
    ]);

    return { stations, totalItems };
}
