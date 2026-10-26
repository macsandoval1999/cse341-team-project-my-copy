import {
    getAllBookings as findAllBookings,
    getBookingById as findBookingById,
    getBookingsByUserId as findBookingsByUserId,
    getBookingsForUser as findBookingsForUser,
    updateBooking as updateBookingRecord,
    deleteBooking as deleteBookingRecord,
    createBooking as createNewBooking,
    getPaginatedBookings as findPaginatedBookings
} from "../models/bookings.js";
import { getScheduleById as findScheduleById } from "../models/schedules.js";
import {
    getTripById as findTripById,
    getTripAvailability,
} from "../models/trips.js";
import { getAllTicketClasses } from "../models/ticket-classes.js";
import { getUserById as findUserById } from "../models/users.js";
import { generateConfirmationCode } from "../utils/helpers.js";
import {
    createListResponse,
    escapeRegExp,
    parseListQuery,
    parseOptionalFilters,
} from "../utils/list-query.js";

const normalizeString = (value, { lowercase = false } = {}) => {
    if (typeof value !== "string") {
        return "";
    }

    const trimmed = value.trim();
    if (lowercase) {
        return trimmed.toLowerCase();
    }
    return trimmed;
};
const isRequestObject = (value) =>
    value !== null && typeof value === "object" && !Array.isArray(value);
const getUnknownFields = (body, allowedFields) =>
    Object.keys(body).filter((field) => !allowedFields.includes(field));

const getAllBookings = async (req, res) => {
    return getPaginatedBookings(req, res);
};

const getBookingsByUserId = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await findUserById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const result = await getBookingList(req, {
            userId: user._id,
            email: user.email,
        });
        if (result.error) {
            return res.status(400).json({ errors: result.error });
        }
        return res.status(200).json(result.response);
    } catch (error) {
        if (error.name === "CastError") {
            return res.status(400).json({ error: "Invalid user ID" });
        }
        console.error("Error fetching bookings:", error);
        return res.status(500).json({ error: "Failed to fetch bookings" });
    }
};

const isBookingOwner = (booking, user) =>
    booking.userId &&
    String(booking.userId._id ?? booking.userId) === String(user._id);

const canManageBooking = (booking, user) =>
    user?.role?.name === "admin" || isBookingOwner(booking, user);

const createUpgradeQuote = async (booking, targetClassName) => {
    if (typeof targetClassName !== "string" || !targetClassName.trim()) {
        return { error: "A ticket class is required", status: 400 };
    }

    const ticketClasses = await getAllTicketClasses();
    const currentClass = ticketClasses.find(
        (item) => item.class === booking.ticketClass
    );
    const targetClass = ticketClasses.find(
        (item) => item.class === targetClassName.trim()
    );
    if (!currentClass || !targetClass) {
        return { error: "Invalid ticket class", status: 400 };
    }
    if (targetClass.priceMultiplier <= currentClass.priceMultiplier) {
        return {
            error: "Bookings can only be upgraded to a higher ticket class",
            status: 400,
        };
    }

    const availableDays = targetClass.availableDays || [];
    if (
        !availableDays.some(
            (day) => day.toLowerCase() === booking.selectedDay.toLowerCase()
        )
    ) {
        return {
            error: "The selected ticket class is unavailable on this travel day",
            status: 400,
        };
    }

    const trip = await findTripById(booking.tripId);
    if (!trip) {
        return { error: "Trip not found for this booking", status: 404 };
    }

    const seatCount = booking.passengers.length;
    if (seatCount === 0) {
        return { error: "This booking has no seats to upgrade", status: 400 };
    }

    const priceDifferencePerSeat = Math.round(
        trip.distance *
        (targetClass.priceMultiplier - currentClass.priceMultiplier)
    );
    return {
        quote: {
            bookingId: booking.id,
            currentTicketClass: currentClass.class,
            targetTicketClass: targetClass.class,
            seatCount,
            priceDifferencePerSeat,
            totalPriceDifference: priceDifferencePerSeat * seatCount,
            currency: "JPY",
        },
    };
};

const getBookingUpgradeQuote = async (req, res) => {
    try {
        const booking = await findBookingById(req.params.id);
        if (!booking) {
            return res.status(404).json({ error: "Booking not found" });
        }
        if (!canManageBooking(booking, req.user)) {
            return res.status(403).json({ error: "Forbidden" });
        }

        const result = await createUpgradeQuote(booking, req.query.ticketClass);
        if (result.error) {
            return res.status(result.status).json({ error: result.error });
        }
        return res.status(200).json(result.quote);
    } catch (error) {
        console.error("Error calculating booking upgrade:", error);
        return res
            .status(500)
            .json({ error: "Failed to calculate upgrade price" });
    }
};

const validatePassengerUpdates = (passengers, expectedCount) => {
    if (!Array.isArray(passengers) || passengers.length !== expectedCount) {
        return { error: "Passenger count cannot be changed here", status: 400 };
    }

    for (const passenger of passengers) {
        if (!isRequestObject(passenger)) {
            return { error: "Passenger details must be objects", status: 400 };
        }
        const unknownFields = getUnknownFields(passenger, [
            "firstName",
            "lastName",
            "email",
            "phone",
        ]);
        if (unknownFields.length > 0) {
            return {
                error: `Unknown passenger fields: ${unknownFields.join(", ")}`,
                status: 400,
            };
        }
        const invalidFields = ["firstName", "lastName", "email", "phone"].filter(
            (field) =>
                passenger[field] !== undefined &&
                typeof passenger[field] !== "string"
        );
        if (invalidFields.length > 0) {
            return {
                error: `Passenger fields must be strings: ${invalidFields.join(", ")}`,
                status: 400,
            };
        }
    }

    const normalizedPassengers = passengers.map((passenger) => ({
        firstName: normalizeString(passenger?.firstName),
        lastName: normalizeString(passenger?.lastName),
        email: normalizeString(passenger?.email, { lowercase: true }),
        phone: normalizeString(passenger?.phone),
    }));

    const hasInvalidPassenger = normalizedPassengers.some(
        (passenger) =>
            !passenger.firstName ||
            !passenger.lastName ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(passenger.email) ||
            !passenger.phone
    );
    if (hasInvalidPassenger) {
        return { error: "Passenger name, valid email, and phone are required", status: 400 };
    }

    return { passengers: normalizedPassengers };
};

const createBookingApi = async (req, res) => {
    const body = req.body;
    if (!isRequestObject(body)) {
        return res.status(400).json({ error: "Booking details must be an object" });
    }
    const unknownFields = getUnknownFields(body, [
        "scheduleId",
        "tripId",
        "selectedDay",
        "ticketClass",
        "passengers",
    ]);
    if (unknownFields.length > 0) {
        return res.status(400).json({
            error: `Unknown booking fields: ${unknownFields.join(", ")}`,
        });
    }
    const invalidFields = ["tripId", "selectedDay", "ticketClass"].filter(
        (field) => body[field] !== undefined && typeof body[field] !== "string"
    );
    if (invalidFields.length > 0) {
        return res.status(400).json({
            error: `Booking fields must be strings: ${invalidFields.join(", ")}`,
        });
    }
    const scheduleId = body.scheduleId;
    const tripId = normalizeString(body.tripId);
    const selectedDay = normalizeString(body.selectedDay, { lowercase: true });
    const ticketClass = normalizeString(body.ticketClass, { lowercase: true });
    const passengers = body.passengers;

    if (
        !Number.isSafeInteger(scheduleId) ||
        !tripId ||
        !selectedDay ||
        !ticketClass ||
        !Array.isArray(passengers) ||
        passengers.length < 1 ||
        passengers.length > 8
    ) {
        return res.status(400).json({ error: "Invalid booking details" });
    }

    const normalizedPassengers = validatePassengerUpdates(
        passengers,
        passengers.length
    );
    if (normalizedPassengers.error) {
        return res
            .status(normalizedPassengers.status)
            .json({ error: normalizedPassengers.error });
    }

    try {
        const schedule = await findScheduleById(scheduleId);
        if (!schedule) {
            return res.status(404).json({ error: "Schedule not found" });
        }
        if (schedule.status === false) {
            return res.status(409).json({ error: "This schedule is inactive" });
        }
        if (schedule.tripId !== tripId) {
            return res.status(400).json({ error: "Trip does not match the schedule" });
        }
        const trip = await findTripById(tripId);
        if (!trip) {
            return res.status(404).json({ error: "Trip not found" });
        }
        const availability = await getTripAvailability(trip);
        if (!availability.isAvailable) {
            return res.status(409).json({
                error: availability.message,
                availability,
            });
        }
        if (
            !schedule.daysOfWeek.some(
                (day) => day.toLowerCase() === selectedDay
            )
        ) {
            return res.status(400).json({ error: "Schedule is unavailable on the selected day" });
        }

        const ticketClasses = await getAllTicketClasses();
        const selectedClass = ticketClasses.find(
            (item) => item.class === ticketClass
        );
        if (!selectedClass) {
            return res.status(400).json({ error: "Invalid ticket class" });
        }
        if (
            !(selectedClass.availableDays || []).some(
                (day) => day.toLowerCase() === selectedDay
            )
        ) {
            return res.status(400).json({ error: "Ticket class is unavailable on the selected day" });
        }

        const bookingId = generateConfirmationCode();
        await createNewBooking({
            id: bookingId,
            userId: req.user._id,
            scheduleId,
            tripId,
            ticketClass,
            selectedDay,
            passengers: normalizedPassengers.passengers,
        });

        return res.status(201).json({
            message: "Booking created successfully",
            bookingId,
            confirmationUrl: `/trips/confirmation/${bookingId}`,
        });
    } catch (error) {
        if (error.name === "ValidationError" || error.name === "CastError") {
            return res.status(400).json({ error: "Invalid booking details" });
        }
        if (error.code === 11000) {
            return res.status(409).json({ error: "Booking confirmation ID already exists" });
        }
        console.error("Error creating booking:", error);
        return res.status(500).json({ error: "Failed to create booking" });
    }
};

const updateBookingById = async (req, res) => {
    try {
        const { id } = req.params;
        const booking = await findBookingById(id);

        if (!booking) {
            return res.status(404).json({ error: "Booking not found" });
        }

        if (!canManageBooking(booking, req.user)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        if (!isRequestObject(req.body)) {
            return res.status(400).json({ error: "Booking update must be an object" });
        }
        const unknownFields = getUnknownFields(req.body, ["passengers", "ticketClass"]);
        if (unknownFields.length > 0) {
            return res.status(400).json({
                error: `Unknown booking update fields: ${unknownFields.join(", ")}`,
            });
        }
        if (Object.keys(req.body).length !== 1) {
            return res.status(400).json({ error: "Update passenger details or upgrade the booking separately" });
        }

        if (req.body.passengers !== undefined) {
            const result = validatePassengerUpdates(
                req.body.passengers,
                booking.passengers.length
            );
            if (result.error) {
                return res.status(result.status).json({ error: result.error });
            }

            const updated = await updateBookingRecord(id, {
                passengers: result.passengers,
            });
            return res.status(200).json(updated);
        }

        if (typeof req.body.ticketClass !== "string") {
            return res.status(400).json({
                error: "Ticket class must be a string",
            });
        }

        const result = await createUpgradeQuote(booking, req.body.ticketClass);
        if (result.error) {
            return res.status(result.status).json({ error: result.error });
        }

        const updated = await updateBookingRecord(id, {
            ticketClass: result.quote.targetTicketClass,
        });
        return res.status(200).json(updated);
    } catch (error) {
        console.error("Error updating booking:", error);
        return res.status(500).json({ error: "Failed to update booking" });
    }
};

const deleteBookingById = async (req, res) => {
    try {
        const { id } = req.params;
        const booking = await findBookingById(id);

        if (!booking) {
            return res.status(404).json({ error: "Booking not found" });
        }

        if (!canManageBooking(booking, req.user)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        await deleteBookingRecord(id);
        return res.status(200).json({ message: "Booking deleted" });
    } catch (error) {
        console.error("Error deleting booking:", error);
        return res.status(500).json({ error: "Failed to delete booking" });
    }
};

const getBookingById = async (req, res) => {
    try {
        const booking = await findBookingById(req.params.id);
        if (!booking) {
            return res.status(404).json({ error: "Booking not found" });
        }

        if (!canManageBooking(booking, req.user)) {
            return res.status(403).json({ error: "Forbidden" });
        }

        return res.status(200).json(booking);
    } catch (error) {
        console.error("Error fetching booking:", error);
        return res.status(500).json({ error: "Failed to fetch booking" });
    }
};

const processBookingRequest = async (req, res) => {
    try {
        const scheduleId = Number(req.body.scheduleId);
        if (!Number.isSafeInteger(scheduleId)) {
            return res.status(400).send("Invalid schedule ID.");
        }

        const schedule = await findScheduleById(scheduleId);
        if (!schedule) {
            return res.status(404).render("errors/404", {
                title: "Schedule Not Found",
                error: "The requested schedule could not be found.",
            });
        }
        if (schedule.status === false) {
            return res.redirect(`/trips/${encodeURIComponent(schedule.tripId)}`);
        }

        const trip = await findTripById(schedule.tripId);
        if (!trip) {
            return res.status(404).render("errors/404", {
                title: "Trip Not Found",
                error: "The trip for this schedule could not be found.",
            });
        }
        if (req.body.tripId !== schedule.tripId) {
            return res.status(400).send("The selected trip does not match the schedule.");
        }
        const availability = await getTripAvailability(trip);
        if (!availability.isAvailable) {
            return res.redirect(`/trips/${encodeURIComponent(trip.id)}`);
        }

        let passengers = [];
        if (Array.isArray(req.body.passengers)) {
            passengers = req.body.passengers;
        } else {
            passengers = Object.values(req.body.passengers || {});
        }
        const booking = {
            id: generateConfirmationCode(),
            scheduleId,
            tripId: req.body.tripId,
            ticketClass: req.body.ticketClass,
            selectedDay: req.body.selectedDay,
            passengers,
        };
        if (req.user) {
            booking.userId = req.user._id;
        }

        await createNewBooking(booking);
        return res.redirect(`/trips/confirmation/${booking.id}`);
    } catch (error) {
        console.error("Error creating booking:", error);
        return res.status(500).render("errors/500", {
            title: "Server Error",
            error: "An error occurred while processing the booking.",
            stack: error.stack,
        });
    }
};

const bookingPage = async (req, res) => {
    const { scheduleId } = req.params;

    const schedule = await findScheduleById(Number(scheduleId));

    if (!schedule) {
        return res.status(404).render("errors/404", {
            title: "Schedule Not Found",
            error: "The requested schedule could not be found.",
        });
    }
    if (schedule.status === false) {
        return res.redirect(`/trips/${encodeURIComponent(schedule.tripId)}`);
    }

    const trip = await findTripById(schedule.tripId);
    if (!trip) {
        return res.status(404).render("errors/404", {
            title: "Trip Not Found",
            error: "The trip for this schedule could not be found.",
        });
    }
    const availability = await getTripAvailability(trip);
    if (!availability.isAvailable) {
        return res.redirect(`/trips/${encodeURIComponent(trip.id)}`);
    }

    const ticketClasses = await getAllTicketClasses();
    const ticketOptions = ticketClasses.map((ticketClass) => ({
        class: ticketClass.class,
        name: ticketClass.name,
        price: trip.distance * ticketClass.priceMultiplier,
        amenities: ticketClass.amenities,
        description: ticketClass.description,
    }));

    return res.render("trips/book", {
        title: "Book Trip",
        schedule,
        ticketOptions,
    });
};

const bookingsPage = (req, res, { personal = false } = {}) => {
    let title = "Manage Bookings";
    let bookingsScope = "all";
    if (personal) {
        title = "Your Bookings";
        bookingsScope = "mine";
    }
    res.render("bookings", {
        title,
        isAdmin: res.locals.isAdmin,
        currentUserId: String(req.user._id),
        currentUserEmail: req.user.email,
        bookingsScope,
    });
};

const confirmationPage = async (req, res) => {
    const { bookingId } = req.params;

    const confirmation = await findBookingById(bookingId);

    if (!confirmation) {
        return res.status(404).render("errors/404", {
            title: "Booking Not Found",
            error: "The requested booking could not be found.",
        });
    }

    return res.render("trips/confirm", {
        title: "Trip Confirmation",
        confirmation,
    });
};

const bookingSortFields = [
    "createdAt",
    "selectedDay",
    "ticketClass",
    "tripId",
    "scheduleId",
    "id",
];

const parseBookingDate = (value, field) => {
    if (value === undefined) {
        return { value: undefined };
    }
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return { error: `${field} must be a valid date in YYYY-MM-DD format.` };
    }
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
        return { error: `${field} must be a valid date in YYYY-MM-DD format.` };
    }
    return { value: parsed };
};

const getBookingList = async (req, { userId, email } = {}) => {
    const options = parseListQuery(req.query, bookingSortFields, "createdAt");
    if (options.errors.length > 0) {
        return { error: options.errors };
    }

    const filters = parseOptionalFilters(req.query, {
        q: { maxLength: 100 },
        ticketClass: {},
        tripId: {},
    });
    const { q: search, ticketClass, tripId } = filters.values;
    const startDate = parseBookingDate(req.query.startDate, "startDate");
    const endDate = parseBookingDate(req.query.endDate, "endDate");
    const filterErrors = [...filters.errors];
    if (startDate.error) {
        filterErrors.push({ field: "startDate", message: startDate.error });
    }
    if (endDate.error) {
        filterErrors.push({ field: "endDate", message: endDate.error });
    }
    if (filterErrors.length > 0) {
        return {
            error: filterErrors,
        };
    }
    if (startDate.value && endDate.value && endDate.value < startDate.value) {
        return {
            error: [{
                field: "dateRange",
                message: "endDate cannot be earlier than startDate.",
            }],
        };
    }

    const filter = {};
    const appliedQuery = {};
    let user = req.user;
    if (userId) {
        user = { _id: userId, email };
    }
    let requestedScope = "all";
    if (req.query.scope !== undefined) {
        requestedScope = req.query.scope;
    }
    if (!["all", "mine"].includes(requestedScope)) {
        return {
            error: [{ field: "scope", message: "scope must be all or mine." }],
        };
    }
    let scope = "mine";
    if (user?.role?.name === "admin" && !userId) {
        scope = requestedScope;
    }
    if (scope === "mine") {
        const escapedEmail = escapeRegExp(user.email);
        filter.$or = [
            { userId: user._id },
            { "passengers.email": { $regex: `^${escapedEmail}$`, $options: "i" } },
        ];
        appliedQuery.scope = "mine";
    } else {
        appliedQuery.scope = "all";
    }

    if (search.value) {
        const pattern = escapeRegExp(search.value);
        const searchFilters = [];
        if (filter.$or) {
            searchFilters.push({ $or: filter.$or });
        }
        searchFilters.push({
            $or: [
                { id: { $regex: pattern, $options: "i" } },
                { tripId: { $regex: pattern, $options: "i" } },
                { "passengers.firstName": { $regex: pattern, $options: "i" } },
                { "passengers.lastName": { $regex: pattern, $options: "i" } },
                { "passengers.email": { $regex: pattern, $options: "i" } },
            ],
        });
        filter.$and = searchFilters;
        delete filter.$or;
        appliedQuery.q = search.value;
    }
    if (ticketClass.value) {
        filter.ticketClass = { $regex: `^${escapeRegExp(ticketClass.value)}$`, $options: "i" };
        appliedQuery.ticketClass = ticketClass.value;
    }
    if (tripId.value) {
        filter.tripId = { $regex: `^${escapeRegExp(tripId.value)}$`, $options: "i" };
        appliedQuery.tripId = tripId.value;
    }
    if (startDate.value || endDate.value) {
        filter.createdAt = {};
        if (startDate.value) {
            filter.createdAt.$gte = startDate.value;
            appliedQuery.startDate = req.query.startDate;
        }
        if (endDate.value) {
            const exclusiveEnd = new Date(endDate.value);
            exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
            filter.createdAt.$lt = exclusiveEnd;
            appliedQuery.endDate = req.query.endDate;
        }
    }

    const { page, limit, sort, order, orderName } = options;
    const { bookings, totalItems } = await findPaginatedBookings({
        filter,
        page,
        limit,
        sort,
        order,
    });
    const response = createListResponse({
        data: bookings,
        page,
        limit,
        totalItems,
        query: appliedQuery,
        sort,
        order,
    });

    return {
        response: {
            ...response,
            bookings,
            total: totalItems,
            filter: appliedQuery,
            order: orderName,
        },
    };
};

const getPaginatedBookings = async (req, res) => {
    try {
        const result = await getBookingList(req);
        if (result.error) {
            return res.status(400).json({ errors: result.error });
        }
        return res.status(200).json(result.response);
    } catch (error) {
        console.error("Error fetching paginated bookings:", error);
        return res.status(500).json({ error: "Failed to fetch paginated bookings" });
    }
};

export {
    getAllBookings,
    createBookingApi,
    getBookingsByUserId,
    getBookingById,
    getBookingUpgradeQuote,
    updateBookingById,
    deleteBookingById,
    processBookingRequest,
    bookingPage,
    bookingsPage,
    getPaginatedBookings, confirmationPage
};
