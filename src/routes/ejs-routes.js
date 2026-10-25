import { Router } from "express";
import {
    homePage,
    aboutPage,
    testErrorPage,
    registerPage,
    loginPage,
    dashboardPage,
    adminDashboardPage,
    adminUsersPage,
    adminTripPage,
} from "../controllers/index.js";
import {
    bookingPage,
    processBookingRequest,
    bookingsPage,
    confirmationPage,
} from "../controllers/bookings.js";
import { trainsPage, trainDetailsPage, trainsAdminPage } from "../controllers/trains.js";
import { getTripsList, getTripDetails } from "../controllers/trips.js";

import { accountPage, register } from "../controllers/users.js";
import { login, logout } from "../controllers/login.js";

import {
    requireApiGuestOrAdmin,
    requirePageGuestOrAdmin,
    requirePageLogin,
    requirePageRole,
} from "../middleware/authentication.js";

const router = Router();

// Home page
router.get("/", homePage);

// About page
router.get("/about", aboutPage);

// Trains page
router.get("/trains", trainsPage);
router.get("/trains/:id", trainDetailsPage);

// Personal bookings are scoped to the signed-in user, including for admins.
router.get("/bookings", requirePageLogin, (req, res) =>
    bookingsPage(req, res, { personal: true })
);

// Test 500 error page
router.get("/500", testErrorPage);

// Trips List Page
router.get("/trips", getTripsList);

// Trips Details Page
router.get("/trips/:tripId", getTripDetails);

// Book ticket
router.get("/trips/booking/:scheduleId", bookingPage);
router.post("/trips/book", requirePageLogin, processBookingRequest);

// Booking confirmation page
router.get("/trips/confirmation/:bookingId", confirmationPage);

// Login page
router.get("/login", requirePageGuestOrAdmin, loginPage);
router.post("/login", requirePageGuestOrAdmin, login);
router.post("/logout", requirePageLogin, logout);
router.post("/register", requirePageGuestOrAdmin, register);
router.get("/register", requirePageGuestOrAdmin, registerPage);

// Signed-in dashboard and personal account; /account loads only the current user's record but reuses the same page template.
router.get("/dashboard", requirePageLogin, dashboardPage);
router.get("/account-user", requirePageLogin, accountPage);

// Admin landing page and user list; the user list loads all users for admins.
router.get("/admin", requirePageRole("admin"), adminDashboardPage);
router.get("/admin/users", requirePageLogin, adminUsersPage);
router.get("/trips-admin", requirePageLogin, requirePageRole("admin"), adminTripPage);
router.get("/trains-admin", requirePageLogin, requirePageRole("admin"), trainsAdminPage);

// The admin bookings page can manage all bookings.
router.get(
    "/bookings-admin",
    requirePageLogin,
    requirePageRole("admin"),
    bookingsPage
);

export default router;
