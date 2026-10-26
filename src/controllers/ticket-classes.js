import {
    getPaginatedTicketClasses as findPaginatedTicketClasses,
} from '../models/ticket-classes.js';
import {
    createListResponse,
    escapeRegExp,
    parseListQuery,
    parseOptionalFilters,
} from "../utils/list-query.js";

const validDays = new Set([
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
]);

export const getAllTicketClasses = async (req, res) => {
    try {
        return getTicketClassList(req, res);
    } catch (error) {
        console.error("Error fetching ticket classes:", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getTicketClassesForDay = async (req, res) => {
    return getTicketClassList(req, res);
};

const getTicketClassList = async (req, res) => {
    try {
        const options = parseListQuery(
            req.query,
            ["class", "name", "priceMultiplier"],
            "class"
        );
        if (options.errors.length > 0) {
            return res.status(400).json({ errors: options.errors });
        }

        const filters = parseOptionalFilters(req.query, {
            day: {},
            q: { maxLength: 100 },
            class: {},
        });
        if (filters.errors.length > 0) {
            return res.status(400).json({ errors: filters.errors });
        }
        const { day, q, class: ticketClass } = filters.values;
        if (day.value && !validDays.has(day.value.toLowerCase())) {
            return res.status(400).json({
                errors: [{ field: "day", message: "day must be a valid weekday." }],
            });
        }

        const filter = {};
        if (day.value) {
            filter.availableDays = {
                $regex: new RegExp(`^${escapeRegExp(day.value)}$`, "i"),
            };
        }
        if (ticketClass.value) {
            filter.class = {
                $regex: `^${escapeRegExp(ticketClass.value)}$`,
                $options: "i",
            };
        }
        if (q.value) {
            const pattern = escapeRegExp(q.value);
            filter.$or = [
                { name: { $regex: pattern, $options: "i" } },
                { description: { $regex: pattern, $options: "i" } },
            ];
        }

        const { ticketClasses, totalItems } = await findPaginatedTicketClasses({
            filter,
            ...options,
        });
        return res.status(200).json(createListResponse({
            data: ticketClasses,
            ...options,
            totalItems,
            query: {
                day: day.value?.toLowerCase(),
                class: ticketClass.value,
                q: q.value,
            },
        }));
    } catch (error) {
        console.error("Error fetching ticket classes:", error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};