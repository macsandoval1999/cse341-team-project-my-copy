import TicketClass from './schemas/ticket-classes.js';

export const getAllTicketClasses = async () => {
    return TicketClass.find();
};

export const getTicketClassesForDay = async (day) => {
    return TicketClass.find({ 
        availableDays: { $regex: new RegExp(`^${day}$`, 'i') }
    }).lean();
};

export const getPaginatedTicketClasses = async ({ filter = {}, page, limit, sort, order }) => {
    const skip = (page - 1) * limit;
    const [ticketClasses, totalItems] = await Promise.all([
        TicketClass.find(filter).sort({ [sort]: order, _id: 1 }).skip(skip).limit(limit).lean(),
        TicketClass.countDocuments(filter),
    ]);

    return { ticketClasses, totalItems };
};