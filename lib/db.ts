// lib/db.ts
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { MonthlyData, TopEntity, TransactionReason } from '@/types';

// Initialize database
export async function getDb() {
  return open({
    filename: 'transactions.db',
    driver: sqlite3.Database
  });
}

// Setup database
export async function setupDatabase() {
  const db = await getDb();
  
  await db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      transaction_amount REAL,
      current_balance REAL,
      total_amount REAL,
      reason TEXT,
      receiver TEXT,
      payer TEXT,
      direction TEXT,
      category TEXT
    )
  `);

  return db;
}

// Get monthly data
export async function getMonthlyData(): Promise<MonthlyData[]> {
  const db = await getDb();
  
  return db.all(`
    SELECT 
      strftime('%Y-%m', date) as month,
      SUM(CASE WHEN direction = 'outgoing' THEN transaction_amount ELSE 0 END) as expenses,
      SUM(CASE WHEN direction = 'incoming' THEN transaction_amount ELSE 0 END) as income
    FROM transactions 
    GROUP BY strftime('%Y-%m', date)
    ORDER BY month
  `);
}

// Get top receivers
export async function getTopReceivers(): Promise<TopEntity[]> {
  const db = await getDb();
  
  return db.all(`
    SELECT 
      receiver as name,
      SUM(transaction_amount) as amount,
      COUNT(*) as count
    FROM transactions
    WHERE direction = 'outgoing' AND receiver IS NOT NULL
    GROUP BY receiver
    ORDER BY amount DESC
    LIMIT 25
  `);
}

// Get top senders
export async function getTopSenders(): Promise<TopEntity[]> {
  const db = await getDb();
  
  return db.all(`
    SELECT 
      payer as name,
      SUM(transaction_amount) as amount,
      COUNT(*) as count
    FROM transactions
    WHERE direction = 'incoming' AND payer IS NOT NULL
    GROUP BY payer
    ORDER BY amount DESC
    LIMIT 25
  `);
}

// Get top reasons
export async function getTopReasons(): Promise<TransactionReason[]> {
  const db = await getDb();
  
  return db.all(`
    SELECT 
      reason,
      category,
      SUM(transaction_amount) as amount,
      COUNT(*) as count
    FROM transactions
    WHERE reason IS NOT NULL
    GROUP BY reason, category
    ORDER BY count DESC
    LIMIT 25
  `);
}