import { getTripFilters } from "../models/trips.js";

const homePage = (req, res) => {
    res.render("home", { title: "Kizuna Rail" });
};

const aboutPage = (req, res) => {
    res.render("about", { title: "About" });
};

const dashboardPage = (req, res) => {
    res.render("dashboard", { title: "Dashboard" });
};

const testErrorPage = (req, res, next) => {
    const err = new Error(
        "This is a test error so you can see what it looks like."
    );
    err.status = 500;
    next(err);
};

const loginPage = (req, res) => {
    res.render("login", { title: "Login" });
};

const registerPage = (req, res) => {
    res.render("register", {
        title: "Register",
        isAdmin: res.locals.isAdmin,
    });
};

const adminDashboardPage = (req, res) => {
    console.log("Rendering admin dashboard for user:", req.user);
    res.render("admin", { title: "Admin Dashboard" });
};

const adminUsersPage = (req, res) => {
    const isAdmin = res.locals.isAdmin;
    res.render("users", {
        title: isAdmin ? "Admin Users" : "Your Account",
        usersEndpoint: isAdmin ? "/api/users" : `/api/users/${req.user._id}`,
        isAdmin,
        isAdminList: isAdmin,
    });
};

const adminTripPage = async (req, res) => {
    try {
        const { regions, seasons } = await getTripFilters();
        res.render("trips/admin-trips", {
            title: "Manage Trips",
            regions,
            seasons,
        });
    } catch (error) {
        console.error("Error loading admin trips page:", error);
        res.status(500).render("errors/500", {
            title: "Server Error",
            error: "Failed to load trip administration",
        });
    }
};

export {
    homePage,
    aboutPage,
    dashboardPage,
    testErrorPage,
    loginPage,
    registerPage,
    adminDashboardPage,
    adminUsersPage,
    adminTripPage,
};
