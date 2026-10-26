import { describe, expect, test } from "vitest";
import request from "supertest";
import app from "../app.js";

describe("admin dashboard page", () => {
    test("marks the dashboard hero for left-aligned heading styles", async () => {
        const admin = request.agent(app);
        const login = await admin
            .post("/api/auth/login")
            .send({ identifier: "admin@example.com", password: "known test password" });
        expect(login.status).toBe(200);

        const response = await admin.get("/admin");
        expect(response.status).toBe(200);
        expect(response.text).toContain('class="hero-home admin-dashboard-heading"');
    });
});
