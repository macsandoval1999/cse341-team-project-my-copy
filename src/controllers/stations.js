import {
    getPaginatedStations as findPaginatedStations,
    getStationById as findStationById,
} from "../models/stations.js";
import {
    createListResponse,
    escapeRegExp,
    parseListQuery,
    parseOptionalFilters,
} from "../utils/list-query.js";

export async function getAllStations(req, res) {
    try {
        const options = parseListQuery(
            req.query,
            ["id", "name", "prefecture", "region"],
            "id"
        );
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
            filter.$or = ["id", "name", "prefecture", "region"].map((field) => ({
                [field]: { $regex: pattern, $options: "i" },
            }));
        }
        if (region.value) {
            filter.region = { $regex: `^${escapeRegExp(region.value)}$`, $options: "i" };
        }
        if (prefecture.value) {
            filter.prefecture = { $regex: `^${escapeRegExp(prefecture.value)}$`, $options: "i" };
        }
        if (facility.value) {
            filter.facilities = { $regex: escapeRegExp(facility.value), $options: "i" };
        }

        const { stations, totalItems } = await findPaginatedStations({
            filter,
            ...options,
        });
        return res.status(200).json(createListResponse({
            data: stations,
            ...options,
            totalItems,
            query: {
                q: q.value,
                region: region.value,
                prefecture: prefecture.value,
                facility: facility.value,
            },
        }));
    } catch (error) {
        console.error("Error fetching stations:", error);

        return res.status(500).json({
            error: "Failed to fetch stations",
        });
    }
}

export async function getStationById(req, res) {
    try {
        const { id } = req.params;

        const station = await findStationById(id);

        if (!station) {
            return res.status(404).json({
                error: "Station not found",
            });
        }

        return res.status(200).json(station);
    } catch (error) {
        console.error("Error fetching station:", error);

        return res.status(500).json({
            error: "Failed to fetch station",
        });
    }
}
