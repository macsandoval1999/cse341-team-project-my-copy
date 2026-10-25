import Station from "./schemas/stations.js";

export async function getAllStations() {
    return Station.find({}).sort({ id: 1 }).lean();
}

export async function getStationById(id) {
    return Station.findOne({ id }).lean();
}
