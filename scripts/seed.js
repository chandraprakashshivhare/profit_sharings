#!/usr/bin/env node

/**
 * Database Seed Script
 * Creates default approved director if no directors exist
 */

const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'technomatz_finance';

// Default director credentials
const DEFAULT_DIRECTOR = {
  name: 'CP Shivhare',
  email: 'cpshivhare@technomatz.com',
  password: 'Admin@123',
  status: 'approved'
};

async function seedDatabase() {
  console.log('🌱 Starting database seed...');
  
  let client;
  
  try {
    // Connect to MongoDB
    client = await MongoClient.connect(MONGO_URL);
    const db = client.db(DB_NAME);
    
    console.log('✓ Connected to MongoDB');
    
    // Check if default director already exists
    const defaultDirector = await db.collection('directors').findOne({ 
      email: DEFAULT_DIRECTOR.email.toLowerCase() 
    });
    
    if (!defaultDirector) {
      console.log('📝 Creating default director...');
      
      // Hash password
      const passwordHash = await bcrypt.hash(DEFAULT_DIRECTOR.password, 10);
      
      // Create default director
      const director = {
        id: uuidv4(),
        name: DEFAULT_DIRECTOR.name,
        email: DEFAULT_DIRECTOR.email.toLowerCase(),
        password_hash: passwordHash,
        status: DEFAULT_DIRECTOR.status,
        created_at: new Date(),
        is_default: true
      };
      
      await db.collection('directors').insertOne(director);
      
      console.log('✓ Default director created successfully!');
      console.log('');
      console.log('═══════════════════════════════════════════════');
      console.log('📧 Default Director Credentials:');
      console.log('   Email:    ' + DEFAULT_DIRECTOR.email);
      console.log('   Password: ' + DEFAULT_DIRECTOR.password);
      console.log('═══════════════════════════════════════════════');
      console.log('');
      console.log('⚠️  IMPORTANT: Please change the password after first login!');
      console.log('');
    } else {
      console.log('✓ Default director already exists: ' + DEFAULT_DIRECTOR.email);
      
      // Ensure the default director is approved
      if (defaultDirector.status !== 'approved') {
        await db.collection('directors').updateOne(
          { email: DEFAULT_DIRECTOR.email.toLowerCase() },
          { $set: { status: 'approved' } }
        );
        console.log('✓ Default director status updated to approved');
      }
    }
    
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
