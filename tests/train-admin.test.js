import { describe, expect, test } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import Train from '../src/models/schemas/trains.js';
import Trip from '../src/models/schemas/trips.js';

const password = 'known test password';

// Logs in through the API and returns an agent that keeps the session cookie
const loginAs = async (role) => {
  const email = `${role}@example.com`;
  const agent = request.agent(app);
  const response = await agent.post('/api/auth/login').send({ identifier: email, password });
  expect(response.status).toBe(200);

  return agent;
};

const newTrain = {
  id: 'test-shinkansen',
  name: 'Test Shinkansen',
  operator: 'Test Railway',
  type: 'High-Speed',
  maxSpeedKmh: 300,
  capacity: 1000,
  powerSource: 'Electric'
};

describe('train admin access', () => {
  test('/trains-admin redirects to login when logged out', async () => {
    const response = await request(app).get('/trains-admin');

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/login');
  });

  test('/trains-admin shows the 403 page for a customer', async () => {
    const customer = await loginAs('customer');

    const response = await customer.get('/trains-admin');

    expect(response.status).toBe(403);
  });

  test('/trains-admin loads for an admin, and the dashboard links to it', async () => {
    const admin = await loginAs('admin');

    const page = await admin.get('/trains-admin');
    expect(page.status).toBe(200);
    expect(page.text).toContain('Manage Trains');

    const dashboard = await admin.get('/admin');
    expect(dashboard.text).toContain('href="/trains-admin"');
  });

  test('admin pages link back to the admin dashboard', async () => {
    const admin = await loginAs('admin');

    for (const path of ['/admin/users', '/bookings-admin', '/trips-admin', '/trains-admin', '/register']) {
      const response = await admin.get(path);

      expect(response.status, path).toBe(200);
      expect(response.text, path).toContain('Back to Admin Dashboard');
      expect(response.text, path).toContain('href="/admin"');
    }
  });

  test('API routes return 401 when logged out', async () => {
    expect((await request(app).post('/api/trains').send(newTrain)).status).toBe(401);
    expect((await request(app).put('/api/trains/kiha-261').send({ capacity: 1 })).status).toBe(401);
    expect((await request(app).delete('/api/trains/kiha-261')).status).toBe(401);
    expect((await request(app).put('/api/trips/alpine-panorama/train').send({ trainId: 'kiha-261' })).status).toBe(401);
  });

  test('API routes return 403 for a customer', async () => {
    const customer = await loginAs('customer');

    expect((await customer.post('/api/trains').send(newTrain)).status).toBe(403);
    expect((await customer.put('/api/trains/kiha-261').send({ capacity: 1 })).status).toBe(403);
    expect((await customer.delete('/api/trains/kiha-261')).status).toBe(403);
    expect((await customer.put('/api/trips/alpine-panorama/train').send({ trainId: 'kiha-261' })).status).toBe(403);
  });
});

describe('POST /api/trains', () => {
  test('creates a train', async () => {
    const admin = await loginAs('admin');

    const response = await admin.post('/api/trains').send(newTrain);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ id: 'test-shinkansen', name: 'Test Shinkansen' });
    expect((await request(app).get('/api/trains/test-shinkansen')).status).toBe(200);
  });

  test('returns 400 with field errors for missing and invalid fields', async () => {
    const admin = await loginAs('admin');

    const response = await admin.post('/api/trains').send({ id: 'bad-train', capacity: -5 });

    expect(response.status).toBe(400);
    const fields = response.body.errors.map((error) => error.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'operator', 'type', 'powerSource', 'maxSpeedKmh', 'capacity']));
  });

  test('returns 400 for an unknown field', async () => {
    const admin = await loginAs('admin');

    const response = await admin.post('/api/trains').send({ ...newTrain, color: 'red' });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual([expect.objectContaining({ field: 'color' })]);
  });

  test('returns 409 when the id is already taken', async () => {
    const admin = await loginAs('admin');

    const response = await admin.post('/api/trains').send({ ...newTrain, id: 'kiha-261' });

    expect(response.status).toBe(409);
  });
});

describe('PUT /api/trains/:id', () => {
  test('updates a train', async () => {
    const admin = await loginAs('admin');

    const response = await admin.put('/api/trains/kiha-261').send({ capacity: 300, bestFor: 'Winter sightseeing' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: 'kiha-261', capacity: 300, bestFor: 'Winter sightseeing' });
  });

  test('returns 400 when the body tries to change the id', async () => {
    const admin = await loginAs('admin');

    const response = await admin.put('/api/trains/kiha-261').send({ id: 'new-id' });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual([expect.objectContaining({ field: 'id' })]);
  });

  test('returns 400 for an empty body or an invalid value', async () => {
    const admin = await loginAs('admin');

    expect((await admin.put('/api/trains/kiha-261').send({})).status).toBe(400);
    expect((await admin.put('/api/trains/kiha-261').send({ maxSpeedKmh: 'fast' })).status).toBe(400);
  });

  test('returns 404 for an unknown train', async () => {
    const admin = await loginAs('admin');

    const response = await admin.put('/api/trains/not-a-real-train').send({ capacity: 1 });

    expect(response.status).toBe(404);
  });
});

describe('DELETE /api/trains/:id', () => {
  test('deletes a train that no trip uses', async () => {
    const admin = await loginAs('admin');
    await admin.post('/api/trains').send(newTrain);

    const response = await admin.delete('/api/trains/test-shinkansen');

    expect(response.status).toBe(200);
    expect((await request(app).get('/api/trains/test-shinkansen')).status).toBe(404);
  });

  test('returns 409 and lists the trips when the train is in use', async () => {
    const admin = await loginAs('admin');

    const response = await admin.delete('/api/trains/series-e353');

    expect(response.status).toBe(409);
    expect(response.body.trips).toEqual(expect.arrayContaining(['alpine-panorama']));
    expect((await request(app).get('/api/trains/series-e353')).status).toBe(200);
  });

  test('returns 404 for an unknown train', async () => {
    const admin = await loginAs('admin');

    expect((await admin.delete('/api/trains/not-a-real-train')).status).toBe(404);
  });
});

describe('PUT /api/trips/:id/train', () => {
  test('moves a trip to another train', async () => {
    const admin = await loginAs('admin');

    const response = await admin.put('/api/trips/alpine-panorama/train').send({ trainId: 'kiha-261' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: 'alpine-panorama', trainId: 'kiha-261' });
  });

  test('returns 400 for a train that does not exist', async () => {
    const admin = await loginAs('admin');

    const response = await admin.put('/api/trips/alpine-panorama/train').send({ trainId: 'fake-train' });

    expect(response.status).toBe(400);
    expect((await Trip.findOne({ id: 'alpine-panorama' }).lean()).trainId).toBe('series-e353');
  });

  test('returns 400 when trainId is missing', async () => {
    const admin = await loginAs('admin');

    expect((await admin.put('/api/trips/alpine-panorama/train').send({})).status).toBe(400);
  });

  test('returns 404 for an unknown trip', async () => {
    const admin = await loginAs('admin');

    const response = await admin.put('/api/trips/not-a-real-trip/train').send({ trainId: 'kiha-261' });

    expect(response.status).toBe(404);
  });

  test('a train can be deleted once its last trip moves away', async () => {
    const admin = await loginAs('admin');
    await admin.post('/api/trains').send(newTrain);
    await admin.put('/api/trips/alpine-panorama/train').send({ trainId: 'test-shinkansen' });

    expect((await admin.delete('/api/trains/test-shinkansen')).status).toBe(409);

    await admin.put('/api/trips/alpine-panorama/train').send({ trainId: 'series-e353' });
    expect((await admin.delete('/api/trains/test-shinkansen')).status).toBe(200);
  });
});

// These call the models directly, skipping the controllers, to show the schema enforces the rules on its own
describe('schema rules without the controller', () => {
  test('a train used by a trip cannot be deleted', async () => {
    await expect(Train.deleteOne({ id: 'series-e353' })).rejects.toMatchObject({ status: 409 });
    expect(await Train.exists({ id: 'series-e353' })).toBeTruthy();
  });

  test('a trip cannot point at a train that does not exist', async () => {
    await expect(
      Trip.updateOne({ id: 'alpine-panorama' }, { $set: { trainId: 'fake-train' } }, { runValidators: true })
    ).rejects.toThrow("Train 'fake-train' does not exist");
  });
});
