import mongoose from "mongoose";

const roleSchema = new mongoose.Schema({
    name: {
      type: String,
      enum: ['customer', 'admin'],
      unique: true,
      required: true
    }
  });
  
  export const Role = mongoose.model('Role', roleSchema);