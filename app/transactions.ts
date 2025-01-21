// app/actions/transactions.ts
'use server'

import { getDb } from '@/lib/db'
import { TransactionData } from '@/types'

export async function getTransactionsByMonth() {
  const db = await getDb();
  
  const transactions = await db.all<TransactionData[]>(`
    SELECT 
      id,
      date,
      transaction_amount,
      current_balance,
      total_amount,
      reason,
      receiver,
      payer,
      direction,
      category
    FROM transactions 
    ORDER BY date DESC
  `);

  await db.close();

  // Group transactions by month
  const groupedTransactions = transactions.reduce((acc, transaction) => {
    const month = transaction.date.substring(0, 7); // Get YYYY-MM
    if (!acc[month]) {
      acc[month] = [];
    }
    acc[month].push(transaction);
    return acc;
  }, {} as Record<string, TransactionData[]>);

  return groupedTransactions;
}