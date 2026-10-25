import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import swaggerJsdoc from "swagger-jsdoc";
import { pathToFileURL } from "node:url";

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Kizuna Rail API",
            version: "1.0.0",
            description: "API for the Kizuna Rail website.",
        },
        servers: [
            {
                url: "/",
                description: "Current server",
            },
        ],
        components: {
            securitySchemes: {
                SessionCookieAuth: {
                    type: "apiKey",
                    in: "cookie",
                    name: "connect.sid",
                    description: "Express session cookie set after login.",
                },
            },
        },
    },
    apis: ["./src/routes/api-routes.js", "./app.js"],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    writeFileSync("./swagger.json", JSON.stringify(swaggerSpec, null, 2));
    console.log("Swagger documentation generated.");
}
