import mongoose from "mongoose";

const scheduleSchema = new mongoose.Schema(
    {
        id: {
            type: Number,
            required: true,
            unique: true,
        },
        tripId: {
            type: String,
            required: true,
            trim: true,
        },
        departureTime: {
            type: String,
            required: true,
            trim: true,
        },
        arrivalTime: {
            type: String,
            required: true,
            trim: true,
        },
        daysOfWeek: {
            type: [String],
            required: true,
            enum: [
                "monday",
                "tuesday",
                "wednesday",
                "thursday",
                "friday",
                "saturday",
                "sunday",
            ],
        },
        status: {
            type: Boolean,
            required: true,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

const Schedule = mongoose.model("Schedule", scheduleSchema);

export default Schedule;
