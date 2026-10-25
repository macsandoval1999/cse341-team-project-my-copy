import { getUserById } from "../models/users.js";
import bcrypt from "bcrypt";

export const loadSessionUser = (req, res, next) => {
    req.user = req.session.user || null;
    res.locals.user = req.user;
    res.locals.isAdmin = hasRole(req.user, "admin");
    return next();
};

const isLoggedIn = (req) => {
    return Boolean(req.user);
};

const refreshSessionUser = async (req, res) => {
    if (!isLoggedIn(req)) {
        return null;
    }

    const user = await getUserById(req.user._id);
    if (!user) {
        delete req.session.user;
        req.user = null;
        res.locals.user = null;
        res.locals.isAdmin = false;
        return null;
    }

    req.user = user;
    res.locals.user = user;
    res.locals.isAdmin = hasRole(user, "admin");
    return user;
};

export const requireApiLogin = async (req, res, next) => {
    if (!isLoggedIn(req)) {
        return res.status(401).json({ message: "Authentication required" });
    }
    if (!(await refreshSessionUser(req, res))) {
        return res.status(401).json({ message: "Authentication required" });
    }
    return next();
};

export const requirePageLogin = async (req, res, next) => {
    if (!isLoggedIn(req)) {
        req.session.returnTo = req.originalUrl;
        return res.redirect("/login");
    }
    if (!(await refreshSessionUser(req, res))) {
        req.session.returnTo = req.originalUrl;
        return res.redirect("/login");
    }
    return next();
};

export const requirePageGuestOrAdmin = async (req, res, next) => {
    if (!isLoggedIn(req)) {
        return next();
    }
    if (!(await refreshSessionUser(req, res))) {
        return next();
    }
    if (hasRole(req.user, 'admin')) {
        return next();
    }

    return res.status(403).render('errors/403', {
        title: 'Forbidden',
        error: 'Only signed-out users and admins can access this page.',
    });
};

export const requireApiGuestOrAdmin = async (req, res, next) => {
    if (!isLoggedIn(req)) {
        return next();
    }
    if (!(await refreshSessionUser(req, res))) {
        return next();
    }
    if (hasRole(req.user, 'admin')) {
        return next();
    }

    return res.status(403).json({
        error: 'Only signed-out users and admins can register accounts',
    });
};

export const requireApiRole = (role) => async (req, res, next) => {
    if (!isLoggedIn(req)) {
        return res.status(401).json({ message: "Authentication required" });
    }
    if (!(await refreshSessionUser(req, res))) {
        return res.status(401).json({ message: "Authentication required" });
    }
    if (!hasRole(req.user, role)) {
        return res.status(403).json({ message: "Forbidden" });
    }
    return next();
};

export const requireApiSelfOrAdmin = async (req, res, next) => {
    if (!isLoggedIn(req)) {
        return res.status(401).json({ message: "Authentication required" });
    }
    if (!(await refreshSessionUser(req, res))) {
        return res.status(401).json({ message: "Authentication required" });
    }

    const isAdmin = hasRole(req.user, "admin");
    const targetUserId = req.params.id ?? req.params.userId;
    const isSelf = String(req.user._id) === targetUserId;
    if (!isAdmin && !isSelf) {
        return res.status(403).json({ message: "Forbidden" });
    }

    return next();
};

export const requirePageRole = (role) => async (req, res, next) => {
    if (!isLoggedIn(req)) {
        return res.redirect("/login");
    }
    if (!(await refreshSessionUser(req, res))) {
        return res.redirect("/login");
    }

    console.log("Checking role for user:", req.user);
    console.log("Required role:", role);
    if (!hasRole(req.user, role)) {
        return res.status(403).render("errors/403", {
            title: "Forbidden",
            error: "You do not have permission to access this page.",
        });
    }
    return next();
};

export const verifyPassword = async (password, passwordHash) => {
    return bcrypt.compare(password, passwordHash);
};

export const hasRole = (user, roleName) => user?.role?.name === roleName;
