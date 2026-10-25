import {
    getTripById as findTripById,
    getTripFilters,
    getPaginatedTrips as findPaginatedTrips,
    updateTrip as changeTrip,
    deleteTrip as removeTrip
} from "../models/trips.js";
import Station from "../models/schemas/stations.js";
import Schedule from "../models/schemas/schedules.js";
import { getTrainById as findTrainById } from "../models/trains.js";

const allowedSortFields = ['name', 'region', 'startStation', 'endStation', 'distance', 'bestSeason'];
const MAX_SEARCH_LENGTH = 100;

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

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseStringFilter = (value) => {
    if (value === undefined) {
        return undefined;
    }
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === 'all') {
        return undefined;
    }
    return trimmed;
};

//returns one page of trips (optionally filtered by region/season/search); 200 on success, 400 for bad query values, 500 for unexpected errors
export async function getPaginatedTripsList(req, res) {
    try {
        const page = parsePositiveInteger(req.query.page, 1);
        const requestedLimit = parsePositiveInteger(req.query.limit, 10);

        if (!page || !requestedLimit || requestedLimit > 50) {
            return res.status(400).json({
                errors: [{
                    field: 'pagination',
                    message: 'page and limit must be positive integers, and limit cannot exceed 50.'
                }]
            });
        }

        const limit = requestedLimit;

        if (req.query.sort && !allowedSortFields.includes(req.query.sort)) {
            return res.status(400).json({
                errors: [{ field: 'sort', message: 'sort is not supported.' }]
            });
        }

        const sort = req.query.sort || 'name';
        const order = req.query.order === 'desc' ? -1 : 1;

        const region = parseStringFilter(req.query.region);
        if (region === null) {
            return res.status(400).json({
                errors: [{ field: 'region', message: 'region must be a string.' }]
            });
        }

        const season = parseStringFilter(req.query.season);
        if (season === null) {
            return res.status(400).json({
                errors: [{ field: 'season', message: 'season must be a string.' }]
            });
        }

        const search = parseStringFilter(req.query.search);
        if (search === null) {
            return res.status(400).json({
                errors: [{ field: 'search', message: 'search must be a string.' }]
            });
        }
        if (search && search.length > MAX_SEARCH_LENGTH) {
            return res.status(400).json({
                errors: [{ field: 'search', message: `search cannot exceed ${MAX_SEARCH_LENGTH} characters.` }]
            });
        }

        const filter = {};
        if (region) {
            filter.region = { $regex: `^${escapeRegExp(region)}$`, $options: 'i' };
        }
        if (season) {
            filter.bestSeason = { $regex: `^${escapeRegExp(season)}$`, $options: 'i' };
        }
        if (search) {
            const pattern = escapeRegExp(search);
            filter.$or = [
                { name: { $regex: pattern, $options: 'i' } },
                { description: { $regex: pattern, $options: 'i' } },
            ];
        }

        const { trips, totalItems } = await findPaginatedTrips({
            filter,
            page,
            limit,
            sort,
            order
        });

        return res.status(200).json({
            data: trips,
            pagination: {
                page,
                limit,
                totalItems,
                totalPages: Math.ceil(totalItems / limit),
                hasNextPage: page * limit < totalItems,
                hasPreviousPage: page > 1
            },
            filters: {
                region: region || null,
                season: season || null,
                search: search || null,
            }
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

        return res.status(200).json(trip);


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

        return res.render("trips/details", {
            title: "Trip Details",
            details,
            train,
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


/*
This function updates trip and schedule, allowing user to change trip name, trip station and trip schedule.

*/

export async function updateTrip (req, res) {
    try{
        const {id} = req.params;
        const { scheduleIds, ...requestedUpdates } = req.body;
        const allowedFields = ["name", "description", "startStation", "endStation", "distance"];
        const unknownFields = Object.keys(requestedUpdates).filter(
            (field) => !allowedFields.includes(field)
        );

        if (unknownFields.length > 0) {
            return res.status(400).json({ error: "Unsupported trip fields" });
        }

        const updateData = Object.fromEntries(
            Object.entries(requestedUpdates).filter(([field]) => allowedFields.includes(field))
        );

        if (Object.keys(updateData).length === 0 && scheduleIds === undefined) {
            return res.status(400).json({ error: "No trip changes provided" });
        }

        const trip = await findTripById(id);
        if (!trip) {
            return res.status(404).json({ error: `Trip with id '${id}' was not found` });
        }

        //Make sure station does exist
        if(updateData.startStation || updateData.endStation){
            if(updateData.startStation){
                const startExist = await Station.findOne({name: updateData.startStation});
                if(!startExist){
                    return res.status(400).json({error:`Start Station '${updateData.startStation}' does not exist`});
                }
            }

            if(updateData.endStation){
                const endExist = await Station.findOne({name: updateData.endStation});
                if(!endExist){
                    return res.status(400).json({error:`End Station '${updateData.endStation}' does not exist`});
                }
            }
            
        }

        /*
        Make sure schedule exists and because the schedule don't exist inside the trip document and collection
        we need to check and update in the schedule collection
        */

        let selectedScheduleIds;
        if (scheduleIds !== undefined) {
            if (!Array.isArray(scheduleIds)) {
                return res.status(400).json({ error: "Schedule IDs must be an array" });
            }

            selectedScheduleIds = scheduleIds.map(Number);
            if (selectedScheduleIds.some((scheduleId) => !Number.isSafeInteger(scheduleId)) ||
                new Set(selectedScheduleIds).size !== selectedScheduleIds.length) {
                return res.status(400).json({ error: "Schedule IDs must be unique integers" });
            }

            const matchingSchedules = await Schedule.countDocuments({ id: { $in: selectedScheduleIds } });
            if (matchingSchedules !== selectedScheduleIds.length) {
                return res.status(400).json({ error: "Selected schedule does not exist" });
            }
        }

        const result = await changeTrip(id, updateData);
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: `Trip with id '${id}' was not found` });
        }

        if (selectedScheduleIds !== undefined) {
            await Schedule.updateMany({ tripId: id }, { $unset: { tripId: "" } });
            await Schedule.updateMany(
                { id: { $in: selectedScheduleIds } },
                { $set: { tripId: id } }
            );
        }

        return res.status(200).json({
            message: "Trip and schedule associations updated successfully",
            wasModified: result.modifiedCount > 0 || selectedScheduleIds !== undefined,
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

        const result = await removeTrip(id);

        //check if the request failed 
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: `Trip with id '${id}' was not found` });
        }

        return res.status(200).json({ message: "Trip and associated schedule were successfuly deleted" });

    } catch (error) {
        console.error("Error deleting trip:", error);
        return res.status(500).json({ message: 'Internal server error' })
    }
}
