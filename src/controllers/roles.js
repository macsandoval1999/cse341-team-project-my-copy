import {
    getPaginatedRoles as findPaginatedRoles,
    getRoleByUserId as findRoleByUserId,
} from "../models/roles.js";
import {
    createListResponse,
    escapeRegExp,
    parseListQuery,
    parseOptionalString,
} from "../utils/list-query.js";

export async function getAllRoles(req, res) {
    try {
        const options = parseListQuery(req.query, ["name"], "name");
        if (options.errors.length > 0) {
            return res.status(400).json({ errors: options.errors });
        }
        const search = parseOptionalString(req.query.q, "q", { maxLength: 100 });
        if (search.error) {
            return res.status(400).json({
                errors: [{ field: "q", message: search.error }],
            });
        }

        const filter = {};
        if (search.value) {
            filter.name = { $regex: escapeRegExp(search.value), $options: "i" };
        }
        const { roles, totalItems } = await findPaginatedRoles({
            filter,
            ...options,
        });
        return res.status(200).json(createListResponse({
            data: roles,
            ...options,
            totalItems,
            query: { q: search.value },
        }));
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
