// app/actions/categories.ts
'use server'

import { getDb } from '@/lib/db'

export interface CategoryData {
  category: string;
  totalAmount: number;
  incomingAmount: number;
  outgoingAmount: number;
  transactionCount: number;
}

export async function getCategoryAnalysis(): Promise<CategoryData[]> {
  const db = await getDb();
  
  const categories = await db.all<CategoryData[]>(`
    SELECT 
      category,
      SUM(transaction_amount) as totalAmount,
      SUM(CASE WHEN direction = 'incoming' THEN transaction_amount ELSE 0 END) as incomingAmount,
      SUM(CASE WHEN direction = 'outgoing' THEN transaction_amount ELSE 0 END) as outgoingAmount,
      COUNT(*) as transactionCount
    FROM transactions 
    GROUP BY category
    ORDER BY totalAmount DESC
  `);

  await db.close();
  return categories;
}