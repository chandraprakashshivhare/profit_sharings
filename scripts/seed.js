#!/usr/bin/env node

/**
 * Database Seed Script
 * Seeds default directors plus initial transactions and transaction audit entries.
 */

const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'technomatz_finance';

// Default directors credentials (dummy)
// Seed script creates these directors (if missing) and also inserts initial transactions + audit logs.
const SEED_DIRECTORS = [
  {
    name: 'CP Shivhare',
    email: 'cpshivhare@technomatz.com',
    password: 'Admin@123'
  },
  {
    name: 'Arvind',
    email: 'arvind@technomatz.com',
    password: 'Admin@123'
  }
];

const normalizeEmail = (email) => (email || '').toLowerCase();

const makeSeedTransactionDate = () => new Date(); // used for transaction_date and audit filtering

const SEED_TRANSACTIONS = [
  {
    seed_key: 'seed:income:company:1',
    transaction_type: 'income',
    account_type: 'company',
    director_id: null,
    project_id: null,
    from_director_id: null,
    to_director_id: null,
    amount: 100000,
    description: '[seed] Company income (initial)'
  },
  {
    seed_key: 'seed:expense:company:1',
    transaction_type: 'expense',
    account_type: 'company',
    director_id: null,
    project_id: null,
    from_director_id: null,
    to_director_id: null,
    amount: 25000,
    description: '[seed] Company expense (initial)'
  },
  {
    seed_key: 'seed:loan:director-to-company:1',
    transaction_type: 'loan',
    account_type: 'company',
    director_id: '__LENDING_DIRECTOR__',
    project_id: null,
    from_director_id: null,
    to_director_id: null,
    amount: 40000,
    description: '[seed] Loan given to company (initial)'
  },
  {
    seed_key: 'seed:transfer:director-to-director:1',
    transaction_type: 'transfer',
    account_type: 'company',
    director_id: null,
    project_id: null,
    from_director_id: '__FROM_DIRECTOR__',
    to_director_id: '__TO_DIRECTOR__',
    amount: 10000,
    description: '[seed] Transfer between directors (initial)'
  }
];

function buildTransactionAuditEntry({ action, actorId, transaction, previous }) {
  // Mirrors `lib/transactionAudit.js` so seeded entries appear in the audit page.
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

  return entry;
}

async function seedDatabase() {
  console.log('🌱 Starting database seed...');
  
  let client;
  
  try {
    // Connect to MongoDB
    client = await MongoClient.connect(MONGO_URL);
    const db = client.db(DB_NAME);
    
    console.log('✓ Connected to MongoDB');

    // 1) Ensure default directors exist (and are approved)
    const createdOrExistingDirectors = [];
    for (const seedDirector of SEED_DIRECTORS) {
      const email = normalizeEmail(seedDirector.email);
      const existing = await db.collection('directors').findOne({ email });

      if (!existing) {
        console.log(`📝 Creating default director: ${seedDirector.email}`);

        const passwordHash = await bcrypt.hash(seedDirector.password, 10);

        const director = {
          id: uuidv4(),
          name: seedDirector.name,
          email,
          password_hash: passwordHash,
          status: 'approved',
          created_at: new Date(),
          is_default: true
        };

        await db.collection('directors').insertOne(director);
        createdOrExistingDirectors.push(director);
      } else {
        if (existing.status !== 'approved') {
          await db.collection('directors').updateOne(
            { id: existing.id },
            { $set: { status: 'approved' } }
          );
          console.log(`✓ Director status updated to approved: ${seedDirector.email}`);
        }
        createdOrExistingDirectors.push(existing);
      }
    }

    const directorOne = createdOrExistingDirectors[0];
    const directorTwo = createdOrExistingDirectors[1];

    // 2) Insert initial transactions + audit logs (so they appear in Audit page)
    const txDate = makeSeedTransactionDate();
    const txCollection = db.collection('transactions');
    const auditCollection = db.collection('transaction_audit');

    let createdTxCount = 0;
    for (const seedTx of SEED_TRANSACTIONS) {
      const existingTx = await txCollection.findOne({ seed_key: seedTx.seed_key });
      if (existingTx) continue;

      const txId = uuidv4();
      const transaction = {
        id: txId,
        seed_key: seedTx.seed_key,
        transaction_type: seedTx.transaction_type,
        amount: seedTx.amount,
        account_type: seedTx.account_type || 'company',
        director_id:
          seedTx.director_id === '__LENDING_DIRECTOR__' ? directorOne.id : (seedTx.director_id ?? null),
        project_id: seedTx.project_id ?? null,
        from_director_id:
          seedTx.from_director_id === '__FROM_DIRECTOR__' ? directorOne.id : (seedTx.from_director_id ?? null),
        to_director_id:
          seedTx.to_director_id === '__TO_DIRECTOR__' ? directorTwo.id : (seedTx.to_director_id ?? null),
        description: seedTx.description || '',
        transaction_date: txDate,
        created_at: new Date(),
        created_by: directorOne.id
      };

      await txCollection.insertOne(transaction);

      // Insert audit entry for the CREATE action
      const existingAudit = await auditCollection.findOne({ transaction_id: transaction.id });
      if (!existingAudit) {
        const audit = buildTransactionAuditEntry({
          action: 'create',
          actorId: directorOne.id,
          transaction
        });
        audit.seed_key = seedTx.seed_key; // helps with idempotency/debugging
        await auditCollection.insertOne(audit);
      }

      createdTxCount++;
    }

    console.log(`✓ Seeded directors (2).`);
    console.log(`✓ Inserted ${createdTxCount} seeded transactions + audit log entries (if missing).`);

    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('📧 Default Director Credentials:');
    for (const seedDirector of SEED_DIRECTORS) {
      console.log(`   Email:    ${seedDirector.email}`);
      console.log(`   Password: ${seedDirector.password}`);
    }
    console.log('═══════════════════════════════════════════════');
    console.log('');
    console.log('⚠️  IMPORTANT: Please change the password after first login!');
    console.log('');

    console.log('✓ Database seed completed!');
    
  } catch (error) {
    console.error('✗ Seed failed:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('✓ MongoDB connection closed');
    }
  }
}

// Run seed
seedDatabase();
