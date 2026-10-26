import {
    getPaginatedSchedules as findPaginatedSchedules,
    getScheduleById as findScheduleById,
    createSchedule as insertSchedule,
    updateSchedule as changeSchedule,
} from "../models/schedules.js";
import Schedule from "../models/schemas/schedules.js";
import Booking from "../models/schemas/bookings.js";
import {
    getTripById as findTripById,
    getTripAvailability,
} from "../models/trips.js";
import {
    createListResponse,
    escapeRegExp,
    parseListQuery,
    parseOptionalFilters,
} from "../utils/list-query.js";

// --------------------------
/***HELPER Function***/
// --------------------------

// Validate month is integer between 1-12
export function validateMonth(req, res, next) {
    if (req.query.month === undefined) {
        return next();
    }

    const month = Number(req.query.month);

    if (!Number.isInteger(month) || month < 1 || month > 12) {
        return res.status(400).json({
            error: "month must be an integer from 1 through 12",
        });
    }

    req.month = month;
    return next();
}

//

// ----------------------------
/***CONTROLLER FUNCTIONS***/
// ----------------------------

// GET all schedules
export async function getAllSchedules(req, res) {
    try {
        const result = await buildScheduleList(req.query);
        if (result.errors) {
            return res.status(400).json({ errors: result.errors });
        }
        return res.status(200).json(result.response);
    } catch (error) {
        console.error("Error fetching schedules:", error);
        return res.status(500).json({ error: "Failed to fetch schedules" });
    }
}

export async function getAdminSchedules(req, res) {
    try {
        const result = await buildScheduleList(req.query);
        if (result.errors) {
            return res.status(400).json({ errors: result.errors });
        }
        const scheduleIds = result.response.data.map((schedule) => schedule.id);
        const bookedScheduleIds = new Set(
            await Booking.distinct("scheduleId", { scheduleId: { $in: scheduleIds } })
        );
        result.response.data = result.response.data.map((schedule) => ({
            ...schedule,
            hasBookings: bookedScheduleIds.has(schedule.id),
        }));
        return res.status(200).json(result.response);
    } catch (error) {
        console.error("Error fetching admin schedules:", error);
        return res.status(500).json({ error: "Failed to fetch schedules" });
    }
}

// GET one schedule by id
export async function getScheduleById(req, res) {
    try {
        const { id } = req.params;
        const scheduleId = Number(id);
        if (!Number.isSafeInteger(scheduleId)) {
            return res.status(400).json({ error: "Schedule ID must be an integer" });
        }

        const schedule = await findScheduleById(scheduleId);

        if (!schedule) {
            return res.status(404).json({ error: "Schedule not found" });
        }

        return res.status(200).json(schedule);
    } catch (error) {
        console.error("Error fetching schedule:", error);
        return res.status(500).json({ error: "Failed to fetch schedule" });
    }
}

const scheduleSortFields = [
    "id",
    "tripId",
    "departureTime",
    "arrivalTime",
    "status",
];

export const schedulesAdminPage = (_req, res) => {
    res.render("schedules-admin", { title: "Manage Schedules" });
};
const validDays = new Set([
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
]);

const validateScheduleData = (data, { partial = false } = {}) => {
    const allowedFields = ["departureTime", "arrivalTime", "daysOfWeek", "status"];
    const unknownField = Object.keys(data).find(
        (field) => !allowedFields.includes(field)
    );
    if (unknownField) {
        return { error: `Unsupported schedule field: ${unknownField}` };
    }
    if (Object.keys(data).length === 0) {
        return { error: "Schedule details are required" };
    }

    const normalized = {};
    for (const field of ["departureTime", "arrivalTime"]) {
        if (partial && !(field in data)) continue;
        if (typeof data[field] !== "string" ||
            !/^([01]\d|2[0-3]):[0-5]\d$/.test(data[field])) {
            return { error: `${field} must be a valid 24-hour time (HH:MM)` };
        }
        normalized[field] = data[field];
    }
    if (!partial || "daysOfWeek" in data) {
        if (!Array.isArray(data.daysOfWeek) ||
            data.daysOfWeek.length === 0 ||
            data.daysOfWeek.some((day) =>
                typeof day !== "string" || !validDays.has(day.toLowerCase())
            ) ||
            new Set(data.daysOfWeek.map((day) => day.toLowerCase())).size !== data.daysOfWeek.length) {
            return { error: "daysOfWeek must contain unique valid weekdays" };
        }
        normalized.daysOfWeek = data.daysOfWeek.map((day) => day.toLowerCase());
    }
    if ("status" in data) {
        if (typeof data.status !== "boolean") {
            return { error: "status must be a boolean" };
        }
        normalized.status = data.status;
    }
    return { data: normalized };
};

export async function createScheduleForTrip(req, res) {
    try {
        const { tripId } = req.params;
        const trip = await findTripById(tripId);
        if (!trip) {
            return res.status(404).json({ error: `Trip '${tripId}' was not found` });
        }

        const validation = validateScheduleData(req.body);
        if (validation.error) {
            return res.status(400).json({ error: validation.error });
        }

        const latestSchedule = await Schedule.findOne({})
            .sort({ id: -1 })
            .select("id")
            .lean();
        const schedule = await insertSchedule({
            id: (latestSchedule?.id ?? 0) + 1,
            tripId,
            ...validation.data,
        });
        return res.status(201).json(schedule);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                error: "A schedule ID conflict occurred. Please retry.",
            });
        }
        if (error.name === "ValidationError" || error.name === "CastError") {
            return res.status(400).json({ error: "Invalid schedule information" });
        }
        console.error("Error creating trip schedule:", error);
        return res.status(500).json({ error: "Failed to create schedule" });
    }
}

export async function updateScheduleById(req, res) {
    try {
        const scheduleId = Number(req.params.id);
        if (!Number.isSafeInteger(scheduleId)) {
            return res.status(400).json({ error: "Schedule ID must be an integer" });
        }
        const validation = validateScheduleData(req.body, { partial: true });
        if (validation.error) {
            return res.status(400).json({ error: validation.error });
        }
        const existingSchedule = await findScheduleById(scheduleId);
        if (!existingSchedule) {
            return res.status(404).json({ error: "Schedule not found" });
        }
        const changesBookedDeparture = ["departureTime", "arrivalTime", "daysOfWeek"]
            .some((field) => {
                if (!(field in validation.data)) return false;
                if (field !== "daysOfWeek") {
                    return validation.data[field] !== existingSchedule[field];
                }
                const requestedDays = [...validation.data.daysOfWeek].sort();
                const currentDays = [...existingSchedule.daysOfWeek].sort();
                return JSON.stringify(requestedDays) !== JSON.stringify(currentDays);
            });
        if (changesBookedDeparture && await Booking.exists({ scheduleId })) {
            return res.status(409).json({
                error: "Departure times and operating days cannot be changed while bookings reference this schedule.",
            });
        }
        const schedule = await changeSchedule(scheduleId, validation.data);
        if (!schedule) {
            return res.status(404).json({ error: "Schedule not found" });
        }
        return res.status(200).json(schedule);
    } catch (error) {
        if (error.name === "ValidationError" || error.name === "CastError") {
            return res.status(400).json({ error: "Invalid schedule information" });
        }
        console.error("Error updating schedule:", error);
        return res.status(500).json({ error: "Failed to update schedule" });
    }
}

const buildScheduleList = async (query, tripId, monthAvailable = true) => {
    const options = parseListQuery(query, scheduleSortFields, "id");
    if (options.errors.length > 0) {
        return { errors: options.errors };
    }

    const filters = parseOptionalFilters(query, {
        q: { maxLength: 100 },
        day: {},
        tripId: {},
    });
    if (filters.errors.length > 0) {
        return { errors: filters.errors };
    }
    const { q, day, tripId: requestedTripId } = filters.values;
    const status = query.status;
    if (day.value && !validDays.has(day.value.toLowerCase())) {
        return {
            errors: [{ field: "day", message: "day must be a valid weekday." }],
        };
    }
    if (status !== undefined && !["true", "false"].includes(status)) {
        return {
            errors: [{ field: "status", message: "status must be true or false." }],
        };
    }

    const filter = {};
    const appliedQuery = {};
    if (tripId) {
        filter.tripId = tripId;
        appliedQuery.tripId = tripId;
    } else if (requestedTripId.value) {
        filter.tripId = {
            $regex: `^${escapeRegExp(requestedTripId.value)}$`,
            $options: "i",
        };
        appliedQuery.tripId = requestedTripId.value;
    }
    if (!monthAvailable) {
        filter._id = { $exists: false };
        appliedQuery.month = query.month;
    } else if (query.month !== undefined) {
        appliedQuery.month = query.month;
    }
    if (q.value) {
        const pattern = escapeRegExp(q.value);
        filter.$or = [
            { tripId: { $regex: pattern, $options: "i" } },
            { departureTime: { $regex: pattern, $options: "i" } },
            { arrivalTime: { $regex: pattern, $options: "i" } },
            { daysOfWeek: { $regex: pattern, $options: "i" } },
        ];
        appliedQuery.q = q.value;
    }
    if (day.value) {
        filter.daysOfWeek = {
            $regex: `^${escapeRegExp(day.value)}$`,
            $options: "i",
        };
        appliedQuery.day = day.value.toLowerCase();
    }
    if (status !== undefined) {
        filter.status = status === "true";
        appliedQuery.status = status;
    }

    const { schedules, totalItems } = await findPaginatedSchedules({
        filter,
        ...options,
    });
    return {
        response: createListResponse({
            data: schedules,
            ...options,
            totalItems,
            query: appliedQuery,
        }),
    };
};

const sendTripSchedules = async (req, res, trip, month) => {
    const monthAvailable = month === undefined ||
        (Array.isArray(trip.operatingMonths) &&
            trip.operatingMonths.map(Number).includes(Number(month)));
    const result = await buildScheduleList(req.query, trip.id, monthAvailable);
    if (result.errors) {
        return res.status(400).json({ errors: result.errors });
    }
    const availability = await getTripAvailability(trip);
    return res.status(200).json({ ...result.response, availability });
};

// GET all schedules for a specific trip
export async function getSchedulesByTripId(req, res) {
    try {
        const { tripId } = req.params;
        const trip = await findTripById(tripId);
        if (!trip) {
            return res.status(404).json({ error: `Trip ${tripId} not found` });
        }
        return sendTripSchedules(req, res, trip);
    } catch (error) {
        console.error("Error fetching schedules for trip:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

// GET all schedules for a specific trip during a specific month
export async function getSchedulesByTripAndMonth(req, res) {
    try {
        const { tripId } = req.params;
        const trip = await findTripById(tripId);
        if (!trip) {
            return res.status(404).json({ error: `Trip ${tripId} not found` });
        }
        return sendTripSchedules(req, res, trip, req.month);
    } catch (error) {
        console.error("Error fetching schedules for trip and month:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}
