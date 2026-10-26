import { describe, expect, test } from "vitest";
import request from "supertest";
import app from "../app.js";
import Train from "../src/models/schemas/trains.js";

describe("GET /trips/:tripId", () => {
    test("shows the train name when its image is not configured", async () => {
        await Train.updateOne(
            { id: "series-e353" },
            { $unset: { imageUrl: 1, imageAlt: 1 } }
        );

        const response = await request(app).get("/trips/alpine-panorama");

        expect(response.status).toBe(200);
        expect(response.text).toContain("Series E353 Limited Express");
        expect(response.text).toContain('class="info-label">Train</span>');
        expect(response.text).not.toContain("train-info-image");
        expect(response.text).toContain("train-info-placeholder");
    });

    test("keeps the train card visible when the referenced train record is missing", async () => {
        await Train.collection.deleteOne({ id: "series-e353" });

        const response = await request(app).get("/trips/alpine-panorama");

        expect(response.status).toBe(200);
        expect(response.text).toContain('class="info-label">Train</span>');
        expect(response.text).toContain("Train record unavailable (series-e353)");
    });
});
