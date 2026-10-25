import mongoose from "mongoose";
import { describe, expect, test } from "vitest";
import request from "supertest";
import app from "../app.js";
import { User } from "../src/models/schemas/users.js";

// Helper function to sign in a user and return an authenticated agent.
const signIn = async (email) => {
    const testPassword = "known test password";
    const agent = request.agent(app);

    const loginResponse = await agent.post("/api/auth/login").send({ email, password: testPassword });

    expect(loginResponse.status).toBe(200);
    return agent;
};

/* Tests for the GET /api/users endpoint */
describe("GET /api/users", () => {
    // 1. Test that an administrator can retrieve the list of users
    test("returns the users to an administrator", async () => {
        // Arrange
        const agent = await signIn("admin@example.com");

        // Act
        const response = await agent.get("/api/users");

        // Assert
        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toContain("application/json");
        expect(response.body.data).toBeInstanceOf(Array);
        expect(response.body.data).toHaveLength(3);
        response.body.data.forEach((user) => {
            expect(user).not.toHaveProperty("passwordHash");
        });
    });

    // 2. Test that pagination works correctly
    test("paginates results", async () => {
        // Arrange
        const agent = await signIn("admin@example.com");

        // Act
        const response = await agent.get("/api/users").query({ page: 1, limit: 2 });

        // Assert
        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(2);
        expect(response.body.pagination).toMatchObject({
            page: 1,
            limit: 2,
            totalUsers: 3,
            hasNextPage: true,
            hasPreviousPage: false,
        });
    });

    // 3. Test that filtering by role works correctly
    test("filters users by role", async () => {
        // Arrange
        const agent = await signIn("admin@example.com");

        // Act
        const response = await agent.get("/api/users").query({ role: "admin" });

        // Assert
        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].email).toBe("admin@example.com");
    });

    // 4. Test that an invalid page parameter returns a 400 error
    test("returns 400 when the page is not a number", async () => {
        // Arrange
        const agent = await signIn("admin@example.com");

        // Act
        const response = await agent.get("/api/users").query({ page: "abc" });

        // Assert
        expect(response.status).toBe(400);
        expect(response.body.errors).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ field: "pagination" }),
            ])
        );
    });

    // 5. Test that an unauthenticated user receives a 401 error
    test("returns 401 when the user is not signed in", async () => {
        // Arrange
        // (no sign-in on purpose)

        // Act
        const response = await request(app).get("/api/users");

        // Assert
        expect(response.status).toBe(401);
    });

    // 6. Test that a non-administrator receives a 403 error
    test("returns 403 when the user is not an administrator", async () => {
        // Arrange
        const agent = await signIn("customer@example.com");

        // Act
        const response = await agent.get("/api/users");

        // Assert
        expect(response.status).toBe(403);
    });

    test("searches display names, usernames, and email addresses", async () => {
        const agent = await signIn("admin@example.com");
        const customer = await User.findOne({ email: "customer@example.com" });
        await User.updateOne(
            { _id: customer._id },
            {
                $set: {
                    name: "Quartz Display",
                    username: "tangerine-user",
                    email: "cobalt@example.com",
                },
            }
        );

        for (const term of ["Quartz", "tangerine", "cobalt"]) {
            const response = await agent.get("/api/users").query({ q: term });

            expect(response.status).toBe(200);
            expect(response.body.data.map((user) => user._id)).toContain(
                customer._id.toString()
            );
            expect(response.body.query.q).toBe(term);
        }
    });

    test("returns empty data and pagination metadata when search has no matches", async () => {
        const agent = await signIn("admin@example.com");

        const response = await agent
            .get("/api/users")
            .query({ q: "no-user-has-this-unique-term" });

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual([]);
        expect(response.body.query.q).toBe("no-user-has-this-unique-term");
        expect(response.body.pagination).toMatchObject({
            page: 1,
            limit: 10,
            totalUsers: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
        });
    });
});

/* Tests for the GET:ID /api/users/:id endpoint */
describe("GET /api/users/:id", () => {

    // 1. Test that a user can retrieve their own record
    test("returns the signed-in user's own record", async () => {
        // Arrange
        const customer = await User.findOne({ email: "customer@example.com" });
        const agent = await signIn("customer@example.com");

        // Act
        const response = await agent.get(`/api/users/${customer._id}`);

        // Assert
        expect(response.status).toBe(200);
        expect(response.body._id).toBe(customer._id.toString());
        expect(response.body.email).toBe("customer@example.com");
        expect(response.body).not.toHaveProperty("passwordHash");
    });

    test("allows an administrator to retrieve another user without authentication data", async () => {
        const other = await User.findOne({ email: "other@example.com" });
        const agent = await signIn("admin@example.com");

        const response = await agent.get(`/api/users/${other._id}`);

        expect(response.status).toBe(200);
        expect(response.body._id).toBe(other._id.toString());
        expect(response.body.email).toBe("other@example.com");
        expect(response.body).not.toHaveProperty("passwordHash");
        expect(response.body).not.toHaveProperty("password");
    });

    // 2. Test that a customer cannot retrieve another user's record
    test("returns 403 when a customer requests another user", async () => {
        // Arrange
        const other = await User.findOne({ email: "other@example.com" });
        const agent = await signIn("customer@example.com");

        // Act
        const response = await agent.get(`/api/users/${other._id}`);

        // Assert
        expect(response.status).toBe(403);
    });

    // 3. Test that requesting a non-existent user returns a 404 error
    test("returns 404 when the user does not exist", async () => {
        // Arrange
        const missingId = new mongoose.Types.ObjectId();
        const agent = await signIn("admin@example.com");

        // Act
        const response = await agent.get(`/api/users/${missingId}`);

        // Assert
        expect(response.status).toBe(404);
        expect(response.body.error).toContain("not found");
    });
});

/* Tests for the POST /api/users endpoint */
describe("POST /api/users", () => {
    // 1. Test that a customer can register successfully
    test("registers a customer and saves the user", async () => {
        // Arrange
        const newUser = {
            name: "new person",
            username: "new-person",
            email: "new@example.com",
            password: "a new password",
        };

        // Act
        const response = await request(app).post("/api/users").send(newUser);

        // Assert
        expect(response.status).toBe(201);

        const savedUser = await User.findOne({ email: "new@example.com", }).populate("role");

        expect(savedUser).not.toBeNull();
        expect(savedUser.name).toBe("New Person");
        expect(savedUser.username).toBe("new-person");
        expect(savedUser.email).toBe("new@example.com");
        expect(savedUser.role.name).toBe("customer");
        expect(savedUser.passwordHash).toBeTruthy();
        expect(savedUser.passwordHash).not.toBe(newUser.password);
        expect(response.body).not.toHaveProperty("passwordHash");
    });

    // 2. Test that registration fails when the password is missing
    test("returns 400 when the password is missing", async () => {
        // Arrange
        const incompleteUser = {
            name: "New Person",
            username: "new-person",
            email: "new@example.com",
        };

        // Act
        const response = await request(app).post("/api/users").send(incompleteUser);

        // Assert
        expect(response.status).toBe(400);
    });

    // 3. Test that registration fails when the email is already in use
    test("returns 409 when the email is already in use", async () => {
        // Arrange
        const duplicateUser = {
            name: "Copy Cat",
            username: "copy-cat",
            email: "customer@example.com",
            password: "a new password",
        };

        // Act
        const response = await request(app).post("/api/users").send(duplicateUser);

        // Assert
        expect(response.status).toBe(409);
    });
});

/* Tests for the PUT /api/users/:id endpoint */
describe("PUT /api/users/:id", () => {
    // 1. Test that a signed-in user can update their own record
    test("updates the signed-in user and saves the change", async () => {
        // Arrange
        const customer = await User.findOne({ email: "customer@example.com" });
        const agent = await signIn("customer@example.com");

        // Act
        const response = await agent.put(`/api/users/${customer._id}`).send({ name: "renamed customer", email: "customer@example.com" });

        // Assert
        expect(response.status).toBe(200);
        expect(response.body).not.toHaveProperty("passwordHash");

        const savedUser = await User.findById(customer._id);

        expect(savedUser.name).toBe("Renamed Customer");
    });

    test("allows an administrator to update another user's record", async () => {
        const other = await User.findOne({ email: "other@example.com" });
        const agent = await signIn("admin@example.com");

        const response = await agent
            .put(`/api/users/${other._id}`)
            .send({
                name: "Updated Other",
                email: "other@example.com",
                role: "admin",
            });

        expect(response.status).toBe(200);
        expect(response.body).not.toHaveProperty("passwordHash");

        const savedUser = await User.findById(other._id).populate("role");
        expect(savedUser.name).toBe("Updated Other");
        expect(savedUser.role.name).toBe("admin");
    });

    test("prevents a customer from updating another user's record", async () => {
        const other = await User.findOne({ email: "other@example.com" });
        const agent = await signIn("customer@example.com");

        const response = await agent
            .put(`/api/users/${other._id}`)
            .send({ name: "Unauthorized Change", email: "other@example.com" });

        expect(response.status).toBe(403);
        expect((await User.findById(other._id)).name).toBe("Other Customer");
    });

    // 2. Test that a customer cannot change their role
    test("returns 403 when a customer tries to change a role", async () => {
        // Arrange
        const customer = await User.findOne({ email: "customer@example.com" });
        const agent = await signIn("customer@example.com");

        // Act
        const response = await agent.put(`/api/users/${customer._id}`).send({
            name: "Test Customer",
            email: "customer@example.com",
            role: "admin",
        });

        // Assert
        expect(response.status).toBe(403);
    });
});

/* Tests for the DELETE /api/users/:id endpoint */
describe("DELETE /api/users/:id", () => {
    // 1. Test that an administrator can delete a user
    test("lets an administrator delete a user and removes the record", async () => {
        // Arrange
        const other = await User.findOne({ email: "other@example.com" });
        const agent = await signIn("admin@example.com");

        // Act
        const response = await agent.delete(`/api/users/${other._id}`);

        // Assert
        expect(response.status).toBe(200);

        const deletedUser = await User.findById(other._id);

        expect(deletedUser).toBeNull();
    });

    // 2. Test that a customer cannot delete another user
    test("returns 403 when a customer deletes another user", async () => {
        // Arrange
        const other = await User.findOne({ email: "other@example.com" });
        const agent = await signIn("customer@example.com");

        // Act
        const response = await agent.delete(`/api/users/${other._id}`);

        // Assert
        expect(response.status).toBe(403);
        expect(await User.findById(other._id)).not.toBeNull();
    });

    test("allows a customer to delete their own account and clears their session", async () => {
        const customer = await User.findOne({ email: "customer@example.com" });
        const agent = await signIn("customer@example.com");

        const response = await agent.delete(`/api/users/${customer._id}`);

        expect(response.status).toBe(200);
        expect(response.body.deletedSelf).toBe(true);
        expect(await User.findById(customer._id)).toBeNull();
        expect((await agent.get(`/api/users/${customer._id}`)).status).toBe(401);
    });
});
