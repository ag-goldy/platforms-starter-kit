"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  Loader2,
  Download,
  BarChart3,
  PieChart,
  TrendingUp,
  Users,
  Clock,
  AlertCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart as RePieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface StandardReportsProps {
  orgId: string;
}

type ReportType =
  | "ticket-volume"
  | "agent-performance"
  | "sla-compliance"
  | "category-distribution"
  | "response-time"
  | "resolution-time"
  | "top-requesters";

const REPORT_TYPES: {
  key: ReportType;
  label: string;
  icon: typeof BarChart3;
  description: string;
}[] = [
  {
    key: "ticket-volume",
    label: "Ticket Volume",
    icon: BarChart3,
    description: "Tickets created per day over time",
  },
  {
    key: "agent-performance",
    label: "Agent Performance",
    icon: Users,
    description: "Tickets handled per agent",
  },
  {
    key: "sla-compliance",
    label: "SLA Compliance",
    icon: AlertCircle,
    description: "SLA meeting percentages by priority",
  },
  {
    key: "category-distribution",
    label: "Categories",
    icon: PieChart,
    description: "Ticket distribution by category",
  },
  {
    key: "response-time",
    label: "Response Time",
    icon: Clock,
    description: "Average first response time",
  },
  {
    key: "resolution-time",
    label: "Resolution Time",
    icon: TrendingUp,
    description: "Average resolution time",
  },
  {
    key: "top-requesters",
    label: "Top Requesters",
    icon: Users,
    description: "Users creating most tickets",
  },
];

const COLORS = [
  "#0f172a",
  "#334155",
  "#64748b",
  "#94a3b8",
  "#cbd5e1",
  "#e2e8f0",
];

export function StandardReports({ orgId }: StandardReportsProps) {
  const [selectedReport, setSelectedReport] =
    useState<ReportType>("ticket-volume");
  const [data, setData] = useState<unknown[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dateRange, setDateRange] = useState(30); // days
  const { error: showError } = useToast();

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - dateRange);

      const response = await fetch(
        `/api/reports?type=${selectedReport}&orgId=${orgId}&start=${start.toISOString()}&end=${end.toISOString()}`,
      );

      if (!response.ok) throw new Error("Failed to fetch report");
      const result = await response.json();
      setData(result.data || []);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to load report");
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedReport, dateRange, orgId, showError]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  function downloadCSV() {
    if (!data.length) return;

    const headers = Object.keys(data[0] as object).join(",");
    const rows = data
      .map((row) => Object.values(row as object).join(","))
      .join("\n");
    const csv = `${headers}\n${rows}`;

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedReport}-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function renderChart() {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      );
    }

    if (!data.length) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-500">
          No data available for the selected period
        </div>
      );
    }

    switch (selectedReport) {
      case "ticket-volume":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data as { date: string; count: number }[]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(val) => new Date(val).toLocaleDateString()}
              />
              <YAxis />
              <Tooltip formatter={(val) => [`${val} tickets`, "Count"]} />
              <Bar dataKey="count" fill="#0f172a" />
            </BarChart>
          </ResponsiveContainer>
        );

      case "agent-performance":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={
                data as {
                  agentName: string;
                  totalTickets: number;
                  resolvedTickets: number;
                }[]
              }
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="agentName" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="totalTickets" name="Total" fill="#0f172a" />
              <Bar dataKey="resolvedTickets" name="Resolved" fill="#64748b" />
            </BarChart>
          </ResponsiveContainer>
        );

      case "sla-compliance":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={
                data as {
                  priority: string;
                  responseCompliance: number;
                  resolutionCompliance: number;
                }[]
              }
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="priority" />
              <YAxis domain={[0, 100]} />
              <Tooltip formatter={(val) => [`${val}%`, "Compliance"]} />
              <Legend />
              <Bar
                dataKey="responseCompliance"
                name="Response SLA"
                fill="#0f172a"
              />
              <Bar
                dataKey="resolutionCompliance"
                name="Resolution SLA"
                fill="#64748b"
              />
            </BarChart>
          </ResponsiveContainer>
        );

      case "category-distribution":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <RePieChart>
              <Pie
                data={data as { category: string; count: number }[]}
                dataKey="count"
                nameKey="category"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ category, count }) => `${category}: ${count}`}
              >
                {(data as { category: string; count: number }[]).map(
                  (_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ),
                )}
              </Pie>
              <Tooltip />
              <Legend />
            </RePieChart>
          </ResponsiveContainer>
        );

      case "response-time":
      case "resolution-time":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data as { date: string; avgHours: number }[]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(val) => new Date(val).toLocaleDateString()}
              />
              <YAxis />
              <Tooltip formatter={(val) => [`${val} hours`, "Average"]} />
              <Line
                type="monotone"
                dataKey="avgHours"
                stroke="#0f172a"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case "top-requesters":
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Email</th>
                  <th className="text-right py-2">Tickets</th>
                  <th className="text-left py-2">Top Category</th>
                </tr>
              </thead>
              <tbody>
                {(
                  data as {
                    email: string;
                    ticketCount: number;
                    topCategory: string;
                  }[]
                ).map((row, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2">{row.email}</td>
                    <td className="text-right py-2">{row.ticketCount}</td>
                    <td className="py-2">{row.topCategory}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      default:
        return null;
    }
  }

  const currentReport = REPORT_TYPES.find((r) => r.key === selectedReport);
  const Icon = currentReport?.icon || BarChart3;

  return (
    <div className="space-y-6">
      {/* Report Selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {REPORT_TYPES.map((report) => {
          const ReportIcon = report.icon;
          return (
            <button
              key={report.key}
              onClick={() => setSelectedReport(report.key)}
              className={`p-3 rounded-lg border text-left transition-colors ${
                selectedReport === report.key
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <ReportIcon
                className={`w-5 h-5 mb-1 ${selectedReport === report.key ? "text-blue-600" : "text-gray-500"}`}
              />
              <div className="text-xs font-medium">{report.label}</div>
            </button>
          );
        })}
      </div>

      {/* Date Range & Export */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Period:</span>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(Number(e.target.value))}
            className="h-9 px-3 rounded-md border border-gray-200 bg-white text-sm"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
        <Button
          variant="outline"
          onClick={downloadCSV}
          disabled={!data.length || isLoading}
        >
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon className="w-5 h-5" />
            {currentReport?.label}
          </CardTitle>
          <CardDescription>{currentReport?.description}</CardDescription>
        </CardHeader>
        <CardContent>{renderChart()}</CardContent>
      </Card>
    </div>
  );
}
