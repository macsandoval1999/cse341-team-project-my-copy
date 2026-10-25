import { MongoMemoryServer } from 'mongodb-memory-server';

const setup = async (project) => {
  const mongoServer = await MongoMemoryServer.create();

  project.provide('MONGODB_TEST_URI', mongoServer.getUri());

  return async () => {
    await mongoServer.stop();
  };
};

export default setup;
