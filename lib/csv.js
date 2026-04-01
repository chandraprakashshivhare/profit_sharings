export function escapeCsvCell(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv(rows) {
  const lines = rows.map((row) => row.map(escapeCsvCell).join(','));
  return '\uFEFF' + lines.join('\r\n');
}

export function companyDashboardExportCsv(data) {
  const { totalIncome, totalExpenses, companyIncome, companyBalance } = data;
  const rows = [
    ['Total Income', 'Total Expenses', 'Net Income', 'Company Balance'],
    [totalIncome, totalExpenses, companyIncome, companyBalance]
  ];
  return rowsToCsv(rows);
}

function formatTransactionDate(d) {
  if (!d) return '';
  try {
    const date = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

export function transactionsListExportCsv(transactions, directorNameById, projectNameById) {
  const rows = [
    [
      'Date',
      'Type',
      'Amount',
      'Account Type',
      'Director',
      'Project',
      'From Director',
      'To Director',
      'Description'
    ]
  ];
  for (const t of transactions) {
    rows.push([
      formatTransactionDate(t.transaction_date),
      t.transaction_type ?? '',
      t.amount ?? '',
      t.account_type ?? '',
      t.director_id ? directorNameById[t.director_id] || t.director_id : '',
      t.project_id ? projectNameById[t.project_id] || t.project_id : '',
      t.from_director_id ? directorNameById[t.from_director_id] || t.from_director_id : '',
      t.to_director_id ? directorNameById[t.to_director_id] || t.to_director_id : '',
      t.description ?? ''
    ]);
  }
  return rowsToCsv(rows);
}

export function directorDashboardExportCsv(data) {
  const {
    shareOfIncome,
    directorOwnIncome,
    directorExpenses,
    loansGiven,
    transfersOut,
    transfersIn,
    balance
  } = data;
  const transfersCell = `Out: ${transfersOut}; In: ${transfersIn}`;
  const rows = [
    [
      'My Income Share',
      'Personal Income',
      'My Expenses',
      'Loans Given',
      'Transfers',
      'Final Balance'
    ],
    [shareOfIncome, directorOwnIncome, directorExpenses, loansGiven, transfersCell, balance]
  ];
  return rowsToCsv(rows);
}
