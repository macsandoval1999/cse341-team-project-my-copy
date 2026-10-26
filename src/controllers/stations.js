import {
    createStation as insertStation,
    deleteStation as removeStation,
    getPaginatedStations as findPaginatedStations,
    getStationById as findStationById,
    getStationFilterOptions as findStationFilterOptions,
    updateStation as changeStation,
} from "../models/stations.js";
import Trip from "../models/schemas/trips.js";
import {
    createListResponse,
    escapeRegExp,
    parseListQuery,
    parseOptionalFilters,
} from "../utils/list-query.js";

const allowedSortFields = ["id", "name", "prefecture", "region"];
const allowedStationFields = new Set([
    "id",
    "name",
    "prefecture",
    "region",
    "facilities",
    "description",
]);

const validateStationData = (data, { partial = false } = {}) => {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        return { error: "Station details must be an object" };
    }

    const unsupportedField = Object.keys(data).find(
        (field) => !allowedStationFields.has(field)
    );
    if (unsupportedField) {
        return { error: `Unsupported station field: ${unsupportedField}` };
    }
    if (Object.keys(data).length === 0) {
        return { error: "Station details are required" };
    }
    if (!partial && (!("id" in data) || !("name" in data))) {
        return { error: "id and name are required" };
    }
    if (partial && "id" in data) {
        return { error: "Station ID cannot be changed" };
    }

    const normalized = {};
    if ("id" in data) {
        if (
            typeof data.id !== "string" ||
            !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.id.trim())
        ) {
            return {
                error: "id must contain lowercase letters, numbers, and single hyphens",
            };
        }
        normalized.id = data.id.trim();
    }

    for (const field of ["name", "prefecture", "region", "description"]) {
        if (!(field in data)) continue;
        if (typeof data[field] !== "string") {
            return { error: `${field} must be a string` };
        }
        const value = data[field].trim();
        const maxLength = field === "description" ? 500 : 100;
        if ((!partial || field === "name") && !value) {
            return { error: `${field} is required` };
        }
        if (value.length > maxLength) {
            return { error: `${field} cannot exceed ${maxLength} characters` };
        }
        normalized[field] = value;
    }

    if ("facilities" in data) {
        if (!Array.isArray(data.facilities) || data.facilities.length > 30) {
            return { error: "facilities must be an array of at most 30 strings" };
        }
        const facilities = [];
        for (const facility of data.facilities) {
            if (
                typeof facility !== "string" ||
                !facility.trim() ||
                facility.trim().length > 60
            ) {
                return {
                    error: "Each facility must be a non-empty string of at most 60 characters",
                };
            }
            const value = facility.trim();
            if (!facilities.includes(value)) {
                facilities.push(value);
            }
        }
        normalized.facilities = facilities;
    }

    return { data: normalized };
};

const tripUsesStation = (station) => {
    const namePattern = new RegExp(`^${escapeRegExp(station.name)}$`, "i");
    return Trip.exists({
        $or: [
            { startStation: station.id },
            { startStation: namePattern },
            { endStation: station.id },
            { endStation: namePattern },
        ],
    });
};

export const stationsPage = (_req, res) => {
    res.render("stations", { title: "Stations", isAdmin: false });
};

export const stationsAdminPage = (_req, res) => {
    res.render("stations", { title: "Manage Stations", isAdmin: true });
};

export async function getAllStations(req, res, { includeUsage = false } = {}) {
    try {
        const options = parseListQuery(req.query, allowedSortFields, "id");
        if (options.errors.length > 0) {
            return res.status(400).json({ errors: options.errors });
        }

        const filters = parseOptionalFilters(req.query, {
            q: { maxLength: 100 },
            region: {},
            prefecture: {},
            facility: {},
        });
        if (filters.errors.length > 0) {
            return res.status(400).json({ errors: filters.errors });
        }
        const { q, region, prefecture, facility } = filters.values;

        const filter = {};
        if (q.value) {
            const pattern = escapeRegExp(q.value);
            filter.$or = ["id", "name", "prefecture", "region", "description"].map(
                (field) => ({
                    [field]: { $regex: pattern, $options: "i" },
                })
            );
            filter.$or.push({ facilities: { $regex: pattern, $options: "i" } });
        }
        if (region.value) {
            filter.region = {
                $regex: `^${escapeRegExp(region.value)}$`,
                $options: "i",
            };
        }
        if (prefecture.value) {
            filter.prefecture = {
                $regex: `^${escapeRegExp(prefecture.value)}$`,
                $options: "i",
            };
        }
        if (facility.value) {
            filter.facilities = {
                $regex: escapeRegExp(facility.value),
                $options: "i",
            };
        }

        const { stations, totalItems } = await findPaginatedStations({
            filter,
            ...options,
        });
        let data = stations;
        if (includeUsage && stations.length > 0) {
            const stationValues = stations.flatMap((station) => [station.id, station.name]);
            const stationNamePatterns = stations.map(
                (station) => new RegExp(`^${escapeRegExp(station.name)}$`, "i")
            );
            const usedTrips = await Trip.find({
                $or: [
                    { startStation: { $in: stationValues } },
                    { endStation: { $in: stationValues } },
                    { startStation: { $in: stationNamePatterns } },
                    { endStation: { $in: stationNamePatterns } },
                ],
            })
                .select("startStation endStation")
                .lean();
            const usedValues = new Set(
                usedTrips.flatMap((trip) => [trip.startStation, trip.endStation])
                    .filter(Boolean)
                    .map((value) => value.toLowerCase())
            );
            data = stations.map((station) => ({
                ...station,
                inUse: usedValues.has(station.id.toLowerCase()) ||
                    usedValues.has(station.name.toLowerCase()),
            }));
        }
        return res.status(200).json(
            createListResponse({
                data,
                ...options,
                totalItems,
                query: {
                    q: q.value,
                    region: region.value,
                    prefecture: prefecture.value,
                    facility: facility.value,
                },
            })
        );
    } catch (error) {
        console.error("Error fetching stations:", error);
        return res.status(500).json({ error: "Failed to fetch stations" });
    }
}

export async function getAdminStations(req, res) {
    return getAllStations(req, res, { includeUsage: true });
}

export async function getStationFilterOptions(_req, res) {
    try {
        return res.status(200).json(await findStationFilterOptions());
    } catch (error) {
        console.error("Error fetching station filter options:", error);
        return res
            .status(500)
            .json({ error: "Failed to fetch station filter options" });
    }
}

export async function getStationById(req, res) {
    try {
        const station = await findStationById(req.params.id);
        if (!station) {
            return res.status(404).json({ error: "Station not found" });
        }
        return res.status(200).json(station);
    } catch (error) {
        console.error("Error fetching station:", error);
        return res.status(500).json({ error: "Failed to fetch station" });
    }
}

export async function createStationRecord(req, res) {
    const validation = validateStationData(req.body);
    if (validation.error) {
        return res.status(400).json({ error: validation.error });
    }

    try {
        const station = await insertStation(validation.data);
        return res.status(201).json(station);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: "A station with this ID already exists" });
        }
        if (error.name === "ValidationError" || error.name === "CastError") {
            return res.status(400).json({ error: "Invalid station information" });
        }
        console.error("Error creating station:", error);
        return res.status(500).json({ error: "Failed to create station" });
    }
}

export async function updateStationRecord(req, res) {
    const validation = validateStationData(req.body, { partial: true });
    if (validation.error) {
        return res.status(400).json({ error: validation.error });
    }

    try {
        const station = await findStationById(req.params.id);
        if (!station) {
            return res.status(404).json({ error: "Station not found" });
        }
        if (await tripUsesStation(station)) {
            return res.status(409).json({
                error: "This station is used by a trip and cannot be modified",
            });
        }

        const updatedStation = await changeStation(station.id, validation.data);
        return res.status(200).json(updatedStation);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: "A station with this ID already exists" });
        }
        if (error.name === "ValidationError" || error.name === "CastError") {
            return res.status(400).json({ error: "Invalid station information" });
        }
        console.error("Error updating station:", error);
        return res.status(500).json({ error: "Failed to update station" });
    }
}

export async function deleteStationRecord(req, res) {
    try {
        const station = await findStationById(req.params.id);
        if (!station) {
            return res.status(404).json({ error: "Station not found" });
        }
        if (await tripUsesStation(station)) {
            return res.status(409).json({
                error: "This station is used by a trip and cannot be deleted",
            });
        }

        await removeStation(station.id);
        return res.status(204).end();
    } catch (error) {
        console.error("Error deleting station:", error);
        return res.status(500).json({ error: "Failed to delete station" });
    }
}
