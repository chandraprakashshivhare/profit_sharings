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

function formatIsoDateTime(d) {
  if (!d) return '';
  try {
    const date = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString();
  } catch {
    return '';
  }
}

export function transactionAuditExportCsv(entries, directorNameById, projectNameById) {
  const rows = [
    [
      'Action',
      'Amount',
      'Previous amount',
      'Previous type',
      'Type',
      'Transaction date',
      'Recorded at (UTC)',
      'Actor',
      'Account type',
      'Director',
      'Project',
      'From director',
      'To director',
      'Description',
      'Transaction ID',
      'Audit entry ID'
    ]
  ];
  for (const row of entries) {
    rows.push([
      row.action ?? '',
      row.amount ?? '',
      row.previous_amount ?? '',
      row.previous_transaction_type ?? '',
      row.transaction_type ?? '',
      formatTransactionDate(row.transaction_date),
      formatIsoDateTime(row.recorded_at),
      row.actor_id ? directorNameById[row.actor_id] || row.actor_id : '',
      row.account_type ?? '',
      row.director_id ? directorNameById[row.director_id] || row.director_id : '',
      row.project_id ? projectNameById[row.project_id] || row.project_id : '',
      row.from_director_id ? directorNameById[row.from_director_id] || row.from_director_id : '',
      row.to_director_id ? directorNameById[row.to_director_id] || row.to_director_id : '',
      row.description ?? '',
      row.transaction_id ?? '',
      row.id ?? ''
    ]);
  }
  return rowsToCsv(rows);
}

export function transactionsListExportCsv(transactions, directorNameById, projectNameById) {
  const rows = [
    [
      'Date',
      'Transaction ID',
      'Bank Name',
      'Type',
      'Amount',
      'Account Type',
      'Director',
      'Project',
      'From Director',
      'To Director',
      'Description',
      'By'
    ]
  ];
  for (const t of transactions) {
    rows.push([
      formatTransactionDate(t.transaction_date),
      t.transaction_id ?? '',
      t.bank_name ?? '',
      t.transaction_type ?? '',
      t.amount ?? '',
      t.account_type ?? '',
      t.director_id ? directorNameById[t.director_id] || t.director_id : '',
      t.project_id ? projectNameById[t.project_id] || t.project_id : '',
      t.from_director_id ? directorNameById[t.from_director_id] || t.from_director_id : '',
      t.to_director_id ? directorNameById[t.to_director_id] || t.to_director_id : '',
      t.description ?? '',
      (() => {
        const actorId = t.updated_by || t.created_by;
        if (!actorId) return '';
        return directorNameById[actorId] || actorId;
      })()
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
  const rows = [
    [
      'My Income Share',
      'Personal Income',
      'My Expenses',
      'Loans Given',
      'Transfers Out',
      'Transfers In',
      'Final Balance'
    ],
    [shareOfIncome, directorOwnIncome, directorExpenses, loansGiven, transfersOut, transfersIn, balance]
  ];
  return rowsToCsv(rows);
}

export function allDirectorsDashboardExportCsv(rowsData) {
  const rows = [
    [
      'Director Name',
      'Director Email',
      'My Income Share',
      'Personal Income',
      'My Expenses',
      'Loans Given',
      'Transfers Out',
      'Transfers In',
      'Final Balance'
    ]
  ];

  for (const d of rowsData) {
    rows.push([
      d.directorName ?? '',
      d.directorEmail ?? '',
      d.shareOfIncome ?? 0,
      d.directorOwnIncome ?? 0,
      d.directorExpenses ?? 0,
      d.loansGiven ?? 0,
      d.transfersOut ?? 0,
      d.transfersIn ?? 0,
      d.balance ?? 0
    ]);
  }

  return rowsToCsv(rows);
}
