import { User } from "./schemas/users.js";
import { Role } from "./schemas/roles.js";
import bcrypt from "bcrypt";

export async function getPaginatedAllUsers(
    filter = {},
    page,
    limit,
    sort,
    order
) {
    const skip = (page - 1) * limit;
    const userQuery =
        sort === "role"
            ? User.aggregate([
                  { $match: filter },
                  {
                      $lookup: {
                          from: Role.collection.name,
                          localField: "role",
                          foreignField: "_id",
                          as: "role",
                      },
                  },
                  {
                      $unwind: {
                          path: "$role",
                          preserveNullAndEmptyArrays: true,
                      },
                  },
                  { $sort: { "role.name": order, _id: 1 } },
                  { $skip: skip },
                  { $limit: limit },
                  { $project: { passwordHash: 0 } },
              ])
            : User.find(filter)
                  .select("-passwordHash")
                  .populate("role")
                  .sort({ [sort]: order, _id: 1 })
                  .skip(skip)
                  .limit(limit)
                  .lean();
    const [users, countResult] = await Promise.all([
        userQuery,
        User.aggregate([{ $match: filter }, { $count: "totalUsers" }]),
    ]);
    const totalUsers = countResult[0]?.totalUsers ?? 0;
    return { users, totalUsers };
}

export async function getAllUsers() {
    return User.find({}).select("-passwordHash").populate("role").lean();
}

export async function getUserById(_id) {
    return User.findOne({ _id })
        .select("-passwordHash")
        .populate("role")
        .lean();
}

export const getUserByEmail = async (email) => {
    return User.findOne({ email }).populate("role");
};

export const getUserByUsername = async (username) => {
    return User.findOne({ username: username.trim().toLowerCase() }).populate(
        "role"
    );
};

export async function updateUserById(_id, userData) {
    return User.findByIdAndUpdate(_id, userData, {
        returnDocument: "after",
        runValidators: true,
    })
        .select("-passwordHash")
        .populate("role")
        .lean();
}

export async function deleteUserById(_id) {
    return User.findByIdAndDelete(_id);
}

export const createUser = async (name, username, email, password) => {
    const customer = await Role.findOne({ name: "customer" });
    if (!customer) throw new Error("Default role not found");

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
        name,
        username: username.trim().toLowerCase(),
        email,
        passwordHash,
        role: customer._id,
    });

    return user._id.toString();
};
