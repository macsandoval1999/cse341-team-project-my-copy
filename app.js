import express from "express";
import MongoStore from "connect-mongo";
import mongoose from "mongoose";
import Path from "path";
import { fileURLToPath } from "url";
import pkg from "./package.json" with { type: "json" };
import globalMiddleware from "./src/middleware/global.js";
import { loadSessionUser, requireApiLogin, requireApiRole, requirePageLogin, requirePageRole } from "./src/middleware/authentication.js";
import routes from "./src/routes/router.js";
import swaggerUi from "swagger-ui-express";
import swaggerDoc from "./swagger.js";
import session from "express-session";

const __filename = fileURLToPath(import.meta.url);
const __dirname = Path.dirname(__filename);
const SESSION_SECRET = process.env.SESSION_SECRET || "default_secret_key";
const sessionClientPromise = new Promise((resolve, reject) => {
    const connection = mongoose.connection;
    if (connection.readyState === 1) {
        resolve(connection.getClient());
        return;
    }

    connection.once("connected", () => resolve(connection.getClient()));
    connection.once("error", reject);
});
const sessionStore = MongoStore.create({
    clientPromise: sessionClientPromise,
    get dbName() {
        return mongoose.connection.name;
    }
});

const app = express();

// Serve Swagger UI documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDoc));
app.use(session({
    secret: SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { maxAge: 60 * 60 * 1000 }
}));

app.use(loadSessionUser);

// Add version info to res.locals for access in templates.
app.use((req, res, next) => {
    res.locals.appVersion = pkg.version;
    next();
});

// Configure static files and EJS templates.
app.use(express.static(Path.join(__dirname, "public")));
app.set("view engine", "ejs");
app.set("views", Path.join(__dirname, "src/views"));

// Parse JSON and URL-encoded request bodies.
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use(globalMiddleware);
app.use("/", routes);

// Catch requests that did not match a route.
app.use((req, res, next) => {
    const err = new Error("Page Not Found");
    err.status = 404;
    next(err);
});

// Render the appropriate error page.
app.use((err, req, res, next) => {
    const status = err.status || 500;
    if (res.headersSent) {
        return next(err);
    }

    if (req.path.startsWith("/api/")) {
        const message = err.type === "entity.parse.failed"
            ? "Invalid JSON request body"
            : status === 404
                ? "API endpoint not found"
                : status >= 500
                    ? "Internal server error"
                    : err.message;
        return res.status(status).json({ error: message });
    }

    const template = status === 404 ? "404" : "500";
    const context = {
        title: status === 404 ? "Page Not Found" : "Server Error",
        error: err.message,
        stack: err.stack,
    };

    return res.status(status).render(`errors/${template}`, context);
});


export default app;
