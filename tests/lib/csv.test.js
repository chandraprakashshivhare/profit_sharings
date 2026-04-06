import { describe, expect, it } from 'vitest';
import {
  allDirectorsDashboardExportCsv,
  directorDashboardExportCsv,
  escapeCsvCell,
  rowsToCsv,
  transactionAuditExportCsv,
  transactionsListExportCsv
} from '../../lib/csv.js';

describe('lib/csv', () => {
  it('escapeCsvCell handles null and plain text', () => {
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
    expect(escapeCsvCell('abc')).toBe('abc');
  });

  it('escapeCsvCell quotes comma/newline/double-quote', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('a\nb')).toBe('"a\nb"');
    expect(escapeCsvCell('a"b')).toBe('"a""b"');
  });

  it('rowsToCsv prepends UTF-8 BOM', () => {
    const csv = rowsToCsv([['A', 'B'], ['1', '2']]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.includes('A,B')).toBe(true);
    expect(csv.includes('1,2')).toBe(true);
  });

  it('transactionsListExportCsv includes transaction_id and bank_name', () => {
    const rows = [
      {
        id: 'internal-id-1',
        transaction_id: 'TXN-1',
        bank_name: 'HDFC',
        transaction_date: new Date('2026-01-02'),
        transaction_type: 'income',
        amount: 1000,
        account_type: 'company',
        director_id: 'd1',
        project_id: 'p1',
        from_director_id: null,
        to_director_id: null,
        description: 'Income row',
        created_by: 'd1'
      }
    ];
    const csv = transactionsListExportCsv(rows, { d1: 'Director One' }, { p1: 'Project One' });
    expect(csv).toContain('Transaction ID');
    expect(csv).toContain('Bank Name');
    expect(csv).toContain('TXN-1');
    expect(csv).toContain('HDFC');
    expect(csv).toContain('Director One');
    expect(csv).toContain('Project One');
  });

  it('transactionAuditExportCsv maps actor/directors/projects and ids', () => {
    const entries = [
      {
        id: 'audit-1',
        action: 'create',
        amount: 100,
        transaction_type: 'income',
        transaction_date: new Date('2026-01-05'),
        recorded_at: new Date('2026-01-06T10:00:00Z'),
        actor_id: 'd1',
        account_type: 'company',
        director_id: 'd2',
        project_id: 'p1',
        from_director_id: 'd1',
        to_director_id: 'd2',
        description: 'audit row',
        transaction_id: 't1'
      }
    ];
    const csv = transactionAuditExportCsv(
      entries,
      { d1: 'Director One', d2: 'Director Two' },
      { p1: 'Project One' }
    );
    expect(csv).toContain('Director One');
    expect(csv).toContain('Director Two');
    expect(csv).toContain('Project One');
    expect(csv).toContain('audit-1');
    expect(csv).toContain('t1');
  });

  it('directorDashboardExportCsv includes director identity and transfer columns', () => {
    const csv = directorDashboardExportCsv({
      directorName: 'Director One',
      directorEmail: 'director.one@example.com',
      shareOfIncome: 10,
      directorOwnIncome: 20,
      directorExpenses: 5,
      loansGiven: 2,
      transfersOut: 3,
      transfersIn: 4,
      balance: 24
    });

    expect(csv).toContain('Director Name');
    expect(csv).toContain('Director Email');
    expect(csv).toContain('Transfers Out');
    expect(csv).toContain('Transfers In');
    expect(csv).toContain('Final Balance');
    expect(csv).toContain('Director One');
    expect(csv).toContain('director.one@example.com');
  });

  it('allDirectorsDashboardExportCsv exports one row per director', () => {
    const csv = allDirectorsDashboardExportCsv([
      {
        directorName: 'A',
        directorEmail: 'a@example.com',
        shareOfIncome: 1,
        directorOwnIncome: 2,
        directorExpenses: 3,
        loansGiven: 4,
        transfersOut: 5,
        transfersIn: 6,
        balance: 7
      },
      {
        directorName: 'B',
        directorEmail: 'b@example.com',
        shareOfIncome: 10,
        directorOwnIncome: 20,
        directorExpenses: 30,
        loansGiven: 40,
        transfersOut: 50,
        transfersIn: 60,
        balance: 70
      }
    ]);

    expect(csv).toContain('Director Name');
    expect(csv).toContain('a@example.com');
    expect(csv).toContain('b@example.com');
  });
});

