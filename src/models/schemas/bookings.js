//src/models/schemas/trains.js.
import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
    {
        id: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: false,
        },
        passengers: [
            {
                firstName: {
                    type: String,
                    required: true,
                    trim: true,
                },
                lastName: {
                    type: String,
                    required: true,
                    trim: true,
                },
                email: {
                    type: String,
                    required: true,
                    trim: true,
                },
                phone: {
                    type: String,
                    required: true,
                    trim: true,
                },
            },
        ],
        scheduleId: {
            type: Number,
            required: true,
        },
        tripId: {
            type: String,
            required: true,
            trim: true,
        },
        ticketClass: {
            type: String,
            required: true,
            trim: true,
        },
        selectedDay: {
            type: String,
            required: true,
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;