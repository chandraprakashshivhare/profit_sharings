import { v4 as uuidv4 } from 'uuid';

/**
 * Append-only log for transaction create / update / delete.
 * `transaction` is the row snapshot (after save for update; before delete for delete).
 * `previous` — for updates only, prior amount & type (full row available from caller if needed later).
 */
export async function insertTransactionAudit(db, { action, actorId, transaction, previous }) {
  const entry = {
    id: uuidv4(),
    action,
    actor_id: actorId,
    recorded_at: new Date(),
    transaction_id: transaction.id,
    transaction_type: transaction.transaction_type,
    amount: transaction.amount,
    description: transaction.description || '',
    transaction_date: transaction.transaction_date,
    account_type: transaction.account_type ?? null,
    director_id: transaction.director_id ?? null,
    project_id: transaction.project_id ?? null,
    from_director_id: transaction.from_director_id ?? null,
    to_director_id: transaction.to_director_id ?? null
  };
  if (previous) {
    entry.previous_amount = previous.amount;
    entry.previous_transaction_type = previous.transaction_type;
  }
  await db.collection('transaction_audit').insertOne(entry);
}
