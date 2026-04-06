import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';

export async function createInMemoryMongo() {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  const client = await MongoClient.connect(uri);
  const dbName = `test_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const db = client.db(dbName);

  return {
    uri,
    dbName,
    client,
    db,
    async stop() {
      try {
        await client.close();
      } finally {
        await mongod.stop();
      }
    }
  };
}

