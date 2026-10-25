import { describe, expect, test } from 'vitest';
import request from 'supertest';
import app from '../app.js';

describe('GET /api/trips', () => {
  test('returns a successful JSON response with data and pagination', async () => {
    const response = await request(app).get('/api/trips');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toBeInstanceOf(Array);
    expect(response.body).toHaveProperty('pagination');
  });

  test('returns the trips from the starter data', async () => {
    const response = await request(app).get('/api/trips');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'alpine-panorama',
          name: 'Alpine Panorama Express',
          region: 'central'
        })
      ])
    );
  });

  test('defaults to 10 items per page', async () => {
    const response = await request(app).get('/api/trips');

    expect(response.status).toBe(200);
    expect(response.body.pagination).toMatchObject({
      page: 1,
      limit: 10
    });
  });

  test('paginates results', async () => {
    const response = await request(app).get('/api/trips?limit=2&page=1');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.pagination).toMatchObject({
      page: 1,
      limit: 2,
      hasPreviousPage: false,
      hasNextPage: true
    });
  });

  test('keeps a stable order across pages when sort values tie', async () => {
    const page1 = await request(app).get('/api/trips?sort=region&limit=2&page=1');
    const page2 = await request(app).get('/api/trips?sort=region&limit=2&page=2');

    const ids = [...page1.body.data, ...page2.body.data].map((trip) => trip.id);

    expect(new Set(ids).size).toBe(4);
  });

  test('rejects an invalid page value', async () => {
    const response = await request(app).get('/api/trips?page=abc');

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('errors');
  });

  test('rejects a limit above the maximum', async () => {
    const response = await request(app).get('/api/trips?limit=1000');

    expect(response.status).toBe(400);
  });

  test('rejects an unsupported sort field', async () => {
    const response = await request(app).get('/api/trips?sort=description');

    expect(response.status).toBe(400);
  });

  test('filters trips by region and counts only the matches', async () => {
    const response = await request(app).get('/api/trips?region=central&limit=50');

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
    expect(response.body.data.every((trip) => trip.region === 'central')).toBe(true);
    expect(response.body.pagination.totalItems).toBe(response.body.data.length);
  });

  test('filters trips by season', async () => {
    const response = await request(app).get('/api/trips?season=summer&limit=50');

    expect(response.status).toBe(200);
    expect(response.body.data.every((trip) => trip.bestSeason === 'summer')).toBe(true);
  });

  test('ignores the "all" filter value', async () => {
    const all = await request(app).get('/api/trips?limit=50');
    const filtered = await request(app).get('/api/trips?region=all&season=all&limit=50');

    expect(filtered.body.pagination.totalItems).toBe(all.body.pagination.totalItems);
  });

  test('reports the total number of trips and pages', async () => {
    const response = await request(app).get('/api/trips?limit=2');

    expect(response.status).toBe(200);
    expect(response.body.pagination.totalItems).toBeGreaterThan(2);
    expect(response.body.pagination.totalPages).toBe(
      Math.ceil(response.body.pagination.totalItems / 2)
    );
  });
});

describe('GET /api/trips filtering and search', () => {
  test('filters by region, case-insensitively', async () => {
    const response = await request(app).get('/api/trips?region=Central');

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
    response.body.data.forEach((trip) => {
      expect(trip.region.toLowerCase()).toBe('central');
    });
    expect(response.body.filters).toMatchObject({ region: 'Central' });
  });

  test('filters by season', async () => {
    const response = await request(app).get('/api/trips?season=autumn');

    expect(response.status).toBe(200);
    response.body.data.forEach((trip) => {
      expect(trip.bestSeason.toLowerCase()).toBe('autumn');
    });
  });

  test('treats "all" as no filter', async () => {
    const response = await request(app).get('/api/trips?region=all&season=all');

    expect(response.status).toBe(200);
    expect(response.body.filters).toMatchObject({ region: null, season: null });
  });

  test('searches by keyword across name and description', async () => {
    const response = await request(app).get('/api/trips?search=gorge');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'gorge-explorer' })
      ])
    );
    expect(response.body.filters).toMatchObject({ search: 'gorge' });
  });

  test('combines region filter and keyword search', async () => {
    const response = await request(app).get('/api/trips?region=kansai&search=temple');

    expect(response.status).toBe(200);
    response.body.data.forEach((trip) => {
      expect(trip.region.toLowerCase()).toBe('kansai');
    });
  });

  test('returns an empty data array when nothing matches', async () => {
    const response = await request(app).get('/api/trips?search=nonexistent-keyword-xyz');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(0);
    expect(response.body.pagination.totalItems).toBe(0);
  });

  test('does not treat search input as a regular expression', async () => {
    const response = await request(app).get('/api/trips?search=' + encodeURIComponent('.*'));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(0);
  });

  test('rejects a search term over the max length', async () => {
    const response = await request(app).get('/api/trips?search=' + 'a'.repeat(101));

    expect(response.status).toBe(400);
  });
});
