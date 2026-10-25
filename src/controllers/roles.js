import {
    getAllRoles as findAllRoles,
    getRoleByUserId as findRoleByUserId,
} from "../models/roles.js";

export async function getAllRoles(req, res) {
    try {
        const roles = await findAllRoles();
        return res.status(200).json(roles);
    } catch (error) {
        console.error("Error fetching roles:", error);
        return res.status(500).json({ error: "Failed to fetch roles" });
    }
}

export async function getRoleByUserId(req, res) {
    try {
        const { userId } = req.params;
        const role = await findRoleByUserId(userId);
        if (!role) {
            return res.status(404).json({ error: "User or role not found" });
        }
        return res.status(200).json(role);
    } catch (error) {
        if (error.name === "CastError") {
            return res.status(400).json({ error: "Invalid user ID" });
        }
        console.error("Error fetching role:", error);
        return res.status(500).json({ error: "Failed to fetch role" });
    }
}
