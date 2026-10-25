import { describe, expect, test } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import Train from '../src/models/schemas/trains.js';

describe('GET /api/trains', () => {
  test('returns a successful JSON response', async () => {
    const response = await request(app).get('/api/trains');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toBeInstanceOf(Array);
    expect(response.body).toHaveProperty('pagination');
  });

  test('returns the trains from the starter data', async () => {
    const response = await request(app).get('/api/trains');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(4);
    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'series-e353',
          name: 'Series E353 Limited Express',
          powerSource: 'Electric'
        })
      ])
    );
  });

  test('returns a train added to the test database', async () => {
    await Train.create({
      id: 'test-express',
      name: 'Test Express',
      operator: 'Test Railway',
      type: 'Express',
      maxSpeedKmh: 200,
      capacity: 500,
      powerSource: 'Electric'
    });

    const response = await request(app).get('/api/trains');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'test-express',
          name: 'Test Express'
        })
      ])
    );
  });

  test('paginates results', async () => {
    const response = await request(app).get('/api/trains?limit=2&page=1');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.pagination).toMatchObject({
      page: 1,
      limit: 2,
      hasPreviousPage: false
    });
  });

  test('keeps a stable order across pages when sort values tie', async () => {
    const page1 = await request(app).get('/api/trains?sort=maxSpeedKmh&limit=2&page=1');
    const page2 = await request(app).get('/api/trains?sort=maxSpeedKmh&limit=2&page=2');

    const ids = [...page1.body.data, ...page2.body.data].map((train) => train.id);

    expect(new Set(ids).size).toBe(4);
  });

  test('rejects an invalid page value', async () => {
    const response = await request(app).get('/api/trains?page=abc');

    expect(response.status).toBe(400);
  });

  test('rejects a limit above the maximum', async () => {
    const response = await request(app).get('/api/trains?limit=1000');

    expect(response.status).toBe(400);
  });

  test('rejects an unsupported sort field', async () => {
    const response = await request(app).get('/api/trains?sort=password');

    expect(response.status).toBe(400);
  });
  test('searches by keyword across name, operator, description, and bestFor', async () => {
    const response = await request(app).get('/api/trains?q=Steam');

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'steam-c11' })
      ])
    );
    expect(response.body.query.q).toBe('Steam');
  });

  test('searches by a case-insensitive substring', async () => {
    const response = await request(app).get('/api/trains?q=r');

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'series-e353' })
      ])
    );
  });

  test('treats regular-expression characters in search as literal text', async () => {
    const response = await request(app).get('/api/trains?q=%5B');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });

  test('filters by exact type', async () => {
    const response = await request(app).get('/api/trains?type=Steam Excursion');

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
    response.body.data.forEach((train) => {
      expect(train.type).toBe('Steam Excursion');
    });
  });

  test('matches type filters without case sensitivity', async () => {
    const response = await request(app).get('/api/trains?type=steam%20excursion');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      expect.objectContaining({ id: 'steam-c11' })
    ]);
  });

  test('filters by exact powerSource', async () => {
    const response = await request(app).get('/api/trains?powerSource=Electric');

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
    response.body.data.forEach((train) => {
      expect(train.powerSource).toBe('Electric');
    });
  });

  test('matches power source filters without case sensitivity', async () => {
    const response = await request(app).get('/api/trains?powerSource=electric');

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
    response.body.data.forEach((train) => {
      expect(train.powerSource.toLowerCase()).toBe('electric');
    });
  });

  test('combines type and powerSource filters', async () => {
    const response = await request(app).get('/api/trains?powerSource=Electric&type=Limited Express');

    expect(response.status).toBe(200);
    response.body.data.forEach((train) => {
      expect(train.powerSource).toBe('Electric');
      expect(train.type).toBe('Limited Express');
    });
  });

  test('returns an empty array, not a 404, when no trains match', async () => {
    const response = await request(app).get('/api/trains?q=zzzznoresults');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.pagination.totalItems).toBe(0);
  });

  test('returns an empty array for a type that matches nothing', async () => {
    const response = await request(app).get('/api/trains?type=Bullet');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });

  test('rejects an empty q value', async () => {
    const response = await request(app).get('/api/trains?q=');

    expect(response.status).toBe(400);
  });

  test('rejects an empty type value', async () => {
    const response = await request(app).get('/api/trains?type=');

    expect(response.status).toBe(400);
  });

  test('rejects an empty powerSource value', async () => {
    const response = await request(app).get('/api/trains?powerSource=');

    expect(response.status).toBe(400);
  });
});

describe('GET /api/trains/filters', () => {
  test('returns the distinct type and powerSource values', async () => {
    const response = await request(app).get('/api/trains/filters');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('types');
    expect(response.body).toHaveProperty('powerSources');
    expect(response.body.types).toEqual(expect.arrayContaining(['Steam Excursion']));
    expect(response.body.powerSources).toEqual(expect.arrayContaining(['Electric', 'Diesel', 'Steam']));
  });
});

describe('GET /api/trains/:id/trips', () => {
  test('returns the trips assigned to that train', async () => {
    const response = await request(app).get('/api/trains/series-e353/trips');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.body).toHaveProperty('trips');
    expect(response.body.trips).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'alpine-panorama', trainId: 'series-e353' })
      ])
    );
    response.body.trips.forEach((trip) => {
      expect(trip.trainId).toBe('series-e353');
    });
  });

  test('returns an empty array for a train with no trips', async () => {
    await Train.create({
      id: 'test-express',
      name: 'Test Express',
      operator: 'Test Railway',
      type: 'Express',
      maxSpeedKmh: 200,
      capacity: 500,
      powerSource: 'Electric'
    });

    const response = await request(app).get('/api/trains/test-express/trips');

    expect(response.status).toBe(200);
    expect(response.body.trips).toEqual([]);
  });

  test('returns 404 for an unknown train id', async () => {
    const response = await request(app).get('/api/trains/not-a-real-train/trips');

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('error');
  });
});
