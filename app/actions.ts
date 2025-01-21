// app/actions.ts
'use server'

import { revalidatePath } from 'next/cache';
import {  getDb } from '@/lib/db';
import { MonthlyData, TopEntity, TransactionReason } from '@/types';

export async function getDashboardData() {
    try {
      const db = await getDb();
  
      const [monthlyData, topReceivers, topSenders, topReasons, grandExpense, grandIncome] = await Promise.all([
        // Monthly data
        db.all<MonthlyData[]>(`
          SELECT 
            strftime('%Y-%m', date) as month,
            SUM(CASE WHEN direction = 'outgoing' THEN transaction_amount ELSE 0 END) as expenses,
            SUM(CASE WHEN direction = 'incoming' THEN transaction_amount ELSE 0 END) as income
          FROM transactions 
          GROUP BY strftime('%Y-%m', date)
          ORDER BY month
        `),
  
        // Top 25 receivers
        db.all<TopEntity[]>(`
          SELECT 
            receiver as name,
            SUM(transaction_amount) as amount,
            COUNT(*) as count
          FROM transactions
          WHERE direction = 'outgoing' AND receiver IS NOT NULL
          GROUP BY receiver
          ORDER BY amount DESC
          LIMIT 25
        `),
  
        // Top 25 senders
        db.all<TopEntity[]>(`
          SELECT 
            payer as name,
            SUM(transaction_amount) as amount,
            COUNT(*) as count
          FROM transactions
          WHERE direction = 'incoming' AND payer IS NOT NULL
          GROUP BY payer
          ORDER BY amount DESC
          LIMIT 25
        `),
  
        // Top 25 reasons with categories
        db.all<TransactionReason[]>(`
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
        `),
        db.get<{totalExpense: number}>(`
            SELECT 
            SUM(transaction_amount) as totalExpense
            FROM transactions 
            WHERE direction = 'outgoing'
        `),
        db.get<{totalIncome: number}>(`
            SELECT 
            SUM(transaction_amount) as totalIncome
            FROM transactions 
            WHERE direction = 'incoming'
        `),
      ]);
  
      await db.close();
      revalidatePath('/');
  
      return {
        monthlyData,
        topReceivers,
        topSenders,
        topReasons,
        grandExpense,
        grandIncome
      };
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      throw error;
    }
  }

// export async function processTransactions(formData: FormData) {
//   try {
//     const file = formData.get('file') as File;
//     if (!file) {
//       throw new Error('No file provided');
//     }

//     const content = await file.text();
//     const data = JSON.parse(content);

//     // Process the transactions
//     // ... Your existing transaction processing logic here
    
//     revalidatePath('/');
//     return { success: true };
//   } catch (error) {
//     console.error('Error processing transactions:', error);
//     throw error;
//   }
// }

export async function getTotalExpense(){
    const db = await getDb();
    const totalExpense = await db.get<{totalExpense: number}>(`
        SELECT 
        SUM(transaction_amount) as totalExpense
        FROM transactions 
        WHERE direction = 'outgoing'
    `);
    await db.close();
    return totalExpense;
}

export async function getTotalIncome(){
    const db = await getDb();
    const totalIncome = await db.get<{totalIncome: number}>(`
        SELECT 
        SUM(transaction_amount) as totalIncome
        FROM transactions 
        WHERE direction = 'incoming'
    `);
    await db.close();
    return totalIncome;
}