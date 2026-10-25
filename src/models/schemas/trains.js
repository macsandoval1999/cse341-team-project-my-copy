//src/models/schemas/trains.js.
import mongoose from "mongoose";

const trainSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      // Trips reference trains by id, so it can't change once the train exists
      immutable: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    operator: {
      type: String,
      required: true,
      trim: true,
    },
    imageUrl: {
      type: String,
      required: false,
      trim: true,
    },
    imageAlt: {
      type: String,
      required: false,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
    },
    maxSpeedKmh: {
      type: Number,
      required: true,
      min: 0,
    },
    capacity: {
      type: Number,
      required: true,
      min: 0,
    },
    powerSource: {
      type: String,
      required: true,
      trim: true,
    },
    bestFor: {
      type: String,
      required: false,
      trim: true,
    },
    description: {
      type: String,
      required: false,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

trainSchema.index({
  name: 'text',
  operator: 'text',
  description: 'text',
  bestFor: 'text',
});

// Refuse to delete a train that a trip still uses, no matter which code path deletes it.
// Trip is looked up by name instead of imported, because the trips schema uses Train too.
trainSchema.pre(
  ["deleteOne", "deleteMany", "findOneAndDelete"],
  { document: false, query: true },
  async function () {
    const trains = await this.model.find(this.getFilter()).select("id").lean();
    const trainIds = trains.map((train) => train.id);

    const tripsInUse = await mongoose
      .model("Trip")
      .find({ trainId: { $in: trainIds } })
      .select("id")
      .lean();

    if (tripsInUse.length > 0) {
      const error = new Error("This train is still assigned to trips");
      error.status = 409;
      error.trips = tripsInUse.map((trip) => trip.id);
      throw error;
    }
  }
);

const Train = mongoose.model("Train", trainSchema);

export default Train;