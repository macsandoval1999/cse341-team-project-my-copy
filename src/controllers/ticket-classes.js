import {
    getAllTicketClasses as findAllTicketClasses,
    getTicketClassesForDay as findTicketClassesForDay
} from '../models/ticket-classes.js';

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
        const ticketClasses = await findAllTicketClasses();
        return res.status(200).json(ticketClasses);
    } catch (error) {
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const getTicketClassesForDay = async (req, res) => {
    try {
        const { day } = req.query;
        if (!day) {
            return res.status(400).json({ error: 'Day query parameter is required' });
        }

        if (!validDays.has(day.trim().toLowerCase())) {
            return res.status(400).json({
                error: 'Day must be a valid weekday, such as Monday',
            });
        }

        const ticketClasses = await findTicketClassesForDay(day);

        if (ticketClasses.length === 0) {
            return res.status(404).json({
                error: 'No ticket classes are available for that day',
            });
        }

        return res.status(200).json(ticketClasses);
    } catch (error) {
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};