import Station from "./schemas/stations.js";
import { escapeRegExp } from "../utils/list-query.js";

export async function getAllStations() {
    return Station.find({}).sort({ id: 1 }).lean();
}

export async function getStationById(id) {
    return Station.findOne({
        $or: [
            { id },
            { name: { $regex: `^${escapeRegExp(id)}$`, $options: "i" } },
        ],
    }).lean();
}

export async function getPaginatedStations({ filter = {}, page, limit, sort, order }) {
    const skip = (page - 1) * limit;
    const [stations, totalItems] = await Promise.all([
        Station.find(filter).sort({ [sort]: order, id: 1 }).skip(skip).limit(limit).lean(),
        Station.countDocuments(filter),
    ]);

    return { stations, totalItems };
}

export async function getStationFilterOptions() {
    const [regions, prefectures, facilities] = await Promise.all([
        Station.distinct("region"),
        Station.distinct("prefecture"),
        Station.distinct("facilities"),
    ]);

    return {
        regions: regions.filter(Boolean).sort(),
        prefectures: prefectures.filter(Boolean).sort(),
        facilities: facilities.filter(Boolean).sort(),
    };
}

export async function createStation(stationData) {
    const station = await Station.create(stationData);
    return station.toObject();
}

export async function updateStation(id, updates) {
    return Station.findOneAndUpdate(
        { id },
        { $set: updates },
        { returnDocument: "after", runValidators: true }
    ).lean();
}

export async function deleteStation(id) {
    return Station.deleteOne({ id });
}
