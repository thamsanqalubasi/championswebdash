import React, { useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  BarChart3, TrendingUp, Building2, Users, Package, DollarSign, Wrench, ArrowUpRight, ArrowDownRight, Calendar, Printer
} from 'lucide-react';

const financialData = [
  { name: 'Jan', revenue: 4000, expenses: 2400, margin: 1600 },
  { name: 'Feb', revenue: 3000, expenses: 1398, margin: 1602 },
  { name: 'Mar', revenue: 2000, expenses: 9800, margin: -7800 },
  { name: 'Apr', revenue: 2780, expenses: 3908, margin: -1128 },
  { name: 'May', revenue: 1890, expenses: 4800, margin: -2910 },
  { name: 'Jun', revenue: 2390, expenses: 3800, margin: -1410 },
  { name: 'Jul', revenue: 3490, expenses: 4300, margin: -810 },
];

const revenueStreamData = [
  { name: 'Jan', bookings: 2000, leases: 1500, services: 500 },
  { name: 'Feb', bookings: 1000, leases: 1500, services: 500 },
  { name: 'Mar', bookings: 500, leases: 1000, services: 500 },
  { name: 'Apr', bookings: 1280, leases: 1000, services: 500 },
  { name: 'May', bookings: 390, leases: 1000, services: 500 },
  { name: 'Jun', bookings: 890, leases: 1000, services: 500 },
  { name: 'Jul', bookings: 1990, leases: 1000, services: 500 },
];

const pieColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#6366f1', '#14b8a6', '#f97316'];
const budgetData = [
  { name: 'Maintenance', value: 400 },
  { name: 'Housekeeping', value: 300 },
  { name: 'Admin', value: 300 },
  { name: 'Marketing', value: 200 },
  { name: 'Utilities', value: 278 },
];

const occupancyData = [
  { name: 'Property A', occupancy: 85 },
  { name: 'Property B', occupancy: 92 },
  { name: 'Property C', occupancy: 78 },
  { name: 'Property D', occupancy: 95 },
  { name: 'Property E', occupancy: 88 },
];

const inventoryData = [
  { name: 'Jan', received: 400, issued: 240 },
  { name: 'Feb', received: 300, issued: 139 },
  { name: 'Mar', received: 200, issued: 980 },
  { name: 'Apr', received: 278, issued: 390 },
  { name: 'May', received: 189, issued: 480 },
];

const workOrdersData = [
  { name: 'Electrical', high: 10, medium: 20, low: 30 },
  { name: 'Plumbing', high: 15, medium: 25, low: 10 },
  { name: 'HVAC', high: 5, medium: 15, low: 20 },
  { name: 'General', high: 20, medium: 30, low: 40 },
];

const departmentPerformance = [
  { id: 1, department: 'Maintenance', revenue: 0, expenses: 15000, margin: -15000, tasksCompleted: 145, sla: 92 },
  { id: 2, department: 'Housekeeping', revenue: 5000, expenses: 12000, margin: -7000, tasksCompleted: 350, sla: 98 },
  { id: 3, department: 'Front Desk', revenue: 45000, expenses: 8000, margin: 37000, tasksCompleted: 500, sla: 95 },
  { id: 4, department: 'F&B', revenue: 25000, expenses: 18000, margin: 7000, tasksCompleted: 200, sla: 88 },
  { id: 5, department: 'Events', revenue: 30000, expenses: 10000, margin: 20000, tasksCompleted: 50, sla: 100 },
  { id: 6, department: 'Admin', revenue: 0, expenses: 20000, margin: -20000, tasksCompleted: 80, sla: 99 },
  { id: 7, department: 'Marketing', revenue: 0, expenses: 15000, margin: -15000, tasksCompleted: 30, sla: 95 },
  { id: 8, department: 'Security', revenue: 0, expenses: 10000, margin: -10000, tasksCompleted: 120, sla: 97 },
  { id: 9, department: 'Spa', revenue: 15000, expenses: 5000, margin: 10000, tasksCompleted: 85, sla: 96 },
  { id: 10, department: 'Transport', revenue: 5000, expenses: 8000, margin: -3000, tasksCompleted: 110, sla: 90 },
];

export default function StatisticsPage() {
  const [timeframe, setTimeframe] = useState('This Month');

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-surface text-foreground">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold">System Statistics & Analytics</h1>
        <div className="flex items-center gap-4">
          <div className="relative">
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="appearance-none bg-surface-elevated border border-border-color rounded-lg px-4 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>Today</option>
              <option>This Week</option>
              <option>This Month</option>
              <option>This Quarter</option>
              <option>Year-to-Date</option>
              <option>All Time</option>
            </select>
            <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          </div>
          <button className="flex items-center gap-2 bg-surface-elevated border border-border-color px-4 py-2 rounded-lg text-sm hover:bg-muted/10">
            <Printer className="w-4 h-4" />
            Print / Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* KPI Cards */}
        <div className="bg-surface rounded-2xl border border-border-color p-6 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-muted mb-1">Total Revenue (ZAR)</p>
              <h3 className="text-2xl font-bold">R 1,245,000</h3>
            </div>
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="flex items-center text-green-500 font-medium">
              <ArrowUpRight className="w-4 h-4 mr-1" />
              +12.5%
            </span>
            <span className="text-muted ml-2">vs last month</span>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border-color p-6 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-muted mb-1">Net Operating Margin</p>
              <h3 className="text-2xl font-bold">34.2%</h3>
            </div>
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="flex items-center text-green-500 font-medium">
              <ArrowUpRight className="w-4 h-4 mr-1" />
              +2.1%
            </span>
            <span className="text-muted ml-2">vs last month</span>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border-color p-6 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-muted mb-1">Portfolio Occupancy</p>
              <h3 className="text-2xl font-bold">88.5%</h3>
            </div>
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="flex items-center text-red-500 font-medium">
              <ArrowDownRight className="w-4 h-4 mr-1" />
              -1.5%
            </span>
            <span className="text-muted ml-2">vs last month</span>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border-color p-6 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-muted mb-1">Active Leases & Bookings</p>
              <h3 className="text-2xl font-bold">142</h3>
            </div>
            <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="flex items-center text-green-500 font-medium">
              <ArrowUpRight className="w-4 h-4 mr-1" />
              +5
            </span>
            <span className="text-muted ml-2">new this month</span>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border-color p-6 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-muted mb-1">Inventory Asset Valuation</p>
              <h3 className="text-2xl font-bold">R 450,200</h3>
            </div>
            <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-500">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="flex items-center text-green-500 font-medium">
              <ArrowUpRight className="w-4 h-4 mr-1" />
              +R 12k
            </span>
            <span className="text-muted ml-2">vs last month</span>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border-color p-6 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-muted mb-1">Open Tasks</p>
              <h3 className="text-2xl font-bold">24</h3>
            </div>
            <div className="p-2 bg-pink-500/10 rounded-lg text-pink-500">
              <Wrench className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="flex items-center text-red-500 font-medium">
              <ArrowDownRight className="w-4 h-4 mr-1" />
              -3
            </span>
            <span className="text-muted ml-2">resolved today</span>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border-color p-6 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-muted mb-1">Staff Count</p>
              <h3 className="text-2xl font-bold">45</h3>
            </div>
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-muted">Active system users</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface rounded-2xl border border-border-color p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Financial Trajectory</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={financialData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="revenue" stackId="1" stroke="#3b82f6" fill="#3b82f6" />
                <Area type="monotone" dataKey="expenses" stackId="2" stroke="#ef4444" fill="#ef4444" />
                <Area type="monotone" dataKey="margin" stackId="3" stroke="#10b981" fill="#10b981" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border-color p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Revenue by Stream</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueStreamData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="bookings" fill="#3b82f6" />
                <Bar dataKey="leases" fill="#10b981" />
                <Bar dataKey="services" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border-color p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Departmental Budget Consumption</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={budgetData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {budgetData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border-color p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Property Occupancy Comparison</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={occupancyData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" />
                <Tooltip />
                <Legend />
                <Bar dataKey="occupancy" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border-color p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Inventory Consumption</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inventoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="received" fill="#14b8a6" />
                <Bar dataKey="issued" fill="#f97316" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border-color p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Maintenance Work Orders</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workOrdersData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="high" fill="#ef4444" stackId="a" />
                <Bar dataKey="medium" fill="#f59e0b" stackId="a" />
                <Bar dataKey="low" fill="#10b981" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-border-color shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border-color">
          <h3 className="text-lg font-semibold">Departmental Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-elevated text-muted">
              <tr>
                <th className="p-4 font-medium">Department</th>
                <th className="p-4 font-medium text-right">Revenue</th>
                <th className="p-4 font-medium text-right">Expenses</th>
                <th className="p-4 font-medium text-right">Margin</th>
                <th className="p-4 font-medium text-right">Tasks Completed</th>
                <th className="p-4 font-medium text-right">SLA %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color">
              {departmentPerformance.map((dept) => (
                <tr key={dept.id} className="hover:bg-surface-elevated/50">
                  <td className="p-4 font-medium">{dept.department}</td>
                  <td className="p-4 text-right">R {dept.revenue.toLocaleString()}</td>
                  <td className="p-4 text-right">R {dept.expenses.toLocaleString()}</td>
                  <td className={`p-4 text-right font-medium ${dept.margin >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    R {dept.margin.toLocaleString()}
                  </td>
                  <td className="p-4 text-right">{dept.tasksCompleted}</td>
                  <td className="p-4 text-right">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${dept.sla >= 95 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {dept.sla}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

