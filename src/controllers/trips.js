import {
    getTripById as findTripById,
    createTrip as insertTrip,
    addTripAvailability,
    getTripAvailability,
    getTrainIds,
    getTripsWithActiveSchedules,
    getTripsWithSchedules,
    getTripFilters,
    getPaginatedTrips as findPaginatedTrips,
    updateTrip as changeTrip,
    deleteTrip as removeTrip
} from "../models/trips.js";
import Station from "../models/schemas/stations.js";
import Schedule from "../models/schemas/schedules.js";
import Booking from "../models/schemas/bookings.js";
import { getTrainById as findTrainById } from "../models/trains.js";
import {
    createListResponse,
    escapeRegExp,
    parseListQuery,
    parseOptionalFilters,
} from "../utils/list-query.js";

const allowedSortFields = ['name', 'region', 'startStation', 'endStation', 'distance', 'bestSeason'];
const MAX_SEARCH_LENGTH = 100;

export async function createTrip(req, res) {
    try {
        const allowedFields = [
            "id",
            "name",
            "description",
            "startStation",
            "endStation",
            "distance",
            "trainId",
            "region",
            "duration",
            "bestSeason",
            "operatingMonths",
            "highlights",
            "imageUrl",
            "schedules",
        ];
        const unknownFields = Object.keys(req.body).filter(
            (field) => !allowedFields.includes(field)
        );
        if (unknownFields.length > 0) {
            return res.status(400).json({ error: "Unsupported trip fields" });
        }

        const tripData = req.body;
        const requiredStringFields = [
            "id",
            "name",
            "description",
            "startStation",
            "endStation",
            "trainId",
            "duration",
        ];
        for (const field of requiredStringFields) {
            if (typeof tripData[field] !== "string" || !tripData[field].trim()) {
                return res.status(400).json({
                    error: `${field} must be a non-empty string`,
                });
            }
            tripData[field] = tripData[field].trim();
        }
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tripData.id)) {
            return res.status(400).json({
                error: "id must use lowercase letters, numbers, and single hyphens",
            });
        }
        if (typeof tripData.distance !== "number" ||
            !Number.isFinite(tripData.distance) ||
            tripData.distance < 0) {
            return res.status(400).json({
                error: "Distance must be a non-negative number",
            });
        }
        for (const field of ["region", "bestSeason", "imageUrl"]) {
            if (field in tripData &&
                (typeof tripData[field] !== "string" ||
                    (field !== "imageUrl" && !tripData[field].trim()))) {
                return res.status(400).json({
                    error: `${field} must be a non-empty string`,
                });
            }
            if (field in tripData) tripData[field] = tripData[field].trim();
        }
        if ("operatingMonths" in tripData &&
            (!Array.isArray(tripData.operatingMonths) ||
                tripData.operatingMonths.some((month) =>
                    !Number.isInteger(month) || month < 1 || month > 12
                ))) {
            return res.status(400).json({
                error: "Operating months must be an array of integers from 1 through 12",
            });
        }
        if ("highlights" in tripData &&
            (!Array.isArray(tripData.highlights) ||
                tripData.highlights.some((highlight) =>
                    typeof highlight !== "string" || !highlight.trim()
                ))) {
            return res.status(400).json({
                error: "Highlights must be an array of non-empty strings",
            });
        }
        if (
            !Array.isArray(tripData.schedules) ||
            tripData.schedules.length === 0 ||
            tripData.schedules.some((schedule) =>
                !schedule ||
                typeof schedule.departureTime !== "string" ||
                !/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.departureTime) ||
                typeof schedule.arrivalTime !== "string" ||
                !/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.arrivalTime) ||
                !Array.isArray(schedule.daysOfWeek) ||
                schedule.daysOfWeek.length === 0 ||
                schedule.daysOfWeek.some((day) =>
                    typeof day !== "string" ||
                    ![
                        "monday",
                        "tuesday",
                        "wednesday",
                        "thursday",
                        "friday",
                        "saturday",
                        "sunday",
                    ].includes(day.toLowerCase())
                ) ||
                new Set(schedule.daysOfWeek.map((day) => day.toLowerCase())).size !==
                    schedule.daysOfWeek.length
            )
        ) {
            return res.status(400).json({
                error: "At least one schedule with valid times and operating days is required",
            });
        }
        const initialSchedules = tripData.schedules.map((schedule) => ({
            departureTime: schedule.departureTime,
            arrivalTime: schedule.arrivalTime,
            daysOfWeek: schedule.daysOfWeek.map((day) => day.toLowerCase()),
            status: true,
        }));
        delete tripData.schedules;
        const [existingTrip, train, startStation, endStation] = await Promise.all([
            findTripById(tripData.id),
            findTrainById(tripData.trainId),
            Station.findOne({ $or: [{ name: tripData.startStation }, { id: tripData.startStation }] }),
            Station.findOne({ $or: [{ name: tripData.endStation }, { id: tripData.endStation }] }),
        ]);
        if (existingTrip) {
            return res.status(409).json({ error: `Trip '${tripData.id}' already exists` });
        }
        if (!train) {
            return res.status(400).json({ error: `Train '${tripData.trainId}' does not exist` });
        }
        if (!startStation) {
            return res.status(400).json({
                error: `Start Station '${tripData.startStation}' does not exist`,
            });
        }
        if (!endStation) {
            return res.status(400).json({
                error: `End Station '${tripData.endStation}' does not exist`,
            });
        }

        const trip = await insertTrip(tripData);
        try {
            const latestSchedule = await Schedule.findOne({})
                .sort({ id: -1 })
                .select("id")
                .lean();
            let nextScheduleId = latestSchedule?.id ?? 0;
            await Schedule.insertMany(
                initialSchedules.map((schedule) => ({
                    ...schedule,
                    id: ++nextScheduleId,
                    tripId: tripData.id,
                }))
            );
        } catch (scheduleError) {
            await Schedule.deleteMany({ tripId: tripData.id });
            await Trip.deleteOne({ id: tripData.id });
            if (scheduleError.code === 11000) {
                return res.status(409).json({
                    error: "Schedule creation conflicted with another request. Please try again.",
                });
            }
            if (
                scheduleError.name === "ValidationError" ||
                scheduleError.name === "CastError"
            ) {
                return res.status(400).json({
                    error: "Invalid schedule information; the trip was not created.",
                });
            }
            console.error("Error creating initial trip schedules:", scheduleError);
            return res.status(500).json({
                error: "The trip was not created because its schedules could not be saved.",
            });
        }

        return res.status(201).json({
            ...trip,
            availability: await getTripAvailability(trip),
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: "A trip with this ID already exists" });
        }
        if (error.name === "ValidationError" || error.name === "CastError") {
            return res.status(400).json({ error: "Invalid trip information" });
        }
        console.error("Error creating trip:", error);
        return res.status(500).json({ error: "Failed to create trip" });
    }
}

//returns one page of trips (optionally filtered by region/season/search); 200 on success, 400 for bad query values, 500 for unexpected errors
export async function getPaginatedTripsList(req, res) {
    try {
        const options = parseListQuery(req.query, allowedSortFields, "name");
        if (options.errors.length > 0) {
            return res.status(400).json({
                errors: options.errors,
            });
        }
        const { page, limit, sort, order } = options;
        const parsedFilters = parseOptionalFilters(req.query, {
            region: {},
            season: {},
            search: { maxLength: MAX_SEARCH_LENGTH },
            availability: {},
            scheduleStatus: {},
        });
        if (parsedFilters.errors.length > 0) {
            return res.status(400).json({ errors: parsedFilters.errors });
        }
        const {
            region: regionFilter,
            season: seasonFilter,
            search: searchFilter,
            availability: availabilityFilter,
            scheduleStatus: scheduleStatusFilter,
        } = parsedFilters.values;
        let region = regionFilter.value;
        if (region && region.toLowerCase() === "all") {
            region = undefined;
        }
        let season = seasonFilter.value;
        if (season && season.toLowerCase() === "all") {
            season = undefined;
        }
        const search = searchFilter.value;
        let availability = availabilityFilter.value;
        if (!availability) {
            availability = "all";
        } else {
            availability = availability.toLowerCase();
        }
        if (!["all", "available", "unavailable"].includes(availability)) {
            return res.status(400).json({
                errors: [{
                    field: "availability",
                    message: "availability must be available, unavailable, or all.",
                }],
            });
        }

        const filter = {};
        const andFilters = [];
        if (region) {
            filter.region = { $regex: `^${escapeRegExp(region)}$`, $options: 'i' };
        }
        if (season) {
            filter.bestSeason = { $regex: `^${escapeRegExp(season)}$`, $options: 'i' };
        }
        if (search) {
            const pattern = escapeRegExp(search);
            andFilters.push({ $or: [
                { name: { $regex: pattern, $options: 'i' } },
                { description: { $regex: pattern, $options: 'i' } },
            ] });
        }
        let scheduleStatus = scheduleStatusFilter.value;
        if (!scheduleStatus) {
            scheduleStatus = "all";
        } else {
            scheduleStatus = scheduleStatus.toLowerCase();
        }
        if (!["all", "configured", "missing", "none"].includes(scheduleStatus)) {
            return res.status(400).json({
                errors: [{
                    field: "scheduleStatus",
                    message: "scheduleStatus must be all, configured, missing, or none.",
                }],
            });
        }
        if (availability !== "all" || scheduleStatus !== "all") {
            const [trainIds, scheduledTripIds] = await Promise.all([
                getTrainIds(),
                getTripsWithActiveSchedules(),
            ]);
            let tripsWithSchedules = [];
            if (scheduleStatus === "none") {
                tripsWithSchedules = await getTripsWithSchedules();
            }
            if (availability === "available") {
                filter.trainId = { $in: trainIds };
                andFilters.push({ id: { $in: scheduledTripIds } });
            } else if (availability === "unavailable") {
                andFilters.push({ $or: [
                    { trainId: { $nin: trainIds } },
                    { id: { $nin: scheduledTripIds } },
                ] });
            }
            if (scheduleStatus === "configured") {
                andFilters.push({ id: { $in: scheduledTripIds } });
            } else if (scheduleStatus === "missing") {
                andFilters.push({ id: { $nin: scheduledTripIds } });
            } else if (scheduleStatus === "none") {
                andFilters.push({ id: { $nin: tripsWithSchedules } });
            }
        }
        if (andFilters.length > 0) filter.$and = andFilters;

        const { trips, totalItems } = await findPaginatedTrips({
            filter,
            page,
            limit,
            sort,
            order
        });
        const tripsWithAvailability = await addTripAvailability(trips);

        const filters = {
                region: region || null,
                season: season || null,
                search: search || null,
                availability,
                scheduleStatus,
            };
        return res.status(200).json({
            ...createListResponse({
                data: tripsWithAvailability,
                page,
                limit,
                totalItems,
                sort,
                order,
                query: filters,
            }),
            filters,
        });
    } catch (error) {
        console.error("Error fetching Trips:", error);

        return res.status(500).json({ message: "Failed to fetch Trips" });
    }
}

/* get a trip by id function needs to connect with db and return a status 200 for success, 
a ststus 404 for not found id and a status 500 for unexpected error with a safe 
message to user
*/

export async function getTripById(req, res){
    try{
        const {id} = req.params;

        const trip = await findTripById(id);

        if(!trip){
            return res.status(404).json({message: "Trip not found"});
        }

        const availability = await getTripAvailability(trip);
        return res.status(200).json({ ...trip, availability });


    }catch(error){
        console.error("Error fetching trip:", error);

        return res.status(500).json({message:"Failed to fetch trip"});
    }
};

export async function getTripDetails (req, res) {
    const {tripId} = req.params;

    try{
        const details = await findTripById(tripId);

        if(!details){
            return res.status(404).render("errors/404", {
                title: "trip not found",
                error: `Trip ${tripId} was not found`
            });
        }

        const train = await findTrainById(details.trainId);
        if (!train && details.trainId) {
            console.warn(`Trip ${tripId} references missing train ${details.trainId}`);
        }
        const availability = await getTripAvailability(details);

        return res.render("trips/details", {
            title: "Trip Details",
            details,
            train,
            availability,
        });

    }catch(error){
        return res.status(500).render("errors/500", {
            title: "Server Error",
            error: "An error occurred while fetching trip details"
        });
    }
};

export async function getTripsList(req, res) {
    try{
        const { regions, seasons } = await getTripFilters();

        res.render("trips/list", {
            title:"Scenic Train Trips",
            regions,
            seasons,
            query: req.query || {}
            
        });
    }catch(error) {
        console.error("Error setting up trips to list page:", error);
        res.status(500).render("errors/500", {
            title: "Server Error",
            error: "Failed to load the page layout"
        });
    }
}


// Trip updates modify trip fields only; schedule ownership is managed separately.
export async function updateTrip (req, res) {
    try{
        const {id} = req.params;
        const requestedUpdates = req.body;
        const allowedFields = [
            "name",
            "description",
            "startStation",
            "endStation",
            "distance",
            "trainId",
            "region",
            "duration",
            "bestSeason",
            "operatingMonths",
            "highlights",
            "imageUrl",
        ];
        const unknownFields = Object.keys(requestedUpdates).filter(
            (field) => !allowedFields.includes(field)
        );

        if (unknownFields.length > 0) {
            return res.status(400).json({ error: "Unsupported trip fields" });
        }

        const updateData = Object.fromEntries(
            Object.entries(requestedUpdates).filter(([field]) => allowedFields.includes(field))
        );

        const stringFields = [
            "name",
            "description",
            "startStation",
            "endStation",
            "trainId",
            "region",
            "duration",
            "bestSeason",
            "imageUrl",
        ];
        const invalidStringField = stringFields.find((field) =>
            field in updateData &&
            (typeof updateData[field] !== "string" ||
                (field !== "imageUrl" && !updateData[field].trim()))
        );
        if (invalidStringField) {
            return res.status(400).json({
                error: `${invalidStringField} must be a non-empty string`,
            });
        }
        if ("distance" in updateData &&
            (typeof updateData.distance !== "number" ||
                !Number.isFinite(updateData.distance) ||
                updateData.distance < 0)) {
            return res.status(400).json({ error: "Distance must be a non-negative number" });
        }
        if ("operatingMonths" in updateData &&
            (!Array.isArray(updateData.operatingMonths) ||
                updateData.operatingMonths.some((month) =>
                    !Number.isInteger(month) || month < 1 || month > 12
                ))) {
            return res.status(400).json({
                error: "Operating months must be an array of integers from 1 through 12",
            });
        }
        if ("highlights" in updateData &&
            (!Array.isArray(updateData.highlights) ||
                updateData.highlights.some((highlight) =>
                    typeof highlight !== "string" || !highlight.trim()
                ))) {
            return res.status(400).json({ error: "Highlights must be an array of non-empty strings" });
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: "No trip changes provided" });
        }

        const trip = await findTripById(id);
        if (!trip) {
            return res.status(404).json({ error: `Trip with id '${id}' was not found` });
        }

        //Make sure station does exist
        if(updateData.startStation || updateData.endStation){
            if(updateData.startStation){
                const startExist = await Station.findOne({
                    $or: [
                        { name: updateData.startStation },
                        { id: updateData.startStation },
                    ],
                });
                if(!startExist){
                    return res.status(400).json({error:`Start Station '${updateData.startStation}' does not exist`});
                }
            }

            if(updateData.endStation){
                const endExist = await Station.findOne({
                    $or: [
                        { name: updateData.endStation },
                        { id: updateData.endStation },
                    ],
                });
                if(!endExist){
                    return res.status(400).json({error:`End Station '${updateData.endStation}' does not exist`});
                }
            }
            
        }

        const result = await changeTrip(id, updateData);
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: `Trip with id '${id}' was not found` });
        }

        return res.status(200).json({
            message: "Trip updated successfully",
            wasModified: result.modifiedCount > 0,
        });

    }catch(error){
        if (error.name === "ValidationError" || error.name === "CastError") {
            return res.status(400).json({ error: "Invalid trip information" });
        }
        console.error("Error updating trip:", error);
        return res.status(500).json({message: 'Internal server error'});
    }
}

export async function deleteTrip(req, res) {
    try {

        const { id } = req.params;

        const schedules = await Schedule.find({ tripId: id }).select("id").lean();
        const scheduleIds = schedules.map((schedule) => schedule.id);
        const bookingReferences = [{ tripId: id }];
        if (scheduleIds.length > 0) {
            bookingReferences.push({ scheduleId: { $in: scheduleIds } });
        }
        const hasBookings = await Booking.exists({
            $or: bookingReferences,
        });
        if (hasBookings) {
            return res.status(409).json({
                error: "This trip has bookings and cannot be deleted. Cancel or resolve its bookings first.",
            });
        }

        const result = await removeTrip(id);

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: `Trip with id '${id}' was not found` });
        }

        return res.status(200).json({ message: "Trip and associated schedules were successfully deleted" });

    } catch (error) {
        console.error("Error deleting trip:", error);
        return res.status(500).json({ message: 'Internal server error' })
    }
}
