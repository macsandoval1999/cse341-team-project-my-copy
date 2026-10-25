import { closeDb, connectToDb } from './connect.js';
import { initializeDatabase } from './initialize.js';

try {
  await connectToDb();
  await initializeDatabase();
  console.log('MongoDB import complete.');
} finally {
  await closeDb();
}
