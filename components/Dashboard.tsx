// app/components/Dashboard.tsx
'use client'

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { MonthlyData, TopEntity, TransactionReason } from '@/types';
import { getDashboardData } from '@/app/actions';
import { MonthlyTransactions } from './monthly';
import { CategoryPieChart } from '@/components/CategoryPieChart';


export function Dashboard() {
    const [data, setData] = useState<{
        monthlyData: MonthlyData[];
        topReceivers: TopEntity[];
        topSenders: TopEntity[];
        topReasons: TransactionReason[];
        grandExpense?: { totalExpense: number };
        grandIncome?: { totalIncome: number };
    } | null>(null);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const dashboardData = await getDashboardData();
            setData(dashboardData);
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center h-screen">Loading...</div>;
    }

    if (!data) {
        return <div>Error loading data</div>;
    }

    return (
        <div className="container mx-auto p-4 space-y-4">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold">Transaction Dashboard</h1>

            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Monthly Expenses and Income</CardTitle>
                </CardHeader>
                <CardContent className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data.monthlyData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="expenses" stroke="#ff7c43" name="Expenses" />
                            <Line type="monotone" dataKey="income" stroke="#00C49F" name="Income" />
                        </LineChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <Card>
                <CardContent>
                    <div className="text-lg text-gray-800 mb-4">
                        The total expenses and income since October 2024
                    </div>
                    <div className="text-xl font-bold text-red-600 mb-2">
                        Total Expenses: {data.grandExpense?.totalExpense.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
                    </div>
                    <div className="text-xl font-bold text-green-600">
                        Total Income: {data.grandIncome?.totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
                    </div>
                </CardContent>
            </Card>


            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TransactionTable
                    title="Top 25 Recipients"
                    data={data.topReceivers}
                    columns={['Recipient', 'Amount', 'Count']}
                />
                <TransactionTable
                    title="Top 25 Senders"
                    data={data.topSenders}
                    columns={['Sender', 'Amount', 'Count']}
                />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Top 25 Transaction Reasons</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-96 overflow-auto">
                        <table className="w-full">
                            <thead className="sticky top-0 bg-white">
                                <tr>
                                    <th className="p-2 text-left">Reason</th>
                                    <th className="p-2 text-left">Category</th>
                                    <th className="p-2 text-right">Amount (ETB)</th>
                                    <th className="p-2 text-right">Count</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.topReasons.map((reason, idx) => (
                                    <tr key={idx} className="border-t">
                                        <td className="p-2">{reason.reason}</td>
                                        <td className="p-2">{reason.category}</td>
                                        <td className="p-2 text-right">
                                            {reason.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-2 text-right">{reason.count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <MonthlyTransactions />

            <main className="container mx-auto p-4">
                <CategoryPieChart />
            </main>
        </div>
    );
}

interface TransactionTableProps {
    title: string;
    data: TopEntity[];
    columns: string[];
}

function TransactionTable({ title, data, columns }: TransactionTableProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-96 overflow-auto">
                    <table className="w-full">
                        <thead className="sticky top-0 bg-white">
                            <tr>
                                <th className="p-2 text-left">{columns[0]}</th>
                                <th className="p-2 text-right">Amount (ETB)</th>
                                <th className="p-2 text-right">Count</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((item, idx) => (
                                <tr key={idx} className="border-t">
                                    <td className="p-2">{item.name}</td>
                                    <td className="p-2 text-right">
                                        {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-2 text-right">{item.count}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}

