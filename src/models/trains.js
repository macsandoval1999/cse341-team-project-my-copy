import Train from "./schemas/trains.js";

export async function getAllTrains() {
    return Train.find({}).sort({ id: 1 }).lean();
}

export async function getTrainById(id) {
    return Train.findOne({ id }).lean();
}

export async function getPaginatedTrains({
    filter = {},
    page,
    limit,
    sort,
    order,
}) {
    const skip = (page - 1) * limit;
    const sortOptions = { [sort]: order, id: 1 };

    const [trains, totalItems] = await Promise.all([
        Train.find(filter).sort(sortOptions).skip(skip).limit(limit).lean(),
        Train.countDocuments(filter),
    ]);

    return { trains, totalItems };
}

export async function getTrainFilterOptions() {
    const [types, powerSources] = await Promise.all([
        Train.distinct('type'),
        Train.distinct('powerSource')
    ]);

    return { types, powerSources };
}

export async function createTrain(trainData) {
    const train = await Train.create(trainData);
    return train.toObject();
}

// runValidators makes updates follow the same schema rules as new trains
export async function updateTrain(id, updates) {
    return Train.findOneAndUpdate(
        { id },
        { $set: updates },
        { returnDocument: "after", runValidators: true }
    ).lean();
}

// The schema's delete hook throws a 409 error if a trip still uses this train
export async function deleteTrain(id) {
    return Train.deleteOne({ id });
}
