import TicketClass from './schemas/ticket-classes.js';

export const getAllTicketClasses = async () => {
    return TicketClass.find();
};

export const getTicketClassesForDay = async (day) => {
    // Use regex for a case-insensitive match
    return TicketClass.find({ 
        availableDays: { $regex: new RegExp(`^${day}$`, 'i') } 
    });
};