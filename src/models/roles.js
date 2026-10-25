import { Role } from "./schemas/roles.js";
import { User } from "./schemas/users.js";

export async function getAllRoles() {
    return Role.find({}).lean();
}

export async function getRoleById(_id) {
    return Role.findOne({ _id }).lean();
}

export async function getRoleByName(name) {
    return Role.findOne({ name }).lean();
}

export async function getRoleByUserId(userId) {
    const user = await User.findById(userId).select("role").lean();
    if (!user) {
        return null;
    }
    return Role.findById(user.role).lean();
}

export const createRole = async (name) => {
    const customer = await Role.findOne({ name: 'name' });
    if (customer) throw new Error('Role Already Exists');

    const newRole = await Role.create({ name });

    return newRole.name.toString();
};

