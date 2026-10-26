import { Router } from "express";
import {
    getAllTrains,
    getTrainById,
    getTrainFilterOptions,
    getTripsByTrain,
    createTrain,
    updateTrainById,
    deleteTrainById,
    moveTripToTrain,
} from "../controllers/trains.js";
import {
    getAllSchedules,
    getAdminSchedules,
    getScheduleById,
    getSchedulesByTripId,
    getSchedulesByTripAndMonth,
    createScheduleForTrip,
    updateScheduleById,
    validateMonth,
} from "../controllers/schedules.js";
import {
    createStationRecord,
    deleteStationRecord,
    getAdminStations,
    getAllStations,
    getStationById,
    getStationFilterOptions,
    updateStationRecord,
} from "../controllers/stations.js";
import {
    createTrip,
    getTripById,
    updateTrip,
    deleteTrip,
    getPaginatedTripsList,
} from "../controllers/trips.js";
import {
    getAllBookings,
    createBookingApi,
    getBookingsByUserId,
    updateBookingById,
    deleteBookingById,
    getBookingById,
    getBookingUpgradeQuote,
    getPaginatedBookings,
} from "../controllers/bookings.js";
import { getUserById as getUserById } from "../controllers/users.js";
import {
    getAllTicketClasses,
    getTicketClassesForDay,
} from "../controllers/ticket-classes.js";
import {
    requireApiGuestOrAdmin,
    requireApiLogin,
    requireApiRole,
    requireApiSelfOrAdmin,
} from "../middleware/authentication.js";
import {
    deleteUser,
    // getUsers,
    getPaginatedAllUsers,
    updateUser,
    register,
} from "../controllers/users.js";
import { getAllRoles, getRoleByUserId } from "../controllers/roles.js";
import { login, logout } from "../controllers/login.js";
const router = Router();

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Log in a user
 *     description: Authenticates a guest. Provide exactly one of identifier, email, or username plus password; unknown fields are rejected. Requests with an active session are rejected; log out before switching accounts.
 *     security:
 *       - {}
 *       - SessionCookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 additionalProperties: false
 *                 properties:
 *                   email:
 *                     type: string
 *                     format: email
 *                     example: hector@example.com
 *                   password:
 *                     type: string
 *                     format: password
 *                     example: mysecurepassword
 *                 required: [email, password]
 *               - type: object
 *                 additionalProperties: false
 *                 properties:
 *                   identifier:
 *                     type: string
 *                     example: hector
 *                   password:
 *                     type: string
 *                     format: password
 *                     example: mysecurepassword
 *                 required: [identifier, password]
 *               - type: object
 *                 additionalProperties: false
 *                 properties:
 *                   username:
 *                     type: string
 *                     example: hector
 *                   password:
 *                     type: string
 *                     format: password
 *                     example: mysecurepassword
 *                 required: [username, password]
 *     responses:
 *       '200':
 *         description: User logged in successfully.
 *       '400':
 *         description: Invalid input data.
 *       '401':
 *         description: Invalid email or password.
 *       '409':
 *         description: A user is already logged in in this session.
 *       '500':
 *         description: Internal server error.
 */
router.post("/api/auth/login", login);

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Log out a user
 *     description: Logs out the currently authenticated user.
 *     security:
 *       - SessionCookieAuth: []
 *     responses:
 *       '200':
 *         description: User logged out successfully.
 *       '400':
 *         description: No user is currently logged in.
 *       '401':
 *         description: Unauthorized.
 *       '500':
 *         description: Internal server error.
 */
router.post("/api/auth/logout", logout);

// Register page
/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Register a new user
 *     description: Guests and admins may create a customer account. Names are title-cased and usernames are stored lowercase. Unknown request fields are rejected. Signed-in customers are not allowed to register another account.
 *     security:
 *       - {}
 *       - SessionCookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             properties:
 *               name:
 *                 type: string
 *                 example: Hector
 *               username:
 *                 type: string
 *                 example: hector
 *               email:
 *                 type: string
 *                 example: hector@example.com
 *               password:
 *                 type: string
 *                 example: mysecurepassword
 *             required:
 *               - name
 *               - username
 *               - email
 *               - password
 *     responses:
 *       '201':
 *         description: User registered successfully.
 *       '400':
 *         description: Invalid input data.
 *       '403':
 *         description: Signed-in customer cannot register another account.
 *       '409':
 *         description: Email is already in use.
 *       '500':
 *         description: Internal server error.
 */
router.post("/api/auth/register", requireApiGuestOrAdmin, register);

// /** NON-PAGINATED VERSION OF GET ALL USERS */
//  * @openapi
//  * /api/users:
//  *   get:
//  *     tags: [Users]
//  *     summary: List all users
//  *     description: Admin only. Password hashes are never returned.
//  *     security:
//  *       - SessionCookieAuth: []
//  *     responses:
//  *       '200':
//  *         description: Users returned successfully.
//  *       '401':
//  *         description: Missing or invalid session.
//  *       '403':
//  *         description: Admin role required.
//  */
// router.get("/api/users", requireApiRole("admin"), getUsers);

// PAGINATED VERSION OF GET ALL USERS
/**
 * @openapi
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: List all users (paginated)
 *     description: Admin only. Password hashes are never returned.
 *     security:
 *       - SessionCookieAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         required: false
 *         description: Page number (default is 1)
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *       - name: limit
 *         in: query
 *         required: false
 *         description: Number of users per page (default is 10, maximum is 50)
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 50
 *       - name: q
 *         in: query
 *         required: false
 *         description: Searches user names, usernames, and email addresses using MongoDB text search (1-100 characters).
 *         schema:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *       - name: role
 *         in: query
 *         required: false
 *         description: Filter to users with this role.
 *         schema:
 *           type: string
 *           enum: [admin, customer]
 *       - name: sort
 *         in: query
 *         required: false
 *         description: Field to sort by (default username; name, username, email, or role name)
 *         schema:
 *           type: string
 *           enum: [name, username, email, role]
 *           default: username
 *       - name: order
 *         in: query
 *         required: false
 *         description: Sort order (default asc; asc or desc)
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *     responses:
 *       '200':
 *         description: >
 *           Users returned successfully. If the requested page is beyond the last page,
 *           or no users match, the response remains 200 with an empty data array and
 *           pagination metadata. The response also echoes the applied q and role filters.
 *       '400':
 *         description: Invalid query parameters.
 *       '401':
 *         description: Missing or invalid session.
 *       '403':
 *         description: Admin role required.
 *       '500':
 *         description: Internal server error.
 */
router.get("/api/users", requireApiRole("admin"), getPaginatedAllUsers);

/**
 * @openapi
 * /api/users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get a user by ID
 *     description: The user may retrieve their own record; admins may retrieve any user.
 *     security:
 *       - SessionCookieAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: MongoDB user ID.
 *         schema:
 *           type: string
 *         example: 6ab9358a87b7afeb8a3794b1
 *     responses:
 *       '200':
 *         description: User returned successfully.
 *       '400':
 *         description: Invalid user ID.
 *       '401':
 *         description: Missing or invalid session.
 *       '403':
 *         description: The caller is neither this user nor an admin.
 *       '404':
 *         description: User not found.
 */
router.get("/api/users/:id", requireApiSelfOrAdmin, getUserById);

/**
 * @openapi
 * /api/users/{id}:
 *   put:
 *     tags: [Users]
 *     summary: Update a user
 *     description: Users may update their own name, username, and email. Names are title-cased and usernames are stored lowercase. Admins may update any user and may also set role.
 *     security:
 *       - SessionCookieAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         example: 6ab9358a87b7afeb8a3794b1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [name, email]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Hector
 *               email:
 *                 type: string
 *                 format: email
 *                 example: hector@example.com
 *               username:
 *                 type: string
 *                 description: Stored lowercase; must be unique.
 *                 example: hector
 *               role:
 *                 type: string
 *                 enum: [customer, admin]
 *                 description: Admin only.
 *                 example: customer
 *     responses:
 *       '200':
 *         description: User updated successfully.
 *       '400':
 *         description: Invalid ID or user information.
 *       '401':
 *         description: Missing or invalid session.
 *       '403':
 *         description: Caller is not authorized or cannot change roles.
 *       '404':
 *         description: User not found.
 *       '409':
 *         description: Email or username is already in use.
 */
router.put("/api/users/:id", requireApiSelfOrAdmin, updateUser);

/**
 * @openapi
 * /api/users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Delete a user
 *     description: Users may delete their own account; admins may delete any account. Associated bookings are deleted too.
 *     security:
 *       - SessionCookieAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         example: 6ab9358a87b7afeb8a3794b1
 *     responses:
 *       '200':
 *         description: User deleted successfully.
 *       '400':
 *         description: Invalid user ID.
 *       '401':
 *         description: Missing or invalid session.
 *       '403':
 *         description: Caller is neither this user nor an admin.
 *       '404':
 *         description: User not found.
 */
router.delete("/api/users/:id", requireApiSelfOrAdmin, deleteUser);

/**
 * @openapi
 * /api/users:
 *   post:
 *     tags: [Users]
 *     summary: Register a user
 *     description: Guests and admins may create customer accounts. Signed-in customers are forbidden.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [name, username, email, password]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Hector
 *               username:
 *                 type: string
 *                 example: hector
 *               email:
 *                 type: string
 *                 format: email
 *                 example: hector@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: mysecurepassword
 *     responses:
 *       '201':
 *         description: User registered successfully.
 *       '400':
 *         description: Required registration data is missing or invalid.
 *       '403':
 *         description: Signed-in customers cannot create accounts.
 *       '409':
 *         description: Email is already in use.
 */
router.post("/api/users", requireApiGuestOrAdmin, register);

/**
 * @openapi
 * /api/roles:
 *   get:
 *     tags: [Roles]
 *     summary: List roles
 *     description: Admin only. Returns a standard paginated response and supports a case-insensitive name search.
 *     security:
 *       - SessionCookieAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema: { type: integer, default: 1, minimum: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 10, minimum: 1, maximum: 50 }
 *       - name: q
 *         in: query
 *         schema: { type: string, minLength: 1, maxLength: 100 }
 *         description: Searches role names.
 *       - name: sort
 *         in: query
 *         schema: { type: string, enum: [name], default: name }
 *       - name: order
 *         in: query
 *         schema: { type: string, enum: [asc, desc], default: asc }
 *     responses:
 *       '200':
 *         description: Returns data, applied query, sort, and pagination metadata.
 *       '400':
 *         description: Invalid pagination, sort, or search value.
 *       '401':
 *         description: Missing or invalid session.
 *       '403':
 *         description: Admin role required.
 */
router.get("/api/roles", requireApiRole("admin"), getAllRoles);

/**
 * @openapi
 * /api/roles/user/{userId}:
 *   get:
 *     tags: [Roles]
 *     summary: Get a role by user ID
 *     description: Admin only.
 *     security:
 *       - SessionCookieAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         example: 64b8f0c2e1b2a3d4f5678901
 *     responses:
 *       '200':
 *         description: Role returned successfully.
 *       '404':
 *         description: User or role not found.
 *       '400':
 *         description: Invalid user ID.
 *       '401':
 *         description: Missing or invalid session.
 *       '403':
 *         description: Admin role required.
 */
router.get("/api/roles/user/:userId", requireApiRole("admin"), getRoleByUserId);

/**
 * @openapi
 * /api/trains:
 *   get:
 *     tags:
 *       - Trains
 *     summary: Get a paginated, searchable list of trains
 *     description: Returns trains from the trains collection, paginated, sorted, and optionally filtered by search text, type, or power source.
 *     parameters:
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 50
 *       - name: sort
 *         in: query
 *         schema:
 *           type: string
 *           default: name
 *           enum: [name, operator, maxSpeedKmh, capacity]
 *       - name: order
 *         in: query
 *         schema:
 *           type: string
 *           default: asc
 *           enum: [asc, desc]
 *       - name: q
 *         in: query
 *         schema:
 *           type: string
 *         description: Case-insensitive substring search across name, operator, description, and bestFor.
 *       - name: type
 *         in: query
 *         schema:
 *           type: string
 *         description: Case-insensitive exact match against the train's type. See GET /api/trains/filters for current values.
 *       - name: powerSource
 *         in: query
 *         schema:
 *           type: string
 *         description: Case-insensitive exact match against the train's power source. See GET /api/trains/filters for current values.
 *     responses:
 *       '200':
 *         description: Trains retrieved successfully
 *       '400':
 *         description: Invalid pagination, sort, or filter parameter
 *       '500':
 *         description: Internal server error
 */
router.get("/api/trains", getAllTrains);

/**
 * @openapi
 * /api/trains/filters:
 *   get:
 *     tags:
 *       - Trains
 *     summary: Get the current train filter options
 *     description: Returns the distinct type and powerSource values currently present in the trains collection, for building filter dropdowns.
 *     responses:
 *       '200':
 *         description: Filter options retrieved successfully
 *       '500':
 *         description: Internal server error
 */
router.get("/api/trains/filters", getTrainFilterOptions);

/**
 * @openapi
 * /api/trains/{id}:
 *   get:
 *     tags:
 *       - Trains
 *     summary: Get a train by ID
 *     description: Returns one train matching the requested ID
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The ID of the train to retrieve, such as kiha-261
 *         schema:
 *           type: string
 *         example: kiha-261
 *     responses:
 *       '200':
 *         description: Train retrieved successfully.
 *       '404':
 *         description: Train was not found.
 *       '500':
 *         description: Internal server error.
 */
router.get("/api/trains/:id", getTrainById);

/**
 * @openapi
 * /api/trains/{id}/trips:
 *   get:
 *     tags:
 *       - Trains
 *     summary: Get the trips a train runs
 *     description: >
 *       Returns one page of trips whose trainId matches the requested train.
 *       Supports region, season, and keyword filters with dynamic sorting and pagination.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The ID of the train to look up trips for, such as kiha-261
 *         schema:
 *           type: string
 *         example: kiha-261
 *       - name: page
 *         in: query
 *         schema: { type: integer, default: 1, minimum: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 10, minimum: 1, maximum: 50 }
 *       - name: q
 *         in: query
 *         schema: { type: string, minLength: 1, maxLength: 100 }
 *         description: Searches trip names and descriptions.
 *       - name: region
 *         in: query
 *         schema: { type: string }
 *       - name: season
 *         in: query
 *         schema: { type: string }
 *       - name: sort
 *         in: query
 *         schema: { type: string, enum: [name, region, distance, bestSeason], default: name }
 *       - name: order
 *         in: query
 *         schema: { type: string, enum: [asc, desc], default: asc }
 *     responses:
 *       '200':
 *         description: Returns data, trips compatibility alias, applied query, sort, and pagination metadata.
 *       '400':
 *         description: Invalid pagination, sort, or filter value.
 *       '404':
 *         description: Train was not found.
 *       '500':
 *         description: Internal server error.
 */
router.get("/api/trains/:id/trips", getTripsByTrain);

/**
 * @openapi
 * /api/trains:
 *   post:
 *     tags:
 *       - Trains
 *     summary: Create a train (Admin Only)
 *     description: Creates a new train. The id must be unique and can't be changed later.
 *     security:
 *       - SessionCookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id, name, operator, type, maxSpeedKmh, capacity, powerSource]
 *             properties:
 *               id: { type: string, example: shinkansen-n700 }
 *               name: { type: string, example: N700 Shinkansen }
 *               operator: { type: string, example: JR Central }
 *               type: { type: string, example: High-Speed }
 *               maxSpeedKmh: { type: number, minimum: 0, example: 300 }
 *               capacity: { type: number, minimum: 0, example: 1323 }
 *               powerSource: { type: string, example: Electric }
 *               imageUrl: { type: string, example: /images/trains/series-e353-limited-express.png }
 *               imageAlt: { type: string, example: N700 Shinkansen at a platform }
 *               bestFor: { type: string, example: Fast long-distance travel }
 *               description: { type: string, example: High-speed train for the Tokaido line. }
 *     responses:
 *       '201':
 *         description: Train created.
 *       '400':
 *         description: Missing, invalid, or unknown fields. Returns a list of field errors.
 *       '401':
 *         description: Unauthorized. User is not logged in.
 *       '403':
 *         description: Forbidden. User does not have the admin role.
 *       '409':
 *         description: A train with that id already exists.
 *       '500':
 *         description: Internal server error.
 */
router.post("/api/trains", requireApiLogin, requireApiRole("admin"), createTrain);

/**
 * @openapi
 * /api/trains/{id}:
 *   put:
 *     tags:
 *       - Trains
 *     summary: Update a train (Admin Only)
 *     description: Updates any train fields except id. Only the fields sent are changed.
 *     security:
 *       - SessionCookieAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         example: kiha-261
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               operator: { type: string }
 *               type: { type: string }
 *               maxSpeedKmh: { type: number, minimum: 0 }
 *               capacity: { type: number, minimum: 0 }
 *               powerSource: { type: string }
 *               imageUrl: { type: string }
 *               imageAlt: { type: string }
 *               bestFor: { type: string }
 *               description: { type: string }
 *             example:
 *               capacity: 300
 *               bestFor: Winter sightseeing
 *     responses:
 *       '200':
 *         description: Train updated. Returns the updated train.
 *       '400':
 *         description: Invalid or unknown fields, an id in the body, or no changes. Returns a list of field errors.
 *       '401':
 *         description: Unauthorized. User is not logged in.
 *       '403':
 *         description: Forbidden. User does not have the admin role.
 *       '404':
 *         description: Train was not found.
 *       '500':
 *         description: Internal server error.
 *   delete:
 *     tags:
 *       - Trains
 *     summary: Delete a train (Admin Only)
 *     description: Deletes a train that no trip uses. Trips have to be moved to another train first.
 *     security:
 *       - SessionCookieAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         example: kiha-261
 *     responses:
 *       '200':
 *         description: Train deleted.
 *       '401':
 *         description: Unauthorized. User is not logged in.
 *       '403':
 *         description: Forbidden. User does not have the admin role.
 *       '404':
 *         description: Train was not found.
 *       '409':
 *         description: The train is still assigned to trips. Returns the ids of those trips.
 *       '500':
 *         description: Internal server error.
 */
router.put("/api/trains/:id", requireApiLogin, requireApiRole("admin"), updateTrainById);
router.delete("/api/trains/:id", requireApiLogin, requireApiRole("admin"), deleteTrainById);

/**
 * @openapi
 * /api/trips/{id}/train:
 *   put:
 *     tags:
 *       - Trains
 *     summary: Move a trip to a different train (Admin Only)
 *     description: Changes which train runs a trip. The new train has to exist.
 *     security:
 *       - SessionCookieAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The ID of the trip to move
 *         schema:
 *           type: string
 *         example: alpine-panorama
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [trainId]
 *             properties:
 *               trainId: { type: string, example: kiha-261 }
 *     responses:
 *       '200':
 *         description: Trip moved. Returns the updated trip.
 *       '400':
 *         description: trainId is missing, or no train has that id.
 *       '401':
 *         description: Unauthorized. User is not logged in.
 *       '403':
 *         description: Forbidden. User does not have the admin role.
 *       '404':
 *         description: Trip was not found.
 *       '500':
 *         description: Internal server error.
 */
router.put("/api/trips/:id/train", requireApiLogin, requireApiRole("admin"), moveTripToTrain);

/**
 * @openapi
 * /api/schedules:
 *   get:
 *     tags:
 *       - Schedules
 *     summary: Get schedules
 *     description: Returns one page of schedules, optionally filtered by trip, day, status, or keyword.
 *     parameters:
 *       - name: page
 *         in: query
 *         schema: { type: integer, default: 1, minimum: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 10, minimum: 1, maximum: 50 }
 *       - name: q
 *         in: query
 *         schema: { type: string, minLength: 1, maxLength: 100 }
 *         description: Searches trip ID, departure time, arrival time, and days of week.
 *       - name: tripId
 *         in: query
 *         schema: { type: string }
 *       - name: day
 *         in: query
 *         schema: { type: string, enum: [monday, tuesday, wednesday, thursday, friday, saturday, sunday] }
 *       - name: status
 *         in: query
 *         schema: { type: boolean }
 *       - name: sort
 *         in: query
 *         schema: { type: string, enum: [id, tripId, departureTime, arrivalTime, status], default: id }
 *       - name: order
 *         in: query
 *         schema: { type: string, enum: [asc, desc], default: asc }
 *     responses:
 *       '200':
 *         description: Returns data, applied query, sort, and pagination metadata.
 *       '400':
 *         description: Invalid pagination, sort, or filter value.
 *       '500':
 *         description: Internal server error
 */
router.get("/api/schedules", getAllSchedules);
/**
 * @openapi
 * /api/admin/schedules:
 *   get:
 *     tags: [Schedules]
 *     summary: Get schedules with booking-use indicators (Admin Only)
 *     description: Returns the filtered schedule list with a hasBookings flag for each schedule. Booked schedules can be inactivated, but their departure times and operating days cannot be changed.
 *     security:
 *       - SessionCookieAuth: []
 *     responses:
 *       '200': { description: Schedule list with booking-use indicators. }
 *       '401': { description: Authentication required. }
 *       '403': { description: Administrator role required. }
 *       '500': { description: Internal server error. }
 */
router.get(
    "/api/admin/schedules",
    requireApiLogin,
    requireApiRole("admin"),
    getAdminSchedules
);

/**
 * @openapi
 * /api/schedules/{id}:
 *   get:
 *     tags:
 *       - Schedules
 *     summary: Get a schedule by ID
 *     description: Returns one schedule matching the requested ID
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The ID of the schedule to retrieve, such as 1
 *         schema:
 *           type: integer
 *           format: int32
 *         example: 1
 *     responses:
 *       '200':
 *         description: Schedule retrieved successfully.
 *       '400':
 *         description: Schedule ID must be an integer.
 *       '404':
 *         description: Schedule was not found.
 *       '500':
 *         description: Internal server error.
 */
router.get("/api/schedules/:id", getScheduleById);

/**
 * @openapi
 * /api/trips/{tripId}/schedules:
 *   get:
 *     tags:
 *       - Schedules
 *     summary: Get schedules for a trip
 *     description: Returns one page of schedules for a trip and an availability object. Trips without an existing linked train remain visible but cannot be booked.
 *     parameters:
 *       - name: tripId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         example: alpine-panorama
 *       - name: month
 *         in: query
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *         example: 10
 *       - name: page
 *         in: query
 *         schema: { type: integer, default: 1, minimum: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 10, minimum: 1, maximum: 50 }
 *       - name: q
 *         in: query
 *         schema: { type: string, minLength: 1, maxLength: 100 }
 *       - name: day
 *         in: query
 *         schema: { type: string, enum: [monday, tuesday, wednesday, thursday, friday, saturday, sunday] }
 *       - name: status
 *         in: query
 *         schema: { type: boolean }
 *       - name: sort
 *         in: query
 *         schema: { type: string, enum: [id, tripId, departureTime, arrivalTime, status], default: id }
 *       - name: order
 *         in: query
 *         schema: { type: string, enum: [asc, desc], default: asc }
 *     responses:
 *       '200':
 *         description: Returns data, applied query, sort, pagination metadata, and trip availability. A month outside the trip's operating months returns an empty page.
 *       '400':
 *         description: Invalid month value.
 *       '404':
 *         description: Trip was not found.
 *       '500':
 *         description: Internal server error.
 */
router.get("/api/trips/:tripId/schedules", validateMonth, (req, res, next) => {
    if (req.query.month !== undefined) {
        return getSchedulesByTripAndMonth(req, res, next);
    }
    return getSchedulesByTripId(req, res, next);
});

/**
 * @openapi
 * /api/trips/{tripId}/schedules:
 *   post:
 *     tags: [Schedules]
 *     summary: Create a schedule owned by a trip (Admin Only)
 *     description: Creates a new schedule record for this trip. Schedules belong to exactly one trip; create a separate record to use the same times for another trip.
 *     security:
 *       - SessionCookieAuth: []
 *     parameters:
 *       - name: tripId
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [departureTime, arrivalTime, daysOfWeek]
 *             properties:
 *               departureTime: { type: string, pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' }
 *               arrivalTime: { type: string, pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' }
 *               daysOfWeek:
 *                 type: array
 *                 items: { type: string, enum: [monday, tuesday, wednesday, thursday, friday, saturday, sunday] }
 *               status: { type: boolean, default: true }
 *     responses:
 *       '201': { description: Schedule created. }
 *       '400': { description: Invalid schedule information. }
 *       '401': { description: Authentication required. }
 *       '403': { description: Administrator role required. }
 *       '404': { description: Trip was not found. }
 *       '409': { description: Schedule ID conflict; retry the request. }
 *       '500': { description: Internal server error. }
 */
router.post(
    "/api/trips/:tripId/schedules",
    requireApiLogin,
    requireApiRole("admin"),
    createScheduleForTrip
);

/**
 * @openapi
 * /api/schedules/{id}:
 *   put:
 *     tags: [Schedules]
 *     summary: Update a schedule's times and operating days (Admin Only)
 *     description: Updates schedule details without changing its owning trip. Ownership cannot be transferred, and booked departure times or operating days cannot be changed.
 *     security:
 *       - SessionCookieAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               departureTime: { type: string, pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' }
 *               arrivalTime: { type: string, pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' }
 *               daysOfWeek:
 *                 type: array
 *                 items: { type: string, enum: [monday, tuesday, wednesday, thursday, friday, saturday, sunday] }
 *               status: { type: boolean }
 *     responses:
 *       '200': { description: Schedule updated. }
 *       '400': { description: Invalid schedule information or attempted ownership change. }
 *       '401': { description: Authentication required. }
 *       '403': { description: Administrator role required. }
 *       '404': { description: Schedule was not found. }
 *       '409': { description: Schedule times or operating days are in use by bookings. }
 *       '500': { description: Internal server error. }
 */
router.put(
    "/api/schedules/:id",
    requireApiLogin,
    requireApiRole("admin"),
    updateScheduleById
);

/**
 * @openapi
 * /api/stations:
 *   get:
 *     tags:
 *       - Stations
 *     summary: Get stations
 *     description: Returns one page of stations, optionally filtered by keyword, region, prefecture, or facility.
 *     parameters:
 *       - name: page
 *         in: query
 *         schema: { type: integer, default: 1, minimum: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 10, minimum: 1, maximum: 50 }
 *       - name: q
 *         in: query
 *         schema: { type: string, minLength: 1, maxLength: 100 }
 *       - name: region
 *         in: query
 *         schema: { type: string }
 *       - name: prefecture
 *         in: query
 *         schema: { type: string }
 *       - name: facility
 *         in: query
 *         schema: { type: string }
 *       - name: sort
 *         in: query
 *         schema: { type: string, enum: [id, name, prefecture, region], default: id }
 *       - name: order
 *         in: query
 *         schema: { type: string, enum: [asc, desc], default: asc }
 *     responses:
 *       '200':
 *         description: Returns data, applied query, sort, and pagination metadata.
 *       '400':
 *         description: Invalid pagination, sort, or filter value.
 *       '500':
 *         description: Internal server error
 */
router.get("/api/stations", getAllStations);

/**
 * @openapi
 * /api/stations/filters:
 *   get:
 *     tags: [Stations]
 *     summary: Get station filter options
 *     responses:
 *       '200': { description: Available regions, prefectures, and facilities. }
 *       '500': { description: Internal server error. }
 */
router.get("/api/stations/filters", getStationFilterOptions);

/**
 * @openapi
 * /api/admin/stations:
 *   get:
 *     tags: [Stations]
 *     summary: Get stations with trip usage indicators (Admin Only)
 *     description: Returns the filtered, paginated stations and an inUse flag. Stations referenced by a trip cannot be modified or deleted.
 *     security:
 *       - SessionCookieAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema: { type: integer, default: 1, minimum: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 10, minimum: 1, maximum: 50 }
 *       - name: q
 *         in: query
 *         schema: { type: string, minLength: 1, maxLength: 100 }
 *       - name: region
 *         in: query
 *         schema: { type: string }
 *       - name: prefecture
 *         in: query
 *         schema: { type: string }
 *       - name: facility
 *         in: query
 *         schema: { type: string }
 *       - name: sort
 *         in: query
 *         schema: { type: string, enum: [id, name, prefecture, region], default: id }
 *       - name: order
 *         in: query
 *         schema: { type: string, enum: [asc, desc], default: asc }
 *     responses:
 *       '200': { description: Paginated station records with inUse flags. }
 *       '400': { description: Invalid pagination, sort, or filter value. }
 *       '401': { description: Authentication required. }
 *       '403': { description: Administrator role required. }
 *       '500': { description: Internal server error. }
 */
router.get(
    "/api/admin/stations",
    requireApiLogin,
    requireApiRole("admin"),
    getAdminStations
);

/**
 * @openapi
 * /api/stations:
 *   post:
 *     tags: [Stations]
 *     summary: Create a station (Admin Only)
 *     security:
 *       - SessionCookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id, name]
 *             properties:
 *               id: { type: string, pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' }
 *               name: { type: string, minLength: 1, maxLength: 100 }
 *               prefecture: { type: string, maxLength: 100 }
 *               region: { type: string, maxLength: 100 }
 *               facilities: { type: array, maxItems: 30, items: { type: string, maxLength: 60 } }
 *               description: { type: string, maxLength: 500 }
 *     responses:
 *       '201': { description: Station created. }
 *       '400': { description: Invalid station information. }
 *       '401': { description: Authentication required. }
 *       '403': { description: Administrator role required. }
 *       '409': { description: Station ID already exists. }
 *       '500': { description: Internal server error. }
 */
router.post(
    "/api/stations",
    requireApiLogin,
    requireApiRole("admin"),
    createStationRecord
);

/**
 * @openapi
 * /api/stations/{id}:
 *   get:
 *     tags:
 *       - Stations
 *     summary: Get a station by ID or name
 *     description: Returns one station matching the requested ID or exact display name, case-insensitively.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The ID of the station to retrieve, such as nagoya
 *         schema:
 *           type: string
 *         example: nagoya
 *     responses:
 *       '200':
 *         description: Station retrieved successfully.
 *       '404':
 *         description: Station was not found.
 *       '500':
 *         description: Internal server error
 */
router.get("/api/stations/:id", getStationById);

/**
 * @openapi
 * /api/stations/{id}:
 *   put:
 *     tags: [Stations]
 *     summary: Update a station (Admin Only)
 *     description: Updates station details. IDs are immutable, and a station referenced by any trip cannot be modified.
 *     security:
 *       - SessionCookieAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               name: { type: string, minLength: 1, maxLength: 100 }
 *               prefecture: { type: string, maxLength: 100 }
 *               region: { type: string, maxLength: 100 }
 *               facilities: { type: array, maxItems: 30, items: { type: string, maxLength: 60 } }
 *               description: { type: string, maxLength: 500 }
 *     responses:
 *       '200': { description: Station updated. }
 *       '400': { description: Invalid station information or attempted ID change. }
 *       '401': { description: Authentication required. }
 *       '403': { description: Administrator role required. }
 *       '404': { description: Station not found. }
 *       '409': { description: Station is used by a trip and cannot be modified. }
 *       '500': { description: Internal server error. }
 *   delete:
 *     tags: [Stations]
 *     summary: Delete a station (Admin Only)
 *     description: Deletes a station only when no trip references its ID or display name.
 *     security:
 *       - SessionCookieAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '204': { description: Station deleted. }
 *       '401': { description: Authentication required. }
 *       '403': { description: Administrator role required. }
 *       '404': { description: Station not found. }
 *       '409': { description: Station is used by a trip and cannot be deleted. }
 *       '500': { description: Internal server error. }
 */
router.put(
    "/api/stations/:id",
    requireApiLogin,
    requireApiRole("admin"),
    updateStationRecord
);
router.delete(
    "/api/stations/:id",
    requireApiLogin,
    requireApiRole("admin"),
    deleteStationRecord
);

/**
 * @openapi
 * /api/trips:
 *   post:
 *     tags:
 *       - Trips
 *     summary: Create a trip (Admin Only)
 *     description: Creates a trip with an existing train and stations and at least one initial schedule. Additional schedules can be added through the trip-specific schedules endpoint.
 *     security:
 *       - SessionCookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id, name, description, startStation, endStation, trainId, duration, distance, schedules]
 *             properties:
 *               id: { type: string, pattern: '^[a-z0-9]+(-[a-z0-9]+)*$', example: coastal-express }
 *               name: { type: string, example: Coastal Express }
 *               description: { type: string }
 *               startStation: { type: string, example: aomori }
 *               endStation: { type: string, example: akita }
 *               trainId: { type: string, example: series-e353 }
 *               region: { type: string, example: tohoku }
 *               duration: { type: string, example: 4.5 hours }
 *               distance: { type: number, minimum: 0 }
 *               bestSeason: { type: string, example: autumn }
 *               operatingMonths:
 *                 type: array
 *                 items: { type: integer, minimum: 1, maximum: 12 }
 *               highlights:
 *                 type: array
 *                 items: { type: string }
 *               imageUrl: { type: string }
 *               schedules:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [departureTime, arrivalTime, daysOfWeek]
 *                   properties:
 *                     departureTime: { type: string, pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' }
 *                     arrivalTime: { type: string, pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' }
 *                     daysOfWeek:
 *                       type: array
 *                       minItems: 1
 *                       items: { type: string, enum: [monday, tuesday, wednesday, thursday, friday, saturday, sunday] }
 *     responses:
 *       '201':
 *         description: Trip created successfully.
 *       '400':
 *         description: Invalid trip details, train, or station.
 *       '401':
 *         description: Authentication required.
 *       '403':
 *         description: Administrator role required.
 *       '409':
 *         description: Trip ID already exists.
 *       '500':
 *         description: Internal server error.
 *   get:
 *     tags:
 *       - Trips
 *     summary: Get a paginated, filterable list of trips
 *     description: >
 *       Returns trips one page at a time, sorted by the chosen field, and optionally filtered
 *       by region/season or a keyword search across name and description.
 *       A page beyond the last one returns an empty data array with a 200.
 *       Invalid page, limit, sort, or filter values return 400.
 *     parameters:
 *       - name: page
 *         in: query
 *         description: Page number, starting at 1
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *       - name: limit
 *         in: query
 *         description: Trips per page
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 50
 *       - name: sort
 *         in: query
 *         description: Field to sort by
 *         schema:
 *           type: string
 *           default: name
 *           enum:
 *             - name
 *             - region
 *             - startStation
 *             - endStation
 *             - distance
 *             - bestSeason
 *       - name: order
 *         in: query
 *         description: Sort direction
 *         schema:
 *           type: string
 *           default: asc
 *           enum: [asc, desc]
 *       - name: region
 *         in: query
 *         description: Exact, case-insensitive match on a trip's region. Omit or pass "all" for no filter.
 *         schema:
 *           type: string
 *         example: central
 *       - name: season
 *         in: query
 *         description: Exact, case-insensitive match on a trip's bestSeason. Omit or pass "all" for no filter.
 *         schema:
 *           type: string
 *         example: autumn
 *       - name: search
 *         in: query
 *         description: Case-insensitive keyword search across a trip's name and description. Max 100 characters.
 *         schema:
 *           type: string
 *         example: gorge
 *       - name: availability
 *         in: query
 *         description: Filter by whether a trip has both a linked train and at least one active schedule.
 *         schema:
 *           type: string
 *           enum: [available, unavailable, all]
 *           default: all
 *       - name: scheduleStatus
 *         in: query
 *         description: Filter by schedule coverage. "missing" means no active schedules; "none" means no schedule records at all.
 *         schema:
 *           type: string
 *           enum: [all, configured, missing, none]
 *           default: all
 *     responses:
 *       '200':
 *         description: Trips retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       region:
 *                         type: string
 *                       startStation:
 *                         type: string
 *                       endStation:
 *                         type: string
 *                       duration:
 *                         type: string
 *                       distance:
 *                         type: number
 *                       highlights:
 *                         type: array
 *                         items:
 *                           type: string
 *                       bestSeason:
 *                         type: string
 *                       operatingMonths:
 *                         type: array
 *                         items:
 *                           type: integer
 *                       imageUrl:
 *                         type: string
 *                       availability:
 *                         type: object
 *                         properties:
 *                           isAvailable:
 *                             type: boolean
 *                             description: True only when the trip has a linked train and at least one active schedule.
 *                           message:
 *                             type: string
 *                             nullable: true
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     totalItems:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     hasNextPage:
 *                       type: boolean
 *                     hasPreviousPage:
 *                       type: boolean
 *       '400':
 *         description: Invalid page, limit, sort, or filter value
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       field:
 *                         type: string
 *                       message:
 *                         type: string
 *       '500':
 *         description: Internal error
 */
router.post(
    "/api/trips",
    requireApiLogin,
    requireApiRole("admin"),
    createTrip
);
router.get("/api/trips", getPaginatedTripsList);



/**
 * @openapi
 * /api/trips/{id}:
 *   get:
 *     tags:
 *       - Trips
 *     summary: Get a trip by ID
 *     description: Returns one trip matching the requested ID, including whether its linked train makes it available for booking.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The ID of the trip to retrieve, such as alpine-panorama
 *         schema:
 *           type: string
 *           example: alpine-panorama
 *     responses:
 *       '200':
 *         description: Trip retrieved successfully with availability.isAvailable and availability.message indicating booking eligibility.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 trainId:
 *                   type: string
 *                 availability:
 *                   type: object
 *                   required: [isAvailable, message]
 *                   properties:
 *                     isAvailable:
 *                       type: boolean
 *                     message:
 *                       type: string
 *                       nullable: true
 *       '404':
 *         description: Trip was not found
 *       '500':
 *         description: Internal server error
 */
router.get("/api/trips/:id", getTripById);

/**
 * @openapi
 * /api/trips/{id}:
 *   put:
 *     tags:
 *       - Trips
 *     summary: Update an existing trip (Admin Only)
 *     description: Updates trip details, including its linked train, region, duration, season, operating months, highlights, and image URL. Station values may be station names or IDs. Schedule ownership is managed through the trip-specific schedules endpoint and cannot be transferred.
 *     security:
 *       - SessionCookieAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The custom unique string identifier of the trip to update
 *         schema:
 *           type: string
 *           example: alpine-panorama
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Alpine Panorama Express"
 *               description:
 *                 type: string
 *                 example: "Journey through the Japanese Alps with stunning mountain views and traditional villages."
 *               startStation:
 *                 type: string
 *                 example: "Nagoya Station"
 *               endStation:
 *                 type: string
 *                 example: "Toyama Station"
 *               distance:
 *                 type: number
 *                 minimum: 0
 *                 example: 180
 *               trainId:
 *                 type: string
 *                 description: ID of an existing train to link to this trip.
 *                 example: series-e353
 *               region:
 *                 type: string
 *                 example: central
 *               duration:
 *                 type: string
 *                 example: 4.5 hours
 *               bestSeason:
 *                 type: string
 *                 example: autumn
 *               operatingMonths:
 *                 type: array
 *                 items:
 *                   type: integer
 *                   minimum: 1
 *                   maximum: 12
 *                 example: [4, 5, 6, 7, 8, 9, 10, 11]
 *               highlights:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Mountain views", "Traditional villages"]
 *               imageUrl:
 *                 type: string
 *                 format: uri
 *                 example: "/images/routes/alpine-panorama.png"
 *             example:
 *               name: Alpine Panorama Express
 *               description: Journey through the Japanese Alps with stunning mountain views and traditional villages.
 *               startStation: Nagoya Station
 *               endStation: Toyama Station
 *               distance: 180
 *     responses:
 *       '200':
 *         description: Trip details updated successfully.
 *       '400':
 *         description: Bad Request. A field is invalid or unsupported.
 *       '401':
 *         description: Unauthorized. User is not logged into the session.
 *       '403':
 *         description: Forbidden. Authenticated user does not have the admin role.
 *       '404':
 *         description: Trip was not found matching the custom ID.
 *       '500':
 *         description: Internal server error
 */
router.put(
    "/api/trips/:id",
    requireApiLogin,
    requireApiRole("admin"),
    updateTrip
);

/**
 * @openapi
 * /api/trips/{id}:
 *   delete:
 *     tags:
 *       - Trips
 *     summary: Delete a trip (Admin Only)
 *     description: Deletes a trip and its schedules only when the trip has no bookings.
 *     security:
 *       - SessionCookieAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: The custom unique string identifier of the trip to delete
 *         schema:
 *           type: string
 *           example: alpine-panorama
 *     responses:
 *       '200':
 *         description: Trip and its associated schedules deleted successfully.
 *       '401':
 *         description: Unauthorized. User is not logged into the session.
 *       '403':
 *         description: Forbidden. Authenticated user does not have the admin role.
 *       '404':
 *         description: Trip was not found matching the custom ID.
 *       '409':
 *         description: Trip has bookings and cannot be deleted.
 *       '500':
 *         description: Internal server error
 */
router.delete(
    "/api/trips/:id",
    requireApiLogin,
    requireApiRole("admin"),
    deleteTrip
);

/**
 * @openapi
 * /api/bookings:
 *   get:
 *     summary: Get all bookings
 *     tags:
 *       - Bookings
 *     description: Admins see all bookings. Other signed-in users see bookings they created or are listed as a passenger on.
 *     security:
 *       - SessionCookieAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema: { type: integer, default: 1, minimum: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 10, minimum: 1, maximum: 50 }
 *       - name: q
 *         in: query
 *         schema: { type: string, minLength: 1, maxLength: 100 }
 *         description: Searches confirmation ID, trip ID, and passenger names or emails.
 *       - name: scope
 *         in: query
 *         schema: { type: string, enum: [all, mine], default: all }
 *         description: Admins may choose either scope; other users are always restricted to their own bookings.
 *       - name: ticketClass
 *         in: query
 *         schema: { type: string }
 *       - name: tripId
 *         in: query
 *         schema: { type: string }
 *       - name: startDate
 *         in: query
 *         schema: { type: string, format: date }
 *       - name: endDate
 *         in: query
 *         schema: { type: string, format: date }
 *       - name: sort
 *         in: query
 *         schema: { type: string, enum: [createdAt, selectedDay, ticketClass, tripId, scheduleId, id], default: createdAt }
 *       - name: order
 *         in: query
 *         schema: { type: string, enum: [asc, desc], default: asc }
 *     responses:
 *       '200':
 *         description: Returns data, bookings compatibility alias, applied query, sort, and pagination metadata.
 *       '400':
 *         description: Invalid pagination, sort, or filter value.
 *       '401':
 *         description: Authentication required.
 *       '500':
 *         description: Failed to fetch bookings.
 *   post:
 *     tags: [Bookings]
 *     summary: Create a booking
 *     description: Creates a booking for the signed-in user. The caller becomes the booking creator.
 *     security:
 *       - SessionCookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: false
 *             required: [scheduleId, tripId, ticketClass, selectedDay, passengers]
 *             properties:
 *               scheduleId:
 *                 type: integer
 *                 example: 1
 *               tripId:
 *                 type: string
 *                 example: alpine-panorama
 *               ticketClass:
 *                 type: string
 *                 enum: [standard, premium, first]
 *                 example: standard
 *               selectedDay:
 *                 type: string
 *                 enum: [monday, tuesday, wednesday, thursday, friday, saturday, sunday]
 *                 example: monday
 *               passengers:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 8
 *                 items:
 *                   type: object
 *                   additionalProperties: false
 *                   required: [firstName, lastName, email, phone]
 *                   properties:
 *                     firstName:
 *                       type: string
 *                       example: Hector
 *                     lastName:
 *                       type: string
 *                       example: Tanaka
 *                     email:
 *                       type: string
 *                       format: email
 *                       example: hector@example.com
 *                     phone:
 *                       type: string
 *                       example: +81 90-1234-5678
 *           example:
 *             scheduleId: 1
 *             tripId: alpine-panorama
 *             ticketClass: standard
 *             selectedDay: monday
 *             passengers:
 *               - firstName: Hector
 *                 lastName: Tanaka
 *                 email: hector@example.com
 *                 phone: +81 90-1234-5678
 *     responses:
 *       '201':
 *         description: Booking created successfully.
 *       '400':
 *         description: Booking details are invalid or the schedule, day, or ticket class is unavailable.
 *       '401':
 *         description: Authentication required.
 *       '404':
 *         description: Schedule not found.
 *       '409':
 *         description: The trip is temporarily unavailable because it has no existing linked train, or the booking confirmation ID already exists.
 *       '500':
 *         description: Failed to create booking.
 */
router.get("/api/bookings", requireApiLogin, getAllBookings);
router.post("/api/bookings", requireApiLogin, createBookingApi);

/**
 * @openapi
 * /api/bookings/{id}/upgrade-quote:
 *   get:
 *     tags: [Bookings]
 *     summary: Quote a booking ticket upgrade
 *     description: Calculates the additional fare for every seat in a booking. No payment is processed.
 *     security:
 *       - SessionCookieAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         example: JRN69ZGP6Y
 *       - name: ticketClass
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           enum: [premium, first]
 *         example: premium
 *     responses:
 *       '200':
 *         description: Upgrade quote returned.
 *       '400':
 *         description: Invalid ticket class or the selected class is not an upgrade.
 *       '401':
 *         description: Authentication required.
 *       '403':
 *         description: Only the booking creator or an admin may upgrade it.
 *       '404':
 *         description: Booking not found.
 *       '500':
 *         description: Failed to calculate upgrade price.
 */
router.get(
    "/api/bookings/:id/upgrade-quote",
    requireApiLogin,
    getBookingUpgradeQuote
);

/**
 * @openapi
 * /api/bookings/{id}:
 *   get:
 *     tags:
 *       - Bookings
 *     summary: Get a booking by ID
 *     description: Returns one booking to its owner or an admin.
 *     security:
 *       - SessionCookieAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         example: JRN69ZGP6Y
 *     responses:
 *       '200':
 *         description: Booking returned successfully.
 *       '401':
 *         description: Missing or invalid session.
 *       '403':
 *         description: Forbidden.
 *       '404':
 *         description: Booking not found.
 *       '500':
 *         description: Unable to retrieve booking.
 */
router.get("/api/bookings/:id", requireApiLogin, getBookingById);

/**
 * @openapi
 * /api/users/{userId}/bookings:
 *   get:
 *     tags:
 *       - Bookings
 *     summary: Get bookings for a user
 *     description: Users may retrieve bookings they created or are listed as a passenger on; admins may retrieve any user's bookings. Results use the standard paginated list response.
 *     security:
 *       - SessionCookieAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         example: 6ab9358a87b7afeb8a3794b1
 *       - name: page
 *         in: query
 *         schema: { type: integer, default: 1, minimum: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 10, minimum: 1, maximum: 50 }
 *       - name: q
 *         in: query
 *         schema: { type: string, minLength: 1, maxLength: 100 }
 *       - name: ticketClass
 *         in: query
 *         schema: { type: string }
 *       - name: tripId
 *         in: query
 *         schema: { type: string }
 *       - name: startDate
 *         in: query
 *         schema: { type: string, format: date }
 *       - name: endDate
 *         in: query
 *         schema: { type: string, format: date }
 *       - name: sort
 *         in: query
 *         schema: { type: string, enum: [createdAt, selectedDay, ticketClass, tripId, scheduleId, id], default: createdAt }
 *       - name: order
 *         in: query
 *         schema: { type: string, enum: [asc, desc], default: asc }
 *     responses:
 *       '200':
 *         description: User bookings returned with applied query and pagination metadata.
 *       '400':
 *         description: Invalid user ID.
 *       '401':
 *         description: Authentication required.
 *       '403':
 *         description: Forbidden for other users.
 *       '404':
 *         description: User not found or user has no bookings.
 *       '500':
 *         description: Failed to fetch bookings.
 */
router.get(
    "/api/users/:userId/bookings",
    requireApiSelfOrAdmin,
    getBookingsByUserId
);

/**
 * @openapi
 * /api/bookings/{id}:
 *   put:
 *     summary: Update a booking
 *     tags:
 *       - Bookings
 *     description: The booking creator or an admin may edit passenger details or upgrade every seat to a higher ticket class. Unknown fields are rejected, and only one update operation may be sent per request. No payment is processed.
 *     security:
 *       - SessionCookieAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 additionalProperties: false
 *                 required: [passengers]
 *                 properties:
 *                   passengers:
 *                     type: array
 *                     minItems: 1
 *                     maxItems: 8
 *                     items:
 *                       type: object
 *                       additionalProperties: false
 *                       required: [firstName, lastName, email, phone]
 *                       properties:
 *                         firstName: { type: string }
 *                         lastName: { type: string }
 *                         email: { type: string, format: email }
 *                         phone: { type: string }
 *               - type: object
 *                 additionalProperties: false
 *                 required: [ticketClass]
 *                 properties:
 *                   ticketClass: { type: string, enum: [premium, first] }
 *     responses:
 *       200:
 *         description: Booking upgraded successfully
 *       400:
 *         description: Invalid passenger details or a ticket class that is not an upgrade.
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not authorized to edit this booking
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Failed to update booking.
 *   delete:
 *     summary: Delete a booking
 *     tags:
 *       - Bookings
 *     description: The booking creator or an admin may delete the entire booking.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Booking deleted successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not authorized to delete this booking
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Failed to delete booking.
 */
router.put("/api/bookings/:id", requireApiLogin, updateBookingById);

/**
 * @openapi
 * /api/bookings/{id}:
 *   delete:
 *     summary: Delete a booking
 *     tags:
 *       - Bookings
 *     description: The booking creator or an admin may delete the entire booking.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Booking deleted successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not authorized to delete this booking
 *       404:
 *         description: Booking not found
 *       500:
 *         description: Failed to delete booking.
 */
router.delete("/api/bookings/:id", requireApiLogin, deleteBookingById);

/**
 * @openapi
 * /api/bookings_paginated:
 *   get:
 *     summary: Retrieve paginated bookings
 *     description: Admins may view all bookings or their own. Non-admin users are always restricted to bookings they created or are listed as passengers on.
 *     tags:
 *       - Bookings
 *     parameters:
 *       - name: page
 *         in: query
 *         description: The page number to retrieve (default is 1)
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - name: limit
 *         in: query
 *         description: The number of bookings to retrieve per page (default is 10, maximum is 50)
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *       - name: sort
 *         in: query
 *         description: The field to sort by. Allowed values are 'createdAt', 'selectedDay', 'ticketClass', 'tripId', 'scheduleId', and 'id'.
 *         required: false
 *         schema:
 *           type: string
 *           enum: [createdAt, selectedDay, ticketClass, tripId, scheduleId, id]
 *       - name: order
 *         in: query
 *         description: The order of sorting (default is 'asc'). Use 'desc' for descending order.
 *         required: false
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *       - name: startDate
 *         in: query
 *         description: "Inclusive start date for the booking creation date (format: YYYY-MM-DD)"
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *       - name: endDate
 *         in: query
 *         description: "Inclusive end date for the booking creation date (format: YYYY-MM-DD)"
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *       - name: q
 *         in: query
 *         description: Searches confirmation ID, trip ID, and passenger names or emails (maximum 100 characters).
 *         required: false
 *         schema:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *       - name: tripId
 *         in: query
 *         description: Filter bookings by trip ID.
 *         required: false
 *         schema:
 *           type: string
 *       - name: ticketClass
 *         in: query
 *         description: Filter bookings by ticket class (e.g., 'standard', 'premium', 'first')
 *         required: false
 *         schema:
 *           type: string
 *           enum: [standard, premium, first]
 *       - name: scope
 *         in: query
 *         description: Admins may request all bookings or only their own. Non-admin users are always limited to their own bookings.
 *         required: false
 *         schema:
 *           type: string
 *           enum: [all, mine]
 *
 *
 *     responses:
 *       200:
 *         description: Standard paginated response with compatibility aliases for existing clients.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *                   description: Page, limit, totalItems, totalPages, hasNextPage, and hasPreviousPage.
 *                 query:
 *                   type: object
 *                   description: Applied filters and scope.
 *                 sort:
 *                   type: object
 *                   description: Applied sort field and direction.
 *                 total:
 *                   type: integer
 *                   description: Total number of bookings
 *                 page:
 *                   type: integer
 *                   description: Current page number
 *                 limit:
 *                   type: integer
 *                   description: Number of bookings per page
 *                 bookings:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: The booking ID
 *                       userId:
 *                         type: string
 *                         description: The ID of the user who made the booking
 *                       scheduleId:
 *                         type: integer
 *                         description: The schedule ID associated with the booking
 *                       tripId:
 *                         type: string
 *                         description: The trip ID associated with the booking
 *                       ticketClass:
 *                         type: string
 *                         description: The class of the ticket booked
 *                       selectedDay:
 *                         type: string
 *                         description: The selected day for the booking
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         description: The date and time when the booking was created
 *       400:
 *         description: Invalid pagination or sorting parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       field:
 *                         type: string
 *                         description: The field that caused the error
 *                       message:
 *                         type: string
 *                         description: The error message
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error message
 */
router.get("/api/bookings_paginated", requireApiLogin, getPaginatedBookings);

/**
 * @openapi
 * /api/ticket-classes:
 *   get:
 *     tags:
 *       - Ticket Classes
 *     summary: Get ticket classes
 *     description: Returns one page of ticket classes, optionally filtered by day, class, or a keyword search.
 *     parameters:
 *       - name: page
 *         in: query
 *         schema: { type: integer, default: 1, minimum: 1 }
 *       - name: limit
 *         in: query
 *         schema: { type: integer, default: 10, minimum: 1, maximum: 50 }
 *       - name: q
 *         in: query
 *         schema: { type: string, minLength: 1, maxLength: 100 }
 *         description: Searches ticket class names and descriptions.
 *       - name: class
 *         in: query
 *         schema: { type: string }
 *         description: Filters by an exact ticket class name.
 *       - name: day
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           example: Monday
 *         description: The day of the week to filter ticket availability.
 *       - name: sort
 *         in: query
 *         schema: { type: string, enum: [class, name, priceMultiplier], default: class }
 *       - name: order
 *         in: query
 *         schema: { type: string, enum: [asc, desc], default: asc }
 *     responses:
 *       '200':
 *         description: Returns data, applied query, sort, and pagination metadata.
 *       '400':
 *         description: Invalid pagination, sort, or filter value.
 *       '500':
 *         description: Internal server error.
 */

router.get("/api/ticket-classes", (req, res, next) => {
    if (req.query.day !== undefined) {
        return getTicketClassesForDay(req, res, next);
    }
    return getAllTicketClasses(req, res, next);
});

export default router;
