'use client'
import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TransactionData } from '@/types';
import { getTransactionsByMonth } from '@/app/transactions';

type SortField = 'date' | 'transaction_amount' | 'category';
type SortDirection = 'asc' | 'desc';
type FilterType = 'all' | 'incoming' | 'outgoing';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString('en-ET', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MonthlyTransactions() {
  const [groupedTransactions, setGroupedTransactions] = useState<Record<string, TransactionData[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterType, setFilterType] = useState<FilterType>('all');

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      const data = await getTransactionsByMonth();
      setGroupedTransactions(data);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterTransactions = (transactions: TransactionData[]) => {
    return transactions.filter(transaction => {
      const matchesSearch = 
        transaction.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.receiver?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.payer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.category?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesFilter = 
        filterType === 'all' ||
        (filterType === 'incoming' && transaction.direction === 'incoming') ||
        (filterType === 'outgoing' && transaction.direction === 'outgoing');

      return matchesSearch && matchesFilter;
    });
  };

  const sortTransactions = (transactions: TransactionData[]) => {
    return [...transactions].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'date':
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'transaction_amount':
          comparison = a.transaction_amount - b.transaction_amount;
          break;
        case 'category':
          comparison = (a.category || '').localeCompare(b.category || '');
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  const months = Object.keys(groupedTransactions).sort().reverse();

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <Input
          placeholder="Search transactions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="md:w-64"
        />
        
        <Select
          value={filterType}
          onValueChange={(value: FilterType) => setFilterType(value)}
        >
          <SelectTrigger className="md:w-40">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Transactions</SelectItem>
            <SelectItem value="incoming">Incoming</SelectItem>
            <SelectItem value="outgoing">Outgoing</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={sortField}
          onValueChange={(value: SortField) => setSortField(value)}
        >
          <SelectTrigger className="md:w-40">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Date</SelectItem>
            <SelectItem value="transaction_amount">Amount</SelectItem>
            <SelectItem value="category">Category</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={sortDirection}
          onValueChange={(value: SortDirection) => setSortDirection(value)}
        >
          <SelectTrigger className="md:w-40">
            <SelectValue placeholder="Sort direction" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="asc">Ascending</SelectItem>
            <SelectItem value="desc">Descending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {months.map(month => {
        const transactions = sortTransactions(filterTransactions(groupedTransactions[month]));
        if (transactions.length === 0) return null;

        // const monthTotal = transactions.reduce((sum, t) => sum + t.transaction_amount, 0);
        const startBalance = transactions[transactions.length - 1].current_balance;
        const lastBalance = transactions[0].current_balance;
        const incomingTotal = transactions
          .filter(t => t.direction === 'incoming')
          .reduce((sum, t) => sum + t.transaction_amount, 0);
        const outgoingTotal = transactions
          .filter(t => t.direction === 'outgoing')
          .reduce((sum, t) => sum + t.transaction_amount, 0);

        return (
          <Card key={month} className="mb-6">
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>{new Date(month).toLocaleString('en-ET', { year: 'numeric', month: 'long' })}</span>
                <div className="text-sm font-normal space-x-4">
                  <span>Start Balance: {formatCurrency(startBalance)}</span>
                  <span className="text-green-600">Income: {formatCurrency(incomingTotal)}</span>
                  <span className="text-red-600">Expenses: {formatCurrency(outgoingTotal)}</span>
                  <span>Current Balance: {formatCurrency(lastBalance)}</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-left">Type</th>
                      <th className="p-2 text-left">Category</th>
                      <th className="p-2 text-left">Description</th>
                      <th className="p-2 text-left">From/To</th>
                      <th className="p-2 text-right">Amount</th>
                      <th className="p-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((transaction) => (
                      <tr key={transaction.id} className="border-b">
                        <td className="p-2">{formatDate(transaction.date)}</td>
                        <td className="p-2">
                          <span className={`px-2 py-1 rounded text-sm ${
                            transaction.direction === 'incoming' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {transaction.direction === 'incoming' ? 'Credit' : 'Debit'}
                          </span>
                        </td>
                        <td className="p-2">{transaction.category}</td>
                        <td className="p-2">{transaction.reason}</td>
                        <td className="p-2">
                          {transaction.direction === 'incoming' 
                            ? transaction.payer 
                            : transaction.receiver}
                        </td>
                        <td className="p-2 text-right font-medium">
                          <span className={transaction.direction === 'incoming' 
                            ? 'text-green-600' 
                            : 'text-red-600'
                          }>
                            {formatCurrency(transaction.transaction_amount)}
                          </span>
                        </td>
                        <td className="p-2 text-right">
                          {formatCurrency(transaction.current_balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}