import Booking from "./schemas/bookings.js";

export async function getAllBookings() {
    // console.log(Booking);
    // await mongoose.connect(process.env.MONGODB_URI+"/"+process.env.MONGODB_DB_NAME);
    // console.log("Currently connected to DB:", mongoose.connection.name);
    return Booking.find().populate("userId", "name email");
}

export async function getBookingById(id) {
    // await mongoose.connect(process.env.MONGODB_URI+"/"+process.env.MONGODB_DB_NAME);
    return Booking.findOne({ id });
}

export async function getBookingsByUserId(userId) {
    return Booking.find({ userId }).populate("userId", "name email");
}

export async function getBookingsForUser(userId, email) {
    const escapedEmail = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return Booking.find({
        $or: [
            { userId },
            {
                "passengers.email": {
                    $regex: `^${escapedEmail}$`,
                    $options: "i",
                },
            },
        ],
    }).populate("userId", "name email");
}

export async function deleteBookingsByUserId(userId) {
    return Booking.deleteMany({ userId });
}

export async function createBooking(bookingData) {
    // await mongoose.connect(process.env.MONGODB_URI+"/"+process.env.MONGODB_DB_NAME);
    return Booking.create(bookingData);
}

export async function getBookingsByPassengerEmail(email) {
    return Booking.find({ "passengers.email": email });
}

export async function updateBooking(id, updates) {
    return Booking.findOneAndUpdate({ id }, updates, { new: true });
}

export async function deleteBooking(id) {
    return Booking.findOneAndDelete({ id });
}

export async function getPaginatedBookings({ filter = {}, page, limit, sort, order }) {
    const skip = (page - 1) * limit;
    const sortOrder = order === 'desc' ? -1 : 1;
    const sortOptions = {[sort]: sortOrder};

    const bookings = await Booking.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit);
    const totalBookings = await Booking.countDocuments(filter);

    return {
        bookings,
        total: totalBookings,
        page,
        limit,
        filter
    };

}