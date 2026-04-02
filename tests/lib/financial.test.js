import { describe, expect, it } from 'vitest';
import {
  calculateCompanyBalance,
  calculateCompanyIncome,
  calculateDirectorBalance,
  calculateDirectorIncome,
  getFinancialYearDates,
  getMonthDateRange
} from '../../lib/financial.js';

function ymdLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('lib/financial', () => {
  it('getFinancialYearDates returns April→March range', () => {
    const { startDate, endDate } = getFinancialYearDates(2025);
    // Use local date parts to avoid timezone→UTC shifts.
    expect(ymdLocal(startDate)).toBe('2025-04-01');
    expect(ymdLocal(endDate)).toBe('2026-03-31');
  });

  it('getMonthDateRange returns first/last day of month', () => {
    const { startDate, endDate } = getMonthDateRange(2026, 0); // Jan
    expect(ymdLocal(startDate)).toBe('2026-01-01');
    expect(ymdLocal(endDate)).toBe('2026-01-31');
  });

  it('calculateCompanyIncome uses income - expenses', () => {
    const tx = [
      { transaction_type: 'income', amount: 100 },
      { transaction_type: 'income', amount: 50 },
      { transaction_type: 'expense', amount: 30 },
      { transaction_type: 'loan', amount: 999 }
    ];
    expect(calculateCompanyIncome(tx)).toBe(120);
  });

  it('calculateCompanyBalance includes loans received (company)', () => {
    const tx = [
      { transaction_type: 'income', amount: 100 },
      { transaction_type: 'expense', amount: 30 },
      { transaction_type: 'loan', account_type: 'company', amount: 20 }
    ];
    expect(calculateCompanyBalance(tx)).toBe(90);
  });

  it('calculateDirectorIncome splits company income equally', () => {
    const tx = [
      { transaction_type: 'income', amount: 100 },
      { transaction_type: 'expense', amount: 20 }
    ];
    expect(calculateDirectorIncome('d1', tx, 2)).toBe(40);
  });

  it('calculateDirectorBalance follows formula', () => {
    const tx = [
      // NOTE: project code defines "company income" as (all income) - (all expenses),
      // including director-level income/expense transactions too.
      { transaction_type: 'income', amount: 100 },
      { transaction_type: 'expense', amount: 20 },

      // director own income/expense
      { transaction_type: 'income', account_type: 'director', director_id: 'd1', amount: 10 },
      { transaction_type: 'expense', account_type: 'director', director_id: 'd1', amount: 3 },

      // loans and transfers
      { transaction_type: 'loan', director_id: 'd1', amount: 5 },
      { transaction_type: 'transfer', from_director_id: 'd1', to_director_id: 'd2', amount: 7 },
      { transaction_type: 'transfer', from_director_id: 'd2', to_director_id: 'd1', amount: 2 }
    ];

    // All-income = 110; all-expenses = 23; company income = 87; share for 2 = 43.5
    // 10 - 3 - 5 - 7 + 2 + 43.5 = 40.5
    expect(calculateDirectorBalance('d1', tx, 2)).toBe(40.5);
  });
});

