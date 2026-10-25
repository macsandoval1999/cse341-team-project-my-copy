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

const allowedSortFields = ["name", "username", "email", "role"];
const allowedUserRoles = ["admin", "customer"];

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

const parsePositiveInt = (value, defaultValue) => {
    if (value === undefined || value === null) {
        return defaultValue;
    }
    if (typeof value !== "string" || !/^\d+$/.test(value)) {
        return null;
    }
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

export const getPaginatedAllUsers = async (req, res) => {
    try {
        const page = parsePositiveInt(req.query.page, 1);
        const requestedLimit = parsePositiveInt(req.query.limit, 10);

        if (!page || !requestedLimit || requestedLimit > 50) {
            return res.status(400).json({
                errors: [
                    {
                        field: "pagination",
                        message:
                            "page and limit must be positive integers, and limit cannot exceed 50",
                    },
                ],
            });
        }

        const limit = requestedLimit;
        if (req.query.sort && !allowedSortFields.includes(req.query.sort)) {
            return res.status(400).json({
                errors: [
                    {
                        field: "sort",
                        message: `Sort must be one of: ${allowedSortFields.join(", ")}`,
                    },
                ],
            });
        }

        const sort = req.query.sort || "username";
        const order = req.query.order === "desc" ? -1 : 1;
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
            pagination: {
                page,
                limit,
                totalUsers,
                totalPages: Math.ceil(totalUsers / limit),
                hasNextPage: page * limit < totalUsers,
                hasPreviousPage: page > 1,
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
        const name =
            typeof req.body?.name === "string"
                ? normalizeName(req.body.name)
                : "";
        const hasUsername = req.body?.username !== undefined;
        const username =
            typeof req.body?.username === "string"
                ? normalizeUsername(req.body.username)
                : "";
        const email =
            typeof req.body?.email === "string"
                ? req.body.email.trim().toLowerCase()
                : "";
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

        if (req.body?.role !== undefined) {
            if (!hasRole(req.user, "admin")) {
                return res
                    .status(403)
                    .json({ error: "Only admins can change user roles" });
            }
            const requestedRole =
                typeof req.body.role === "string"
                    ? req.body.role.trim().toLowerCase()
                    : "";
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
            return res.status(409).json({
                error: error.keyPattern?.username
                    ? "Username is already in use"
                    : "Email is already in use",
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
    const name =
        typeof req.body?.name === "string" ? normalizeName(req.body.name) : "";
    const username =
        typeof req.body?.username === "string"
            ? normalizeUsername(req.body.username)
            : "";
    const email =
        typeof req.body?.email === "string"
            ? req.body.email.trim().toLowerCase()
            : "";
    const password =
        typeof req.body?.password === "string" ? req.body.password : "";
    const confirmPassword =
        req.body?.["confirm-password"] ?? req.body?.confirmPassword;

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
            const registrationError = isUsernameConflict
                ? "Username is already in use. Try another username."
                : "Email is already in use. Try another email address.";
            if (apiRequest) {
                return res.status(409).json({
                    error: isUsernameConflict
                        ? "Username is already in use"
                        : "Email is already in use",
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
