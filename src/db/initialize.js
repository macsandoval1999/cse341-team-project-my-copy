import trips from "./seeds/trips.json" with { type: "json" };
import schedules from "./seeds/schedules.json" with { type: "json" };
import stations from "./seeds/stations.json" with { type: "json" };
import ticketClasses from "./seeds/ticket-classes.json" with { type: "json" };
import trains from "./seeds/trains.json" with { type: "json" };
import { Role } from "../models/schemas/roles.js";
import Booking from "../models/schemas/bookings.js";
import Schedule from "../models/schemas/schedules.js";
import Station from "../models/schemas/stations.js";
import TicketClass from "../models/schemas/ticket-classes.js";
import Train from "../models/schemas/trains.js";
import Trip from "../models/schemas/trips.js";
import { User } from "../models/schemas/users.js";

const starterCollections = [
    ["roles", [{ name: "customer" }, { name: "admin" }]],
    ["trips", trips],
    ["schedules", schedules],
    ["stations", stations],
    ["ticket-classes", ticketClasses],
    ["trains", trains],
];

const starterModels = {
    roles: Role,
    trips: Trip,
    schedules: Schedule,
    stations: Station,
    "ticket-classes": TicketClass,
    trains: Train,
};

const initializeDatabase = async () => {
    for (const [collectionName, documents] of starterCollections) {
        const Model = starterModels[collectionName];
        await Model.deleteMany({});
    }

    const insertOrder = ["roles", "trains", "trips", "schedules", "stations", "ticket-classes"];
    for (const collectionName of insertOrder) {
        const documents = starterCollections.find(([name]) => name === collectionName)[1];
        const Model = starterModels[collectionName];
        await Model.insertMany(documents);
    }

    await User.createCollection();
    const textIndex = (await User.listIndexes()).find((index) => index.weights);
    const existingFields = Object.keys(textIndex?.weights ?? {}).sort();
    const searchableFields = ["email", "name", "username"];
    if (textIndex && existingFields.join(",") !== searchableFields.join(",")) {
        await User.collection.dropIndex(textIndex.name);
    }

    await User.createIndexes();

    await Booking.deleteMany({});
    await Booking.createIndexes();
    await Train.createIndexes();
};

export { initializeDatabase, starterCollections };
