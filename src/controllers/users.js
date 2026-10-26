import {
    createUser,
    deleteUserById,
    getAllUsers as findAllUsers,
    getPaginatedAllUsers as findPaginatedAllUsers,
    getUserById as findUserById,
    getUserByEmail,
    getUserByUsername,
    updateUserById as updateStoredUser,
} from "../models/users.js";
import { deleteBookingsByUserId } from "../models/bookings.js";
import { getRoleByName as findRoleByName } from "../models/roles.js";
import { hasRole } from "../middleware/authentication.js";
import { createPagination, parseListQuery } from "../utils/list-query.js";

const allowedSortFields = ["name", "username", "email", "role"];
const allowedUserRoles = ["admin", "customer"];
const isRequestObject = (value) =>
    value !== null && typeof value === "object" && !Array.isArray(value);

const getUnknownFields = (body, allowedFields) =>
    Object.keys(body).filter((field) => !allowedFields.includes(field));

const normalizeName = (value) =>
    value
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase()
        .replace(
            /(^|[\s-])(\p{L})/gu,
            (_, separator, letter) => `${separator}${letter.toUpperCase()}`
        );
const normalizeUsername = (value) => value.trim().toLowerCase();

export const getPaginatedAllUsers = async (req, res) => {
    try {
        const options = parseListQuery(
            req.query,
            allowedSortFields,
            "username"
        );
        if (options.errors.length > 0) {
            return res.status(400).json({
                errors: options.errors,
            });
        }

        const { page, limit, sort, order, orderName } = options;
        const filter = {};
        const appliedQuery = {};

        if (req.query.q !== undefined) {
            if (typeof req.query.q !== "string") {
                return res.status(400).json({
                    errors: [
                        {
                            field: "q",
                            message: "Search text must be a single string.",
                        },
                    ],
                });
            }

            const searchText = req.query.q.trim();
            if (!searchText || searchText.length > 100) {
                return res.status(400).json({
                    errors: [
                        {
                            field: "q",
                            message:
                                "Search text must be between 1 and 100 characters.",
                        },
                    ],
                });
            }
            filter.$text = { $search: searchText };
            appliedQuery.q = searchText;
        }

        if (req.query.role !== undefined) {
            if (typeof req.query.role !== "string") {
                return res.status(400).json({
                    errors: [
                        {
                            field: "role",
                            message: "Role must be a single value.",
                        },
                    ],
                });
            }

            const roleName = req.query.role.trim().toLowerCase();
            if (!allowedUserRoles.includes(roleName)) {
                return res.status(400).json({
                    errors: [
                        {
                            field: "role",
                            message: "Role must be admin or customer.",
                        },
                    ],
                });
            }

            const role = await findRoleByName(roleName);
            if (!role) {
                return res.status(400).json({
                    errors: [
                        { field: "role", message: "Role is not available." },
                    ],
                });
            }
            filter.role = role._id;
            appliedQuery.role = roleName;
        }

        const { users, totalUsers } = await findPaginatedAllUsers(
            filter,
            page,
            limit,
            sort,
            order
        );

        return res.status(200).json({
            data: users,
            query: appliedQuery,
            sort: { field: sort, order: orderName },
            pagination: {
                ...createPagination(page, limit, totalUsers),
                totalUsers,
            },
        });
    } catch (error) {
        console.error("Error fetching paginated users:", error);
        return res
            .status(500)
            .json({ error: "Failed to fetch paginated users" });
    }
};

export async function getUsers(req, res) {
    try {
        const users = await findAllUsers();
        return res.status(200).json(users);
    } catch (error) {
        console.error("Error fetching users:", error);
        return res.status(500).json({ error: "Failed to fetch users" });
    }
}

export async function getUserById(req, res) {
    try {
        const user = await findUserById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        return res.status(200).json(user);
    } catch (error) {
        if (error.name === "CastError") {
            return res.status(400).json({ error: "Invalid user ID" });
        }
        console.error("Error fetching user:", error);
        return res.status(500).json({ error: "Failed to fetch user" });
    }
}

export async function accountPage(req, res) {
    res.render("users", {
        title: "Your Account",
        usersEndpoint: `/api/users/${req.user._id}`,
        isAdmin: res.locals.isAdmin,
        isAdminList: false,
    });
}

export async function updateUser(req, res) {
    try {
        const body = req.body;
        if (!isRequestObject(body)) {
            return res.status(400).json({ error: "User information must be an object" });
        }

        const unknownFields = getUnknownFields(body, [
            "name",
            "email",
            "username",
            "role",
        ]);
        if (unknownFields.length > 0) {
            return res.status(400).json({
                error: `Unknown user fields: ${unknownFields.join(", ")}`,
            });
        }

        const invalidFields = ["name", "email", "username", "role"].filter(
            (field) => body[field] !== undefined && typeof body[field] !== "string"
        );
        if (invalidFields.length > 0) {
            return res.status(400).json({
                error: `User fields must be strings: ${invalidFields.join(", ")}`,
            });
        }

        let name = "";
        if (typeof body.name === "string") {
            name = normalizeName(body.name);
        }
        const hasUsername = body.username !== undefined;
        let username = "";
        if (typeof body.username === "string") {
            username = normalizeUsername(body.username);
        }
        let email = "";
        if (typeof body.email === "string") {
            email = body.email.trim().toLowerCase();
        }
        if (!name || !email) {
            return res
                .status(400)
                .json({ error: "Name and email are required" });
        }

        const existingUser = await findUserById(req.params.id);
        if (!existingUser) {
            return res.status(404).json({ error: "User not found" });
        }

        const emailChanged = email !== existingUser.email.trim().toLowerCase();
        const userData = { name };
        if (emailChanged) {
            const emailOwner = await getUserByEmail(email);
            if (
                emailOwner &&
                String(emailOwner._id) !== String(existingUser._id)
            ) {
                return res
                    .status(409)
                    .json({ error: "Email is already in use" });
            }
            userData.email = email;
        }

        if (hasUsername) {
            if (!username) {
                return res.status(400).json({ error: "Username is required" });
            }
            if (username !== existingUser.username) {
                const usernameOwner = await getUserByUsername(username);
                if (
                    usernameOwner &&
                    String(usernameOwner._id) !== String(existingUser._id)
                ) {
                    return res
                        .status(409)
                        .json({ error: "Username is already in use" });
                }
                userData.username = username;
            }
        }

        if (body.role !== undefined) {
            if (!hasRole(req.user, "admin")) {
                return res
                    .status(403)
                    .json({ error: "Only admins can change user roles" });
            }
            let requestedRole = "";
            if (typeof body.role === "string") {
                requestedRole = body.role.trim().toLowerCase();
            }
            if (!["admin", "customer"].includes(requestedRole)) {
                return res.status(400).json({ error: "Invalid user role" });
            }

            const role = await findRoleByName(requestedRole);
            if (!role) {
                return res.status(400).json({ error: "Invalid user role" });
            }
            userData.role = role._id;
        }

        const user = await updateStoredUser(req.params.id, userData);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        if (String(req.user._id) === req.params.id) {
            req.session.user.name = user.name;
            req.session.user.email = user.email;
            if (userData.role) {
                req.session.user.role = user.role;
            }
        }

        return res.status(200).json(user);
    } catch (error) {
        if (error.code === 11000) {
            let message = "Email is already in use";
            if (error.keyPattern?.username) {
                message = "Username is already in use";
            }
            return res.status(409).json({
                error: message,
            });
        }
        if (error.name === "ValidationError" || error.name === "CastError") {
            return res.status(400).json({ error: "Invalid user information" });
        }
        console.error("Error updating user:", error);
        return res.status(500).json({ error: "Failed to update user" });
    }
}

export async function deleteUser(req, res) {
    try {
        const existingUser = await findUserById(req.params.id);
        if (!existingUser) {
            return res.status(404).json({ error: "User not found" });
        }

        const deletedSelf = String(req.user._id) === String(existingUser._id);
        await deleteBookingsByUserId(existingUser._id);
        const user = await deleteUserById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        if (deletedSelf) {
            req.session.user = null;
        }

        return res.status(200).json({ message: "User deleted", deletedSelf });
    } catch (error) {
        if (error.name === "CastError") {
            return res.status(400).json({ error: "Invalid user ID" });
        }
        console.error("Error deleting user:", error);
        return res.status(500).json({ error: "Failed to delete user" });
    }
}

export async function register(req, res) {
    const apiRequest = req.path.startsWith("/api/");
    const body = req.body;
    const allowedFields = apiRequest
        ? ["name", "username", "email", "password"]
        : ["name", "username", "email", "password", "confirm-password"];
    if (!isRequestObject(body)) {
        if (apiRequest) {
            return res.status(400).json({ error: "Registration data must be an object" });
        }
        return res.redirect("/register");
    }

    const unknownFields = getUnknownFields(body, allowedFields);
    if (unknownFields.length > 0) {
        if (apiRequest) {
            return res.status(400).json({
                error: `Unknown registration fields: ${unknownFields.join(", ")}`,
            });
        }
        return res.redirect("/register");
    }

    const invalidFields = ["name", "username", "email", "password", "confirm-password"]
        .filter((field) => body[field] !== undefined && typeof body[field] !== "string");
    if (invalidFields.length > 0) {
        if (apiRequest) {
            return res.status(400).json({
                error: `Registration fields must be strings: ${invalidFields.join(", ")}`,
            });
        }
        return res.redirect("/register");
    }

    let name = "";
    if (typeof body.name === "string") {
        name = normalizeName(body.name);
    }
    let username = "";
    if (typeof body.username === "string") {
        username = normalizeUsername(body.username);
    }
    let email = "";
    if (typeof body.email === "string") {
        email = body.email.trim().toLowerCase();
    }
    let password = "";
    if (typeof body.password === "string") {
        password = body.password;
    }
    const confirmPassword = body["confirm-password"];

    if (
        !name ||
        !username ||
        !email ||
        !password ||
        (!apiRequest && !confirmPassword)
    ) {
        if (apiRequest) {
            return res.status(400).json({
                error: "Name, username, email, and password are required",
            });
        }
        return res.redirect("/register");
    }

    if (confirmPassword !== undefined && confirmPassword !== password) {
        if (apiRequest) {
            return res.status(400).json({ error: "Passwords do not match" });
        }
        return res.redirect("/register");
    }

    try {
        const existingUser = await getUserByEmail(email);
        if (existingUser) {
            if (apiRequest) {
                return res
                    .status(409)
                    .json({ error: "Email is already in use" });
            }
            return res.status(409).render("register", {
                title: "Register",
                registrationError:
                    "Email is already in use. Try another email address.",
                oldName: name,
                oldUsername: username,
                oldEmail: email,
            });
        }

        const existingUsername = await getUserByUsername(username);
        if (existingUsername) {
            if (apiRequest) {
                return res
                    .status(409)
                    .json({ error: "Username is already in use" });
            }
            return res.status(409).render("register", {
                title: "Register",
                registrationError:
                    "Username is already in use. Try another username.",
                oldName: name,
                oldUsername: username,
                oldEmail: email,
            });
        }

        const userId = await createUser(name, username, email, password);

        if (apiRequest) {
            return res
                .status(201)
                .json({ message: "User registered successfully", userId });
        }
        return res.redirect("/login");
    } catch (error) {
        console.error("Error registering user:", error);
        if (error.code === 11000) {
            const isUsernameConflict = error.keyPattern?.username;
            let registrationError = "Email is already in use. Try another email address.";
            let apiError = "Email is already in use";
            if (isUsernameConflict) {
                registrationError = "Username is already in use. Try another username.";
                apiError = "Username is already in use";
            }
            if (apiRequest) {
                return res.status(409).json({
                    error: apiError,
                });
            }
            return res.status(409).render("register", {
                title: "Register",
                registrationError,
                oldName: name,
                oldUsername: username,
                oldEmail: email,
            });
        }
        if (apiRequest) {
            return res.status(500).json({
                error: "An error occurred during registration. Please try again.",
            });
        }
        return res.redirect("/register");
    }
}
