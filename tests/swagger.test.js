import { describe, expect, test } from "vitest";
import swaggerSpec from "../swagger.js";

describe("OpenAPI documentation", () => {
    test("documents trip schedule management and schedule coverage filters", () => {
        expect(swaggerSpec.paths["/api/admin/schedules"].get.security)
            .toContainEqual({ SessionCookieAuth: [] });
        expect(swaggerSpec.paths["/api/trips/{tripId}/schedules"].get)
            .toBeDefined();
        expect(swaggerSpec.paths["/api/trips/{tripId}/schedules"].post)
            .toBeDefined();
        expect(swaggerSpec.paths["/api/schedules/{id}"].put.description)
            .toContain("booked departure times");

        const tripScheduleStatus = swaggerSpec.paths["/api/trips"].get.parameters
            .find((parameter) => parameter.name === "scheduleStatus");
        expect(tripScheduleStatus.schema.enum).toEqual([
            "all",
            "configured",
            "missing",
            "none",
        ]);
    });

    test("documents initial trip schedule requirements", () => {
        const createTrip = swaggerSpec.paths["/api/trips"].post;
        const bodySchema = createTrip.requestBody.content["application/json"].schema;
        expect(bodySchema.required).toContain("schedules");
        expect(bodySchema.properties.schedules.minItems).toBe(1);
    });
});
