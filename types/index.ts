// types/index.ts
export interface TransactionData {
  id: number;
  date: string;
  transaction_amount: number;
  current_balance: number;
  total_amount: number;
  reason: string;
  receiver: string;
  payer: string;
  direction: 'incoming' | 'outgoing';
  category: string;
}

export interface MonthlyData {
  month: string;
  expenses: number;
  income: number;
}

export interface TopEntity {
  name: string;
  amount: number;
  count: number;
}

export interface TransactionReason {
  reason: string;
  category: string;
  amount: number;
  count: number;
}

