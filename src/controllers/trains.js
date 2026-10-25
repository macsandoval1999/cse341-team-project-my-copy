import {
    getTrainById as findTrainById,
    getPaginatedTrains as findPaginatedTrains,
    getTrainFilterOptions as findTrainFilterOptions,
    createTrain as insertTrain,
    updateTrain as changeTrain,
    deleteTrain as removeTrain,
} from "../models/trains.js";
import {
    getTripById as findTripById,
    getTripsByTrainId as findTripsByTrainId,
    updateTripTrain as changeTripTrain,
} from "../models/trips.js";

export const trainsPage = (req, res) => {
    res.render("trains", { title: "Trains" });
};

const allowedSortFields = ["name", "operator", "maxSpeedKmh", "capacity"];

export const trainDetailsPage = (req, res) => {
    const { id } = req.params;

    res.render("train-details", { title: "Train Details", trainId: id });
};

export const trainsAdminPage = (req, res) => {
    res.render("trains-admin", { title: "Manage Trains" });
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

const parseOptionalString = (value, fieldName, { maxLength } = {}) => {
    if (value === undefined) {
        return { value: null, error: null };
    }

    if (typeof value !== 'string') {
        return { value: null, error: `${fieldName} must be a single string value.` };
    }

    const trimmed = value.trim();

    if (!trimmed || (maxLength && trimmed.length > maxLength)) {
        return {
            value: null,
            error: maxLength
                ? `${fieldName} must be between 1 and ${maxLength} characters.`
                : `${fieldName} must not be empty.`
        };
    }

    return { value: trimmed, error: null };
};

export async function getAllTrains(req, res) {
    try {
        const page = parsePositiveInteger(req.query.page, 1);
        const requestedLimit = parsePositiveInteger(req.query.limit, 10);

        if (!page || !requestedLimit || requestedLimit > 50) {
            return res.status(400).json({
                errors: [
                    {
                        field: "pagination",
                        message:
                            "page and limit must be positive integers, and limit cannot exceed 50.",
                    },
                ],
            });
        }

        const limit = requestedLimit;

        if (req.query.sort && !allowedSortFields.includes(req.query.sort)) {
            return res.status(400).json({
                errors: [{ field: "sort", message: "sort is not supported." }],
            });
        }

        const sort = req.query.sort || "name";
        const order = req.query.order === "desc" ? -1 : 1;

        const q = parseOptionalString(req.query.q, 'q', { maxLength: 100 });
        if (q.error) {
            return res.status(400).json({ errors: [{ field: 'q', message: q.error }] });
        }

        const type = parseOptionalString(req.query.type, 'type');
        if (type.error) {
            return res.status(400).json({ errors: [{ field: 'type', message: type.error }] });
        }

        const powerSource = parseOptionalString(req.query.powerSource, 'powerSource');
        if (powerSource.error) {
            return res.status(400).json({ errors: [{ field: 'powerSource', message: powerSource.error }] });
        }

        const filter = {};
        if (q.value) {
            const searchPattern = escapeRegExp(q.value);
            filter.$or = [
                { name: { $regex: searchPattern, $options: 'i' } },
                { operator: { $regex: searchPattern, $options: 'i' } },
                { description: { $regex: searchPattern, $options: 'i' } },
                { bestFor: { $regex: searchPattern, $options: 'i' } }
            ];
        }
        if (type.value) {
            filter.type = { $regex: `^${escapeRegExp(type.value)}$`, $options: 'i' };
        }
        if (powerSource.value) {
            filter.powerSource = { $regex: `^${escapeRegExp(powerSource.value)}$`, $options: 'i' };
        }

        const { trains, totalItems } = await findPaginatedTrains({
            filter,
            page,
            limit,
            sort,
            order,
        });

        return res.status(200).json({
            data: trains,
            query: {
                q: q.value,
                type: type.value,
                powerSource: powerSource.value
            },
            pagination: {
                page,
                limit,
                totalItems,
                totalPages: Math.ceil(totalItems / limit),
                hasNextPage: page * limit < totalItems,
                hasPreviousPage: page > 1,
            },
        });
    } catch (error) {
        console.error("Error fetching trains:", error);

        return res.status(500).json({
            error: "Failed to fetch trains",
        });
    }
}

export async function getTrainFilterOptions(req, res) {
    try {
        const options = await findTrainFilterOptions();

        return res.status(200).json(options);
    } catch (error) {
        console.error("Error fetching train filter options:", error);

        return res.status(500).json({
            error: "Failed to fetch train filter options",
        });
    }
}

export async function getTrainById(req, res) {
    try {
        const { id } = req.params;

        const train = await findTrainById(id);

        if (!train) {
            return res.status(404).json({
                error: "Train not found",
            });
        }

        return res.status(200).json(train);
    } catch (error) {
        console.error("Error fetching train:", error);

        return res.status(500).json({
            error: "Failed to fetch train",
        });
    }
}

export async function getTripsByTrain(req, res) {
    try {
        const { id } = req.params;

        const train = await findTrainById(id);

        if (!train) {
            return res.status(404).json({
                error: "Train not found",
            });
        }

        const trips = await findTripsByTrainId(id);

        return res.status(200).json({ trips });
    } catch (error) {
        console.error("Error fetching trips for train:", error);

        return res.status(500).json({
            error: "Failed to fetch trips for train",
        });
    }
}

const requiredTrainFields = ["name", "operator", "type", "powerSource", "maxSpeedKmh", "capacity"];
const optionalTrainFields = ["imageUrl", "imageAlt", "bestFor", "description"];
const numberTrainFields = ["maxSpeedKmh", "capacity"];
const editableTrainFields = [...requiredTrainFields, ...optionalTrainFields];

// Express leaves req.body undefined when a request has no JSON body
const getBody = (req) => {
    return req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
};

/*
Checks a train request body before anything touches the database. New trains need every
required field. Updates only check the fields that were sent, and can never change the id.
Returns a list of { field, message } errors, which is empty when the body is valid.
*/
const validateTrainBody = (body, { isNew }) => {
    const errors = [];
    const allowedFields = isNew ? ["id", ...editableTrainFields] : editableTrainFields;

    for (const field of Object.keys(body)) {
        if (!allowedFields.includes(field)) {
            const message = field === "id"
                ? "id can't be changed once a train exists."
                : `${field} is not a train field.`;
            errors.push({ field, message });
        }
    }

    if (isNew) {
        for (const field of ["id", ...requiredTrainFields]) {
            if (body[field] === undefined) {
                errors.push({ field, message: `${field} is required.` });
            }
        }
    }

    for (const field of allowedFields) {
        const value = body[field];
        if (value === undefined) {
            continue;
        }

        if (numberTrainFields.includes(field)) {
            if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
                errors.push({ field, message: `${field} must be a number 0 or greater.` });
            }
        } else if (typeof value !== "string") {
            errors.push({ field, message: `${field} must be text.` });
        } else if (value.trim() === "" && (field === "id" || requiredTrainFields.includes(field))) {
            errors.push({ field, message: `${field} can't be empty.` });
        }
    }

    return errors;
};

// Backstop for errors the schema throws, so they get the same responses as the checks above
const sendTrainWriteError = (res, error, fallbackMessage) => {
    if (error.name === "ValidationError") {
        const errors = Object.values(error.errors).map((fieldError) => ({
            field: fieldError.path,
            message: fieldError.message,
        }));
        return res.status(400).json({ errors });
    }

    // 11000 is MongoDB's duplicate key error, from the unique index on id
    if (error.code === 11000) {
        return res.status(409).json({ error: "A train with that id already exists" });
    }

    // Thrown by the trains schema's delete hook when a trip still uses the train
    if (error.status === 409) {
        return res.status(409).json({ error: error.message, trips: error.trips });
    }

    console.error(fallbackMessage, error);
    return res.status(500).json({ error: fallbackMessage });
};

export async function createTrain(req, res) {
    try {
        const body = getBody(req);

        const errors = validateTrainBody(body, { isNew: true });
        if (errors.length > 0) {
            return res.status(400).json({ errors });
        }

        const id = body.id.trim();
        if (await findTrainById(id)) {
            return res.status(409).json({ error: `A train with id '${id}' already exists` });
        }

        const train = await insertTrain({ ...body, id });

        return res.status(201).json(train);
    } catch (error) {
        return sendTrainWriteError(res, error, "Failed to create train");
    }
}

export async function updateTrainById(req, res) {
    try {
        const { id } = req.params;
        const body = getBody(req);

        const errors = validateTrainBody(body, { isNew: false });
        if (Object.keys(body).length === 0) {
            errors.push({ field: "body", message: "No train changes provided." });
        }
        if (errors.length > 0) {
            return res.status(400).json({ errors });
        }

        if (!(await findTrainById(id))) {
            return res.status(404).json({ error: "Train not found" });
        }

        const train = await changeTrain(id, body);
        if (!train) {
            return res.status(404).json({ error: "Train not found" });
        }

        return res.status(200).json(train);
    } catch (error) {
        return sendTrainWriteError(res, error, "Failed to update train");
    }
}

export async function deleteTrainById(req, res) {
    try {
        const { id } = req.params;

        if (!(await findTrainById(id))) {
            return res.status(404).json({ error: "Train not found" });
        }

        // Check here first so the database isn't asked to do a delete that can't happen
        const trips = await findTripsByTrainId(id);
        if (trips.length > 0) {
            return res.status(409).json({
                error: "This train is still assigned to trips",
                trips: trips.map((trip) => trip.id),
            });
        }

        await removeTrain(id);

        return res.status(200).json({ message: "Train deleted" });
    } catch (error) {
        return sendTrainWriteError(res, error, "Failed to delete train");
    }
}

export async function moveTripToTrain(req, res) {
    try {
        const { id } = req.params;
        const body = getBody(req);

        const unknownFields = Object.keys(body).filter((field) => field !== "trainId");
        if (unknownFields.length > 0) {
            return res.status(400).json({
                errors: unknownFields.map((field) => ({ field, message: `${field} can't be changed here.` })),
            });
        }

        if (typeof body.trainId !== "string" || body.trainId.trim() === "") {
            return res.status(400).json({
                errors: [{ field: "trainId", message: "trainId is required." }],
            });
        }

        if (!(await findTripById(id))) {
            return res.status(404).json({ error: "Trip not found" });
        }

        const trainId = body.trainId.trim();
        if (!(await findTrainById(trainId))) {
            return res.status(400).json({
                errors: [{ field: "trainId", message: `Train '${trainId}' does not exist` }],
            });
        }

        const trip = await changeTripTrain(id, trainId);
        if (!trip) {
            return res.status(404).json({ error: "Trip not found" });
        }

        return res.status(200).json(trip);
    } catch (error) {
        return sendTrainWriteError(res, error, "Failed to move trip to train");
    }
}
