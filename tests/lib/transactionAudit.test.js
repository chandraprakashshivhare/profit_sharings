import { describe, expect, it } from 'vitest';
import { insertTransactionAudit } from '../../lib/transactionAudit.js';
import { createInMemoryMongo } from '../helpers/mongo.js';

describe('lib/transactionAudit', () => {
  it('insertTransactionAudit inserts a row with expected fields', async () => {
    const mem = await createInMemoryMongo();
    try {
      const transaction = {
        id: 't1',
        transaction_type: 'income',
        amount: 123,
        description: 'hello',
        transaction_date: new Date('2026-01-02'),
        account_type: 'company',
        director_id: null,
        project_id: null,
        from_director_id: null,
        to_director_id: null
      };

      await insertTransactionAudit(mem.db, {
        action: 'create',
        actorId: 'd1',
        transaction
      });

      const rows = await mem.db.collection('transaction_audit').find({ transaction_id: 't1' }).toArray();
      expect(rows).toHaveLength(1);
      expect(rows[0].action).toBe('create');
      expect(rows[0].actor_id).toBe('d1');
      expect(rows[0].transaction_type).toBe('income');
      expect(rows[0].amount).toBe(123);
      expect(rows[0].recorded_at).toBeInstanceOf(Date);
    } finally {
      await mem.stop();
    }
  });

  it('insertTransactionAudit stores previous fields for updates', async () => {
    const mem = await createInMemoryMongo();
    try {
      const transaction = {
        id: 't2',
        transaction_type: 'expense',
        amount: 99,
        description: '',
        transaction_date: new Date('2026-01-03')
      };

      await insertTransactionAudit(mem.db, {
        action: 'update',
        actorId: 'd1',
        transaction,
        previous: { amount: 10, transaction_type: 'income' }
      });

      const row = await mem.db.collection('transaction_audit').findOne({ transaction_id: 't2' });
      expect(row.previous_amount).toBe(10);
      expect(row.previous_transaction_type).toBe('income');
    } finally {
      await mem.stop();
    }
  });
});

