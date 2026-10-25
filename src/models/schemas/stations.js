import mongoose from "mongoose";

const stationSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    prefecture: {
      type: String,
      required: false,
      trim: true,
    },
    region: {
      type: String,
      required: false,
      trim: true,
    },
    facilities: {
      type: [String],
      required: true,
      default: [],
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

const Station = mongoose.model("Station", stationSchema, "stations");

export default Station;
