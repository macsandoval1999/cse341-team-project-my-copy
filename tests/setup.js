import { afterAll, beforeAll, beforeEach, inject } from 'vitest';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { initializeDatabase } from '../src/db/initialize.js';
import { Role } from '../src/models/schemas/roles.js';
import { User } from '../src/models/schemas/users.js';

const mongoUri = inject('MONGODB_TEST_URI');

beforeAll(async () => {
  // Refuse to run (and drop databases) against anything but a local temporary server.
  const { hostname } = new URL(mongoUri);
  if (!['127.0.0.1', 'localhost'].includes(hostname)) {
    throw new Error(`Refusing to run tests against non-local database: ${hostname}`);
  }

  await mongoose.connect(mongoUri, { dbName: 'kizuna-rail-test' });
});

// Known-password accounts live here, not in initializeDatabase(), so they are never seeded into the real database.
const createTestUsers = async () => {
  const adminRole = await Role.findOne({ name: 'admin' });
  const customerRole = await Role.findOne({ name: 'customer' });
  const passwordHash = await bcrypt.hash('known test password', 4);

  await User.create([
    { name: 'Test Admin', username: 'test-admin', email: 'admin@example.com', passwordHash, role: adminRole._id },
    { name: 'Test Customer', username: 'test-customer', email: 'customer@example.com', passwordHash, role: customerRole._id },
    { name: 'Other Customer', username: 'other-customer', email: 'other@example.com', passwordHash, role: customerRole._id }
  ]);
};

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
  await initializeDatabase();
  await createTestUsers();
});

afterAll(async () => {
  await mongoose.disconnect();
});
