import {
  calculateCompanyIncome,
  calculateCompanyBalance,
  calculateDirectorIncome,
  calculateDirectorBalance,
  getFinancialYearDates,
  getMonthDateRange
} from '@/lib/financial';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function buildTransactionDateQuery(period, month, year) {
  let query = { is_deleted: { $ne: true } };
  if (period === 'month' && month != null && year != null) {
    const { startDate, endDate } = getMonthDateRange(parseInt(year, 10), parseInt(month, 10));
    query.transaction_date = { $gte: startDate, $lte: endDate };
  } else if (period === 'year' && year != null) {
    const { startDate, endDate } = getFinancialYearDates(parseInt(year, 10));
    query.transaction_date = { $gte: startDate, $lte: endDate };
  }
  return query;
}

export function formatDashboardPeriodLabel(period, month, year) {
  if (period === 'all') return 'All time';
  if (period === 'month' && month != null && year != null) {
    return `${MONTH_NAMES[parseInt(month, 10)]} ${year}`;
  }
  if (period === 'year' && year != null) {
    const y = parseInt(year, 10);
    return `FY ${y}-${(y + 1).toString().slice(-2)}`;
  }
  return String(period || '');
}

/**
 * MongoDB filter for transaction list + CSV.
 *
 * Supports either:
 * - legacy single values: `accountType` + `directorId`
 * - multi selection: `accountTypes` + `directorIds`
 */
export function buildTransactionsListQuery({
  period = 'all',
  month,
  year,
  type,
  accountType,
  directorId,
  accountTypes,
  directorIds,
  projectId
}) {
  const query = { ...buildTransactionDateQuery(period, month, year) };
  if (type) query.transaction_type = type;
  if (projectId) query.project_id = projectId;

  const normalizedAccountTypes = accountTypes
    ? accountTypes.filter(Boolean)
    : accountType
      ? [accountType]
      : undefined;
  const normalizedDirectorIds = directorIds
    ? directorIds.filter(Boolean)
    : directorId
      ? [directorId]
      : undefined;

  if (normalizedAccountTypes && normalizedAccountTypes.length > 0) {
    const wantsCompany = normalizedAccountTypes.includes('company');
    const wantsDirector = normalizedAccountTypes.includes('director');

    if (wantsCompany && wantsDirector) {
      const directorPart = normalizedDirectorIds?.length
        ? { account_type: 'director', director_id: { $in: normalizedDirectorIds } }
        : { account_type: 'director' };

      query.$or = [{ account_type: 'company' }, directorPart];
    } else if (wantsCompany) {
      query.account_type = 'company';
    } else if (wantsDirector) {
      query.account_type = 'director';
      if (normalizedDirectorIds?.length) {
        query.director_id = { $in: normalizedDirectorIds };
      }
    }
  } else {
    // No explicit account filter: keep query free of account_type/director_id.
  }

  return query;
}

/** Filter audit log by when the action was recorded (same period rules as transactions). */
export function buildAuditListQuery({ period = 'all', month, year }) {
  const dq = buildTransactionDateQuery(period, month, year);
  if (!dq.transaction_date) return {};
  return { recorded_at: dq.transaction_date };
}

export async function getCompanyDashboardData(db, period, month, year) {
  const query = buildTransactionDateQuery(period, month, year);
  const transactions = await db.collection('transactions').find(query).sort({ transaction_date: -1 }).toArray();

  const totalIncome = transactions
    .filter((t) => t.transaction_type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter((t) => t.transaction_type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const companyIncome = calculateCompanyIncome(transactions);
  const companyBalance = calculateCompanyBalance(transactions);

  return {
    totalIncome,
    totalExpenses,
    companyIncome,
    companyBalance,
    period,
    month,
    year,
    transactions
  };
}

export async function getDirectorDashboardData(db, directorId, period, month, year) {
  const query = buildTransactionDateQuery(period, month, year);
  const transactions = await db.collection('transactions').find(query).sort({ transaction_date: -1 }).toArray();
  const totalDirectors = await db.collection('directors').countDocuments({ status: 'approved' });

  const directorOwnIncome = transactions
    .filter((t) => t.transaction_type === 'income' && t.account_type === 'director' && t.director_id === directorId)
    .reduce((sum, t) => sum + t.amount, 0);

  const directorExpenses = transactions
    .filter((t) => t.transaction_type === 'expense' && t.account_type === 'director' && t.director_id === directorId)
    .reduce((sum, t) => sum + t.amount, 0);

  const loansGiven = transactions
    .filter((t) => t.transaction_type === 'loan' && t.director_id === directorId)
    .reduce((sum, t) => sum + t.amount, 0);

  const transfersOut = transactions
    .filter((t) => t.transaction_type === 'transfer' && t.from_director_id === directorId)
    .reduce((sum, t) => sum + t.amount, 0);

  const transfersIn = transactions
    .filter((t) => t.transaction_type === 'transfer' && t.to_director_id === directorId)
    .reduce((sum, t) => sum + t.amount, 0);

  const shareOfIncome = calculateDirectorIncome(directorId, transactions, totalDirectors);
  const balance = calculateDirectorBalance(directorId, transactions, totalDirectors);

  const directorDoc = await db.collection('directors').findOne(
    { id: directorId },
    { projection: { name: 1, email: 1 } }
  );

  return {
    directorId,
    directorName: directorDoc?.name || '',
    directorEmail: directorDoc?.email || '',
    directorOwnIncome,
    directorExpenses,
    loansGiven,
    transfersOut,
    transfersIn,
    shareOfIncome,
    balance,
    period,
    month,
    year,
    totalApprovedDirectors: totalDirectors,
    transactions
  };
}
