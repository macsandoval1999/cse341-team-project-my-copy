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
import { getTripById as findTripById } from "../models/trips.js";
import { getAllTicketClasses } from "../models/ticket-classes.js";
import { getUserById as findUserById } from "../models/users.js";
import { generateConfirmationCode } from "../includes/helpers.js";

const getAllBookings = async (req, res) => {
    try {
        const isAdmin = req.user?.role?.name === "admin";
        const bookings = isAdmin
            ? await findAllBookings()
            : await findBookingsForUser(req.user._id, req.user.email);

        return res.status(200).json(bookings);
    } catch (error) {
        console.error("Error fetching bookings:", error);
        return res.status(500).json({ error: "Failed to fetch Bookings" });
    }
};

const getBookingsByUserId = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await findUserById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const bookings = await findBookingsForUser(user._id, user.email);
        if (bookings.length === 0) {
            return res.status(404).json({ error: "User has no bookings" });
        }

        return res.status(200).json(bookings);
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

    const normalizedPassengers = passengers.map((passenger) => ({
        firstName:
            typeof passenger?.firstName === "string"
                ? passenger.firstName.trim()
                : "",
        lastName:
            typeof passenger?.lastName === "string"
                ? passenger.lastName.trim()
                : "",
        email:
            typeof passenger?.email === "string"
                ? passenger.email.trim().toLowerCase()
                : "",
        phone: typeof passenger?.phone === "string" ? passenger.phone.trim() : "",
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
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const scheduleId = body.scheduleId;
    const tripId = typeof body.tripId === "string" ? body.tripId.trim() : "";
    const selectedDay =
        typeof body.selectedDay === "string"
            ? body.selectedDay.trim().toLowerCase()
            : "";
    const ticketClass =
        typeof body.ticketClass === "string"
            ? body.ticketClass.trim().toLowerCase()
            : "";
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
        if (schedule.tripId !== tripId) {
            return res.status(400).json({ error: "Trip does not match the schedule" });
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

        const hasPassengerUpdate = req.body.passengers !== undefined;
        const hasUpgradeUpdate =
            req.body.ticketClass !== undefined || req.body.selectedDay !== undefined;
        if (hasPassengerUpdate && hasUpgradeUpdate) {
            return res.status(400).json({ error: "Update passenger details or upgrade the booking separately" });
        }

        if (hasPassengerUpdate) {
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

        if (req.body.selectedDay !== undefined) {
            return res
                .status(400)
                .json({ error: "Only ticket upgrades are supported" });
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
    const passengers = Array.isArray(req.body.passengers)
        ? req.body.passengers
        : Object.values(req.body.passengers || {});
    const booking = {
        id: generateConfirmationCode(),
        scheduleId: Number(req.body.scheduleId),
        tripId: req.body.tripId,
        ticketClass: req.body.ticketClass,
        selectedDay: req.body.selectedDay,
        passengers,
        ...(req.user ? { userId: req.user._id } : {}),
    };

    try {
        await createNewBooking(booking);
        return res.redirect(`/trips/confirmation/${booking.id}`);
    } catch (error) {
        console.error("Error creating booking:", error);
        return res.status(500).render("errors/500", {
            title: "Server Error",
            error: error.message,
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

    const trip = await findTripById(schedule.tripId);
    if (!trip) {
        return res.status(404).render("errors/404", {
            title: "Trip Not Found",
            error: "The trip for this schedule could not be found.",
        });
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
    res.render("bookings", {
        title: personal ? "Your Bookings" : "Manage Bookings",
        isAdmin: res.locals.isAdmin,
        currentUserId: String(req.user._id),
        currentUserEmail: req.user.email,
        bookingsScope: personal ? "mine" : "all",
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

//Update: Added getPaginatedBookings function to fetch bookings with pagination, sorting, and ordering.

const parsePositiveInteger = (value, defaultValue) => {
    if (value === undefined) {
        return defaultValue;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
        return null;
    }

    return parsed;
};


const getPaginatedBookings = async (req, res) => {

    const page = parsePositiveInteger(req.query.page, 1);
    const limit = parsePositiveInteger(req.query.limit, 10);
    if (!page || !limit || limit > 50) {
        return res.status(400).json({
            errors: [{ field: 'pagination', message: 'page and limit must be valid positive numbers. Maximum limit is 50.' }]
        });
    }

    const allowedSortFields = ['createdAt', 'selectedDay', 'ticketClass', 'tripId', 'scheduleId'];
    if (req.query.sort && !allowedSortFields.includes(req.query.sort)) {
        return res.status(400).json({
            errors: [{ field: 'sort', message: 'sort is not supported.' }]
        });
    }
    const sort = req.query.sort || 'createdAt';
    const order = req.query.order || 'asc';

    console.log(`Fetching bookings with pagination: page=${page}, limit=${limit}, sort=${sort}, order=${order}`);

    const filter = {};
    const isAdmin = req.user?.role?.name === "admin";
    const requestedScope = req.query.scope || "all";
    if (!["all", "mine"].includes(requestedScope)) {
        return res.status(400).json({
            errors: [{ field: "scope", message: "scope must be all or mine." }],
        });
    }
    const scope = isAdmin ? requestedScope : "mine";

    if (scope === "mine") {
        const escapedEmail = req.user.email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        filter.$or = [
            { userId: req.user._id },
            {
                "passengers.email": {
                    $regex: `^${escapedEmail}$`,
                    $options: "i",
                },
            },
        ];
    }

    const ticketClass = req.query.ticketClass || '';
    const startDate = req.query.startDate || '';
    const endDate = req.query.endDate || '';

    if (ticketClass != '') {
        filter.ticketClass = ticketClass;
    }

    // figure out how to check they aren;t overlapping and be able to create a filter for the date ranges independently
    // if (startDate != '' && endDate != '') {
    //     const start = new Date(startDate);
    //     const end = new Date(endDate);
    //     console.log(`Filtering bookings from ${start} to ${end}`);
    //     if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    //         return res.status(400).json({
    //             errors: [{ field: 'dateRange', message: 'startDate and endDate must be valid dates.' }]
    //         });
    //     }
    //     filter.createdAt.$gte = start.toISOString();
    //     filter.createdAt.$lte= end.toISOString();
    // }
    if(endDate !='' && startDate != '' && endDate < startDate){
        return res.status(400).json({
            errors: [{ field: 'dateRange', message: 'endDate cannot be earlier than startDate.' }]
        });
    }
    if (startDate != '') {
        console.log("valid start date provided, checking if it's a valid date...");
        const start = new Date(`${startDate}T23:59:59.999Z`);
        if (isNaN(start.getTime())) {
            return res.status(400).json({
                errors: [{ field: 'startDate', message: 'startDate must be a valid date.' }]
            });
        }
        filter.createdAt = filter.createdAt || {}
        filter.createdAt.$gte = start;
    }
    if (endDate != '') {
        console.log("valid end date provided, checking if it's a valid date...");
        const end = new Date(`${endDate}T23:59:59.999Z`);
        if (isNaN(end.getTime())) {
            return res.status(400).json({
                errors: [{ field: 'endDate', message: 'endDate must be a valid date.' }]
            });
        }
        filter.createdAt = filter.createdAt || {}
        filter.createdAt.$lte = end;
    }
    


    console.log(`Filter applied: ${JSON.stringify(filter)}`);

    try {
        const bookingsData = await findPaginatedBookings({
            filter: filter,
            page: parseInt(page),
            limit: parseInt(limit),
            sort,
            order
        });
        return res.status(200).json(bookingsData);
    } catch (error) {
        console.error("Error fetching paginated bookings:", error);
        return res.status(500).json({ error: "Failed to fetch paginated bookings" });
    }

}

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
