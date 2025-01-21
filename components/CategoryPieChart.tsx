import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { getCategoryAnalysis, CategoryData } from '@/app/categories';

const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8',
  '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c', '#d0ed57',
  '#ff7c43', '#665191', '#a05195', '#d45087', '#f95d6a'
];

type ViewMode = 'total' | 'incoming' | 'outgoing';


const CustomTooltip = ({ active, payload }: any) => { // eslint-disable-line
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-4 rounded-lg shadow-lg border">
        <p className="text-lg font-semibold">{data.category}</p>
        <div className="space-y-1">
          <p className="text-sm text-gray-600">
            Total Amount: {formatCurrency(data.totalAmount)}
          </p>
          <p className="text-sm text-green-600">
            Incoming: {formatCurrency(data.incomingAmount)}
          </p>
          <p className="text-sm text-red-600">
            Outgoing: {formatCurrency(data.outgoingAmount)}
          </p>
          <p className="text-sm text-gray-500">
            Transactions: {data.transactionCount}
          </p>
        </div>
      </div>
    );
  }
  return null;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function CategoryPieChart() {
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('total');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await getCategoryAnalysis();
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  const getChartData = () => {
    return categories.map(category => ({
      ...category,
      value: viewMode === 'total'
        ? category.totalAmount
        : viewMode === 'incoming'
          ? category.incomingAmount
          : category.outgoingAmount
    })).filter(category => category.value > 0);
  };

  const chartData = getChartData();

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Transaction Distribution by Category</CardTitle>
          <Select
            value={viewMode}
            onValueChange={(value: ViewMode) => setViewMode(value)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="View mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="total">All Transactions</SelectItem>
              <SelectItem value="incoming">Incoming Only</SelectItem>
              <SelectItem value="outgoing">Outgoing Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[500px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="category"
                cx="50%"
                cy="50%"
                outerRadius="90%"
                innerRadius="40%"
                paddingAngle={1}
                label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, category }) => {
                  const RADIAN = Math.PI / 180;
                  const radius = 25 + innerRadius + (outerRadius - innerRadius);
                  const x = cx + radius * Math.cos(-midAngle * RADIAN);
                  const y = cy + radius * Math.sin(-midAngle * RADIAN);

                  return percent > 0.05 ? (
                    <text
                      x={x}
                      y={y}
                      fill="#888"
                      textAnchor={x > cx ? 'start' : 'end'}
                      dominantBaseline="central"
                      fontSize="12"
                    >
                      {`${category} (${(percent * 100).toFixed(1)}%)`}
                    </text>
                  ) : null;
                }}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-4">Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {chartData.map((category, index) => (
              <div
                key={category.category}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center space-x-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span>{category.category}</span>
                </div>
                <span className="font-medium">
                  {formatCurrency(category.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}