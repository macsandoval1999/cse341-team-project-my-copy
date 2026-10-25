import {
    getAllSchedules as findAllSchedules,
    getScheduleById as findScheduleById,
    getSchedulesByTripId as findSchedulesByTripId,
} from "../models/schedules.js";
import { getTripById as findTripById } from "../models/trips.js";

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
        const schedules = await findAllSchedules();
        return res.status(200).json(schedules);
    } catch (error) {
        console.error("Error fetching schedules:", error);
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

// GET all schedules for a specific trip
export async function getSchedulesByTripId(req, res) {
    try {
        const { tripId } = req.params;
        const trip = await findTripById(tripId);
        if (!trip) {
            return res.status(404).json({ error: `Trip ${tripId} not found` });
        }
        const schedules = await findSchedulesByTripId(tripId);
        return res.status(200).json(schedules);
    } catch (error) {
        console.error("Error fetching schedules for trip:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

// GET all schedules for a specific trip during a specific month
export async function getSchedulesByTripAndMonth(req, res) {
    try {
        const { tripId } = req.params;
        const month = req.month;
        const trip = await findTripById(tripId);
        if (!trip) {
            return res.status(404).json({ error: `Trip ${tripId} not found` });
        }
        const schedules = await findSchedulesByTripId(tripId, month);
        if (schedules.length === 0) {
            return res.status(404).json({
                error: `No schedules available for the selected month.`,
            });
        }
        return res.status(200).json(schedules);
    } catch (error) {
        console.error("Error fetching schedules for trip and month:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}
