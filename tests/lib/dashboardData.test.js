import { describe, expect, it } from 'vitest';
import {
  buildAuditListQuery,
  buildTransactionDateQuery,
  buildTransactionsListQuery,
  formatDashboardPeriodLabel
} from '../../lib/dashboardData.js';

function ymdLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('lib/dashboardData', () => {
  it('formatDashboardPeriodLabel formats all/month/year', () => {
    expect(formatDashboardPeriodLabel('all')).toBe('All time');
    expect(formatDashboardPeriodLabel('month', '0', '2026')).toBe('January 2026');
    expect(formatDashboardPeriodLabel('year', null, '2025')).toBe('FY 2025-26');
  });

  it('buildTransactionDateQuery produces empty query for all-time', () => {
    expect(buildTransactionDateQuery('all')).toEqual({ is_deleted: { $ne: true } });
  });

  it('buildTransactionDateQuery produces month range', () => {
    const q = buildTransactionDateQuery('month', '0', '2026');
    expect(q.transaction_date.$gte).toBeInstanceOf(Date);
    expect(q.transaction_date.$lte).toBeInstanceOf(Date);
    expect(ymdLocal(q.transaction_date.$gte)).toBe('2026-01-01');
    expect(ymdLocal(q.transaction_date.$lte)).toBe('2026-01-31');
  });

  it('buildTransactionDateQuery produces FY range', () => {
    const q = buildTransactionDateQuery('year', null, '2025');
    expect(ymdLocal(q.transaction_date.$gte)).toBe('2025-04-01');
    expect(ymdLocal(q.transaction_date.$lte)).toBe('2026-03-31');
  });

  it('buildTransactionsListQuery adds optional filters', () => {
    const q = buildTransactionsListQuery({
      period: 'all',
      type: 'income',
      accountType: 'director',
      directorId: 'd1',
      projectId: 'p1'
    });
    expect(q).toEqual({
      is_deleted: { $ne: true },
      transaction_type: 'income',
      account_type: 'director',
      director_id: { $in: ['d1'] },
      project_id: 'p1'
    });
  });

  it('buildTransactionsListQuery supports project-only filter', () => {
    const q = buildTransactionsListQuery({ period: 'all', projectId: 'p-only' });
    expect(q).toEqual({
      is_deleted: { $ne: true },
      project_id: 'p-only'
    });
  });

  it('buildTransactionsListQuery supports multi company + multiple directors', () => {
    const q = buildTransactionsListQuery({
      period: 'all',
      accountTypes: ['company', 'director'],
      directorIds: ['d1', 'd2']
    });

    expect(q).toEqual({
      is_deleted: { $ne: true },
      $or: [
        { account_type: 'company' },
        { account_type: 'director', director_id: { $in: ['d1', 'd2'] } }
      ]
    });
  });

  it('buildTransactionsListQuery keeps month range and adds project/type', () => {
    const q = buildTransactionsListQuery({
      period: 'month',
      month: '1',
      year: '2026',
      projectId: 'p2',
      type: 'income'
    });

    expect(q.transaction_date.$gte).toBeInstanceOf(Date);
    expect(q.transaction_date.$lte).toBeInstanceOf(Date);
    expect(ymdLocal(q.transaction_date.$gte)).toBe('2026-02-01');
    expect(ymdLocal(q.transaction_date.$lte)).toBe('2026-02-28');
    expect(q.project_id).toBe('p2');
    expect(q.transaction_type).toBe('income');
  });

  it('buildAuditListQuery maps transaction_date range to recorded_at', () => {
    const q = buildAuditListQuery({ period: 'month', month: '0', year: '2026' });
    expect(q.recorded_at).toBeTruthy();
    expect(ymdLocal(q.recorded_at.$gte)).toBe('2026-01-01');
  });
});

