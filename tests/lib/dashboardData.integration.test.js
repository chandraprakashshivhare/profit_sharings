import { describe, expect, it } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { createInMemoryMongo } from '../helpers/mongo.js';
import {
  buildTransactionsListQuery,
  getCompanyDashboardData,
  getDirectorDashboardData
} from '../../lib/dashboardData.js';

describe('lib/dashboardData integration with Mongo', () => {
  it('getCompanyDashboardData excludes soft-deleted transactions', async () => {
    const mem = await createInMemoryMongo();
    try {
      const directorId = uuidv4();
      await mem.db.collection('directors').insertOne({
        id: directorId,
        name: 'Director One',
        email: 'director.one@example.com',
        status: 'approved'
      });

      await mem.db.collection('transactions').insertMany([
        {
          id: uuidv4(),
          transaction_type: 'income',
          amount: 1000,
          transaction_date: new Date('2026-01-01'),
          created_at: new Date(),
          created_by: directorId
        },
        {
          id: uuidv4(),
          transaction_type: 'expense',
          amount: 100,
          transaction_date: new Date('2026-01-02'),
          created_at: new Date(),
          created_by: directorId
        },
        {
          id: uuidv4(),
          transaction_type: 'income',
          amount: 9999,
          is_deleted: true,
          transaction_date: new Date('2026-01-03'),
          created_at: new Date(),
          created_by: directorId
        }
      ]);

      const data = await getCompanyDashboardData(mem.db, 'all');
      expect(data.totalIncome).toBe(1000);
      expect(data.totalExpenses).toBe(100);
      expect(data.companyIncome).toBe(900);
      expect(data.transactions.length).toBe(2);
    } finally {
      await mem.stop();
    }
  });

  it('getDirectorDashboardData returns selected director name/email and metrics', async () => {
    const mem = await createInMemoryMongo();
    try {
      const d1 = uuidv4();
      const d2 = uuidv4();
      await mem.db.collection('directors').insertMany([
        { id: d1, name: 'Director A', email: 'a@example.com', status: 'approved' },
        { id: d2, name: 'Director B', email: 'b@example.com', status: 'approved' }
      ]);

      await mem.db.collection('transactions').insertMany([
        // company pool
        { id: uuidv4(), transaction_type: 'income', amount: 1000, transaction_date: new Date('2026-02-01') },
        { id: uuidv4(), transaction_type: 'expense', amount: 200, transaction_date: new Date('2026-02-02') },
        // director-specific
        {
          id: uuidv4(),
          transaction_type: 'income',
          account_type: 'director',
          director_id: d1,
          amount: 300,
          transaction_date: new Date('2026-02-03')
        },
        {
          id: uuidv4(),
          transaction_type: 'expense',
          account_type: 'director',
          director_id: d1,
          amount: 50,
          transaction_date: new Date('2026-02-04')
        },
        {
          id: uuidv4(),
          transaction_type: 'loan',
          director_id: d1,
          amount: 25,
          transaction_date: new Date('2026-02-05')
        },
        {
          id: uuidv4(),
          transaction_type: 'transfer',
          from_director_id: d1,
          to_director_id: d2,
          amount: 10,
          transaction_date: new Date('2026-02-06')
        },
        {
          id: uuidv4(),
          transaction_type: 'transfer',
          from_director_id: d2,
          to_director_id: d1,
          amount: 5,
          transaction_date: new Date('2026-02-07')
        }
      ]);

      const data = await getDirectorDashboardData(mem.db, d1, 'all');
      expect(data.directorId).toBe(d1);
      expect(data.directorName).toBe('Director A');
      expect(data.directorEmail).toBe('a@example.com');
      expect(data.directorOwnIncome).toBe(300);
      expect(data.directorExpenses).toBe(50);
      expect(data.loansGiven).toBe(25);
      expect(data.transfersOut).toBe(10);
      expect(data.transfersIn).toBe(5);
      expect(data.totalApprovedDirectors).toBe(2);
      expect(typeof data.balance).toBe('number');
    } finally {
      await mem.stop();
    }
  });

  it('buildTransactionsListQuery filters by selected month + project and excludes deleted', async () => {
    const mem = await createInMemoryMongo();
    try {
      const p1 = uuidv4();
      const p2 = uuidv4();

      await mem.db.collection('transactions').insertMany([
        {
          id: uuidv4(),
          transaction_type: 'income',
          amount: 100,
          project_id: p1,
          transaction_date: new Date('2026-01-10')
        },
        {
          id: uuidv4(),
          transaction_type: 'income',
          amount: 200,
          project_id: p2,
          transaction_date: new Date('2026-01-11')
        },
        {
          id: uuidv4(),
          transaction_type: 'income',
          amount: 300,
          project_id: p1,
          transaction_date: new Date('2026-02-12')
        },
        {
          id: uuidv4(),
          transaction_type: 'income',
          amount: 999,
          project_id: p1,
          is_deleted: true,
          transaction_date: new Date('2026-01-15')
        }
      ]);

      const query = buildTransactionsListQuery({
        period: 'month',
        month: '0',
        year: '2026',
        type: 'income',
        projectId: p1
      });
      const rows = await mem.db.collection('transactions').find(query).toArray();

      expect(rows).toHaveLength(1);
      expect(rows[0].project_id).toBe(p1);
      expect(rows[0].amount).toBe(100);
    } finally {
      await mem.stop();
    }
  });
});

