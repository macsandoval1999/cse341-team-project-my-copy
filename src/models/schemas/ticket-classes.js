import mongoose from 'mongoose';

const ticketClassSchema = new mongoose.Schema(
    {
        class: { type: String, required: true },
        name: { type: String, required: true },
        priceMultiplier: { type: Number, required: true },
        amenities: { type: [String], default: [] },
        description: { type: String, required: true },
        availableDays: {
            type: [String],
            enum: [
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday"
            ],
        },
    },
    { collection: "ticket-classes" }
);

const TicketClass = mongoose.model('TicketClass', ticketClassSchema);

export default TicketClass;