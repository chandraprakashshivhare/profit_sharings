import { describe, expect, it } from 'vitest';
import { createInMemoryMongo } from '../helpers/mongo.js';
import { MongoClient } from 'mongodb';
import { spawn } from 'node:child_process';
import path from 'node:path';

function runSeed({ mongoUrl, dbName }) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.resolve(process.cwd(), 'scripts/seed.js');
    const child = spawn(process.execPath, [scriptPath], {
      env: {
        ...process.env,
        MONGO_URL: mongoUrl,
        DB_NAME: dbName
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr.on('data', (d) => (err += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve({ out, err });
      const e = new Error(`seed exited with code ${code}\n${err || out}`);
      e.code = code;
      reject(e);
    });
  });
}

describe('scripts/seed.js', () => {
  it('seeds 2 directors, 4 transactions, and audit entries (idempotent)', async () => {
    const mem = await createInMemoryMongo();
    const client = await MongoClient.connect(mem.uri);
    const dbName = mem.db.databaseName;
    const db = client.db(dbName);

    try {
      await runSeed({ mongoUrl: mem.uri, dbName });

      const directors1 = await db.collection('directors').find({}).toArray();
      const tx1 = await db.collection('transactions').find({ seed_key: { $exists: true } }).toArray();
      const audit1 = await db.collection('transaction_audit').find({ seed_key: { $exists: true } }).toArray();

      expect(directors1.length).toBe(2);
      expect(tx1.length).toBe(4);
      expect(audit1.length).toBe(4);

      // Re-run to ensure no duplicates
      await runSeed({ mongoUrl: mem.uri, dbName });

      const directors2 = await db.collection('directors').find({}).toArray();
      const tx2 = await db.collection('transactions').find({ seed_key: { $exists: true } }).toArray();
      const audit2 = await db.collection('transaction_audit').find({ seed_key: { $exists: true } }).toArray();

      expect(directors2.length).toBe(2);
      expect(tx2.length).toBe(4);
      expect(audit2.length).toBe(4);

      // Spot-check that transfers have both directors
      const transfer = tx2.find((t) => t.transaction_type === 'transfer');
      expect(transfer.from_director_id).toBeTruthy();
      expect(transfer.to_director_id).toBeTruthy();
      expect(transfer.from_director_id).not.toBe(transfer.to_director_id);
    } finally {
      await client.close();
      await mem.stop();
    }
  });
});

