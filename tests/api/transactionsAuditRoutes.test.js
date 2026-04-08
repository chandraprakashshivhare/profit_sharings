import { beforeEach, describe, expect, it, vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { createInMemoryMongo } from '../helpers/mongo.js';

function makeAuthedRequest(url, token) {
  return {
    url,
    cookies: {
      get(name) {
        if (name === 'access_token') return { value: token };
        return undefined;
      }
    },
    headers: {
      get() {
        return null;
      }
    }
  };
}

async function setupRouteWithMemoryDb() {
  const mem = await createInMemoryMongo();
  process.env.MONGO_URL = mem.uri;
  process.env.DB_NAME = mem.dbName;

  vi.resetModules();
  const { GET } = await import('../../app/api/[[...path]]/route.js');
  const { createAccessToken } = await import('../../lib/auth.js');
  const token = createAccessToken('director-1', 'director1@example.com', 'Director One');

  return { mem, GET, token };
}

describe('api route GET - transactions and transaction-audit', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('transactions list applies filters, excludes soft-deleted, and returns latest first', async () => {
    const { mem, GET, token } = await setupRouteWithMemoryDb();
    try {
      const p1 = uuidv4();
      const p2 = uuidv4();

      await mem.db.collection('transactions').insertMany([
        {
          id: uuidv4(),
          transaction_id: 'P1-OLDER',
          transaction_type: 'income',
          amount: 100,
          account_type: 'company',
          project_id: p1,
          is_deleted: false,
          transaction_date: new Date('2026-01-01')
        },
        {
          id: uuidv4(),
          transaction_id: 'P1-LATEST',
          transaction_type: 'income',
          amount: 200,
          account_type: 'director',
          director_id: 'director-1',
          project_id: p1,
          is_deleted: false,
          transaction_date: new Date('2026-01-20')
        },
        {
          id: uuidv4(),
          transaction_id: 'P1-DELETED',
          transaction_type: 'income',
          amount: 300,
          account_type: 'director',
          director_id: 'director-1',
          project_id: p1,
          is_deleted: true,
          transaction_date: new Date('2026-01-25')
        },
        {
          id: uuidv4(),
          transaction_id: 'P2-OTHER',
          transaction_type: 'income',
          amount: 400,
          account_type: 'company',
          project_id: p2,
          is_deleted: false,
          transaction_date: new Date('2026-01-15')
        },
        {
          id: uuidv4(),
          transaction_id: 'P1-FEB',
          transaction_type: 'income',
          amount: 500,
          account_type: 'director',
          director_id: 'director-1',
          project_id: p1,
          is_deleted: false,
          transaction_date: new Date('2026-02-01')
        }
      ]);

      const req = makeAuthedRequest(
        `/api/transactions?period=month&month=0&year=2026&type=income&project_id=${p1}&account_type=director&director_id=director-1`,
        token
      );
      // Route uses full URL parsing.
      req.url = `http://localhost:3000${req.url}`;

      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.map((r) => r.transaction_id)).toEqual(['P1-LATEST']);
    } finally {
      await mem.stop();
    }
  });

  it('transactions support multi account_types + director_ids', async () => {
    const { mem, GET, token } = await setupRouteWithMemoryDb();
    try {
      const p1 = uuidv4();

      await mem.db.collection('transactions').insertMany([
        {
          id: uuidv4(),
          transaction_id: 'COMP-OLD',
          transaction_type: 'income',
          amount: 10,
          account_type: 'company',
          project_id: p1,
          is_deleted: false,
          transaction_date: new Date('2026-01-05')
        },
        {
          id: uuidv4(),
          transaction_id: 'DIR1-LATEST',
          transaction_type: 'income',
          amount: 20,
          account_type: 'director',
          director_id: 'director-1',
          project_id: p1,
          is_deleted: false,
          transaction_date: new Date('2026-01-20')
        },
        {
          id: uuidv4(),
          transaction_id: 'DIR2-MID',
          transaction_type: 'income',
          amount: 30,
          account_type: 'director',
          director_id: 'director-2',
          project_id: p1,
          is_deleted: false,
          transaction_date: new Date('2026-01-15')
        }
      ]);

      const req = makeAuthedRequest(
        `/api/transactions?period=month&month=0&year=2026&type=income&project_id=${p1}&account_types=company,director&director_ids=director-1,director-2`,
        token
      );
      req.url = `http://localhost:3000${req.url}`;

      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.map((r) => r.transaction_id)).toEqual(['DIR1-LATEST', 'DIR2-MID', 'COMP-OLD']);
    } finally {
      await mem.stop();
    }
  });

  it('transactions pagination returns items with total metadata', async () => {
    const { mem, GET, token } = await setupRouteWithMemoryDb();
    try {
      await mem.db.collection('transactions').insertMany([
        { id: uuidv4(), transaction_id: 'A', transaction_type: 'income', amount: 1, transaction_date: new Date('2026-01-01') },
        { id: uuidv4(), transaction_id: 'B', transaction_type: 'income', amount: 2, transaction_date: new Date('2026-01-02') },
        { id: uuidv4(), transaction_id: 'C', transaction_type: 'income', amount: 3, transaction_date: new Date('2026-01-03') }
      ]);

      const req = makeAuthedRequest('http://localhost:3000/api/transactions?period=all&page=2&limit=2', token);
      const res = await GET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.page).toBe(2);
      expect(data.limit).toBe(2);
      expect(data.total).toBe(3);
      expect(data.totalPages).toBe(2);
      expect(data.items.map((r) => r.transaction_id)).toEqual(['A']);
    } finally {
      await mem.stop();
    }
  });

  it('transactions CSV export order matches list order (latest first)', async () => {
    const { mem, GET, token } = await setupRouteWithMemoryDb();
    try {
      const p1 = uuidv4();
      await mem.db.collection('directors').insertOne({
        id: 'director-1',
        name: 'Director One',
        status: 'approved'
      });
      await mem.db.collection('projects').insertOne({
        id: p1,
        name: 'Project One'
      });

      await mem.db.collection('transactions').insertMany([
        {
          id: uuidv4(),
          transaction_id: 'TX-OLD',
          transaction_type: 'income',
          amount: 10,
          project_id: p1,
          transaction_date: new Date('2026-01-02'),
          created_by: 'director-1'
        },
        {
          id: uuidv4(),
          transaction_id: 'TX-NEW',
          transaction_type: 'income',
          amount: 20,
          project_id: p1,
          transaction_date: new Date('2026-01-12'),
          created_by: 'director-1'
        }
      ]);

      const req = makeAuthedRequest(
        `http://localhost:3000/api/transactions/csv?period=month&month=0&year=2026&project_id=${p1}`,
        token
      );
      const res = await GET(req);
      expect(res.status).toBe(200);
      const csv = await res.text();

      expect(csv.indexOf('TX-NEW')).toBeGreaterThan(-1);
      expect(csv.indexOf('TX-OLD')).toBeGreaterThan(-1);
      expect(csv.indexOf('TX-NEW')).toBeLessThan(csv.indexOf('TX-OLD'));
    } finally {
      await mem.stop();
    }
  });

  it('transaction audit list and CSV are both latest-first', async () => {
    const { mem, GET, token } = await setupRouteWithMemoryDb();
    try {
      await mem.db.collection('directors').insertOne({
        id: 'director-1',
        name: 'Director One',
        status: 'approved'
      });

      await mem.db.collection('transaction_audit').insertMany([
        {
          id: 'audit-old',
          transaction_id: 'T-1',
          action: 'create',
          amount: 10,
          transaction_type: 'income',
          transaction_date: new Date('2026-01-01'),
          recorded_at: new Date('2026-01-05T09:00:00Z'),
          actor_id: 'director-1'
        },
        {
          id: 'audit-new',
          transaction_id: 'T-2',
          action: 'update',
          amount: 11,
          transaction_type: 'income',
          transaction_date: new Date('2026-01-01'),
          recorded_at: new Date('2026-01-05T10:00:00Z'),
          actor_id: 'director-1'
        }
      ]);

      const listReq = makeAuthedRequest(
        'http://localhost:3000/api/transaction-audit?period=all',
        token
      );
      const listRes = await GET(listReq);
      const listData = await listRes.json();
      expect(listData.map((r) => r.id)).toEqual(['audit-new', 'audit-old']);

      const csvReq = makeAuthedRequest(
        'http://localhost:3000/api/transaction-audit/csv?period=all',
        token
      );
      const csvRes = await GET(csvReq);
      const csv = await csvRes.text();
      expect(csv.indexOf('audit-new')).toBeLessThan(csv.indexOf('audit-old'));
    } finally {
      await mem.stop();
    }
  });
});
