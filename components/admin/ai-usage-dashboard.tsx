"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { Loader2, AlertTriangle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface AIUsageDashboardProps {
  orgId: string;
}

interface UsageStats {
  totalQueries: number;
  totalTokens: number;
  totalCost: number;
  byInterface: Record<
    string,
    { queries: number; tokens: number; cost: number }
  >;
  byModel: Record<string, { queries: number; tokens: number; cost: number }>;
  daily: Array<{ date: string; queries: number; tokens: number; cost: number }>;
}

const COLORS = ["#0f172a", "#334155", "#64748b", "#94a3b8"];

export function AIUsageDashboard({ orgId }: AIUsageDashboardProps) {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [days, setDays] = useState(30);
  const { error: showError } = useToast();

  useEffect(() => {
    fetchStats();
  }, [orgId, days]);

  async function fetchStats() {
    try {
      const response = await fetch(
        `/api/admin/ai-usage?orgId=${orgId}&days=${days}`,
      );
      if (!response.ok) throw new Error("Failed to fetch usage stats");
      const data = await response.json();
      setStats(data);
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "Failed to load usage stats",
      );
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Failed to load usage statistics
      </div>
    );
  }

  const interfaceData = Object.entries(stats.byInterface).map(
    ([name, data]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      ...data,
    }),
  );

  const modelData = Object.entries(stats.byModel).map(([name, data]) => ({
    name: name.split("/").pop() || name,
    ...data,
  }));

  const isOverLimit = stats.totalQueries > 1000; // Example limit
  const isWarning = stats.totalQueries > 800 && !isOverLimit;

  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      {(isWarning || isOverLimit) && (
        <div
          className={`p-4 rounded-lg flex items-start gap-3 ${
            isOverLimit
              ? "bg-red-50 border border-red-200"
              : "bg-amber-50 border border-amber-200"
          }`}
        >
          <AlertTriangle
            className={`w-5 h-5 mt-0.5 ${
              isOverLimit ? "text-red-600" : "text-amber-600"
            }`}
          />
          <div>
            <p
              className={`font-medium ${
                isOverLimit ? "text-red-900" : "text-amber-900"
              }`}
            >
              {isOverLimit ? "Usage Limit Exceeded" : "Approaching Usage Limit"}
            </p>
            <p
              className={`text-sm mt-1 ${
                isOverLimit ? "text-red-700" : "text-amber-700"
              }`}
            >
              {isOverLimit
                ? `You've used ${stats.totalQueries} queries this month. AI functionality is temporarily disabled.`
                : `You've used ${stats.totalQueries} of 1000 monthly queries (${Math.round((stats.totalQueries / 1000) * 100)}%). Consider upgrading your plan.`}
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Queries</CardDescription>
            <CardTitle className="text-2xl">
              {stats.totalQueries.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Tokens</CardDescription>
            <CardTitle className="text-2xl">
              {(stats.totalTokens / 1000).toFixed(1)}K
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Estimated Cost</CardDescription>
            <CardTitle className="text-2xl">
              ${stats.totalCost.toFixed(4)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Cost/Query</CardDescription>
            <CardTitle className="text-2xl">
              $
              {stats.totalQueries > 0
                ? (stats.totalCost / stats.totalQueries).toFixed(4)
                : "0.0000"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Daily Usage Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Usage</CardTitle>
          <CardDescription>Queries and tokens over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.daily}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(val) =>
                  new Date(val).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })
                }
              />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="queries"
                name="Queries"
                fill="#0f172a"
              />
              <Bar
                yAxisId="right"
                dataKey="tokens"
                name="Tokens"
                fill="#64748b"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Breakdown Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Usage by Interface</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={interfaceData}
                  dataKey="queries"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {interfaceData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usage by Model</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={modelData}
                  dataKey="cost"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {modelData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(val: number) => `$${val.toFixed(4)}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
