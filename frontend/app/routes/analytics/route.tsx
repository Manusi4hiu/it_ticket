import { useNavigate } from "react-router";
import { useMemo } from "react";
import { BarChart3, TrendingUp, TrendingDown, ArrowLeft } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Button } from "~/components/ui/button/button";
import { getTicketStats, getAllAgentsPerformance } from "~/services/ticket.service";
import { requireRole } from "~/services/session.service";
import type { Route } from "./+types/route";
import styles from "./style.module.css";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await requireRole(request, ["Administrator", "Management"]);

  const [stats, agentsPerformance] = await Promise.all([
    getTicketStats(),
    getAllAgentsPerformance()
  ]);

  return {
    session,
    stats,
    agentsPerformance
  };
}

export default function Analytics({ loaderData }: Route.ComponentProps) {
  const { stats, agentsPerformance } = loaderData;
  const navigate = useNavigate();

  if (!stats) return <div>Loading...</div>;

  // Real metrics
  const totalTickets = stats.total;
  const resolvedTickets = stats.resolved;
  const avgResolutionTime = `${stats.avgResolutionTime} hours`;
  const slaCompliance = stats.total > 0
    ? ((stats.sla.healthy / stats.total) * 100).toFixed(1)
    : "100.0";

  // Status distribution data (partially mapped from stats if possible, otherwise we might need more detailed stats)
  const statusData = useMemo(() => [
    { name: "New", value: stats.new, color: "#818cf8" },
    { name: "In Progress", value: stats.assigned, color: "#fbbf24" },
    { name: "Resolved", value: stats.resolved, color: "#34d399" },
  ], [stats.new, stats.assigned, stats.resolved]);

  // Priority distribution data
  const priorityData = useMemo(() => [
    { name: "Low", count: stats.byPriority.low || 0, color: "#94a3b8" },
    { name: "Medium", count: stats.byPriority.medium || 0, color: "#60a5fa" },
    { name: "High", count: stats.byPriority.high || 0, color: "#fbbf24" },
    { name: "Critical", count: stats.byPriority.critical || 0, color: "#fb7185" },
  ], [stats.byPriority]);

  // Category distribution data
  const categoryData = useMemo(() => {
    const COLORS = ["#818cf8", "#34d399", "#fbbf24", "#f472b6", "#a78bfa", "#2dd4bf"];
    return Object.entries(stats.byCategory).map(([name, count], index) => ({
      name,
      value: count,
      color: COLORS[index % COLORS.length]
    }));
  }, [stats.byCategory]);

  // Department distribution data
  const departmentData = useMemo(() => {
    return Object.entries(stats.byDepartment)
      .map(([name, count]) => ({
        name,
        count
      }))
      .sort((a, b) => b.count - a.count);
  }, [stats.byDepartment]);

  // Agent performance data
  const agentPerformance = useMemo(() => agentsPerformance.map((agent) => {
    const total = agent.totalAssigned;
    const resolvedCount = agent.resolved;
    const avgTime = agent.avgResolutionTime;

    let performance = "average";
    if (resolvedCount >= 5 && avgTime <= 4) performance = "excellent";
    else if (resolvedCount >= 2 || avgTime <= 8) performance = "good";

    return {
      name: agent.name,
      assigned: total,
      resolved: resolvedCount,
      avgTime: `${avgTime}h`,
      performance,
    };
  }), [agentsPerformance]);

  const trendData = useMemo(() => stats.trend || [], [stats.trend]);

  return (
    <>
        <div className={styles.pageHeader}>
          <h2 className={styles.pageTitle}>Performance Overview</h2>
          <p className={styles.pageSubtitle}>Comprehensive analytics and insights for IT support operations</p>
        </div>

        {/* Key Metrics */}
        <div className={styles.metricsGrid}>
          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span className={styles.metricLabel}>Tickets Worked On</span>
            </div>
            <div className={styles.metricValue}>{stats.workedOn}</div>
            <div className={`${styles.metricChange} ${styles.changePositive}`}>
              <TrendingUp style={{ width: "16px", height: "16px" }} />
              <span>Excluding new/untouched</span>
            </div>
          </div>

          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span className={styles.metricLabel}>Resolved Tickets</span>
            </div>
            <div className={styles.metricValue}>{resolvedTickets}</div>
            <div className={`${styles.metricChange} ${styles.changePositive}`}>
              <TrendingUp style={{ width: "16px", height: "16px" }} />
              <span>8% from last week</span>
            </div>
          </div>

          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span className={styles.metricLabel}>Avg. Resolution Time</span>
            </div>
            <div className={styles.metricValue}>{avgResolutionTime}</div>
            <div className={`${styles.metricChange} ${styles.changeNegative}`}>
              <TrendingDown style={{ width: "16px", height: "16px" }} />
              <span>15% slower</span>
            </div>
          </div>

          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <span className={styles.metricLabel}>SLA Compliance</span>
            </div>
            <div className={styles.metricValue}>{slaCompliance}%</div>
            <div className={`${styles.metricChange} ${styles.changePositive}`}>
              <TrendingUp style={{ width: "16px", height: "16px" }} />
              <span>5% improvement</span>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className={styles.chartsGrid}>
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <h3 className={styles.chartTitle}>Ticket Status Distribution</h3>
              <p className={styles.chartSubtitle}>Current breakdown by status</p>
            </div>
            <div className={styles.chartContent}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={60}
                    paddingAngle={5}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "rgba(17, 24, 39, 0.9)",
                      border: "1px solid rgba(129, 140, 248, 0.2)",
                      borderRadius: "12px",
                      backdropFilter: "blur(10px)"
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <h3 className={styles.chartTitle}>Priority Levels</h3>
              <p className={styles.chartSubtitle}>Distribution by priority</p>
            </div>
            <div className={styles.chartContent}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#9ca3af", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#9ca3af", fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255, 255, 255, 0.05)" }}
                    contentStyle={{
                      background: "rgba(17, 24, 39, 0.9)",
                      border: "1px solid rgba(129, 140, 248, 0.2)",
                      borderRadius: "12px",
                      backdropFilter: "blur(10px)"
                    }}
                  />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                    {priorityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <h3 className={styles.chartTitle}>Request by Category</h3>
              <p className={styles.chartSubtitle}>Tickets by issue category</p>
            </div>
            <div className={styles.chartContent}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={true}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "rgba(17, 24, 39, 0.9)",
                      border: "1px solid rgba(129, 140, 248, 0.2)",
                      borderRadius: "12px",
                      backdropFilter: "blur(10px)"
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <h3 className={styles.chartTitle}>Request by Department</h3>
              <p className={styles.chartSubtitle}>Top requesting departments</p>
            </div>
            <div className={styles.chartContent}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={departmentData}
                  margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                    width={80}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255, 255, 255, 0.05)" }}
                    contentStyle={{
                      background: "rgba(17, 24, 39, 0.9)",
                      border: "1px solid rgba(129, 140, 248, 0.2)",
                      borderRadius: "12px",
                      backdropFilter: "blur(10px)"
                    }}
                  />
                  <Bar dataKey="count" fill="#818cf8" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={`${styles.chartCard} ${styles.fullWidthChart}`}>
            <div className={styles.chartHeader}>
              <h3 className={styles.chartTitle}>Ticket Trends (Last 7 Days)</h3>
              <p className={styles.chartSubtitle}>Created vs. Resolved tickets</p>
            </div>
            <div className={styles.chartContent}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#9ca3af", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#9ca3af", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(17, 24, 39, 0.9)",
                      border: "1px solid rgba(129, 140, 248, 0.2)",
                      borderRadius: "12px",
                      backdropFilter: "blur(10px)"
                    }}
                  />
                  <Legend verticalAlign="top" align="right" height={36} />
                  <Line
                    type="monotone"
                    dataKey="created"
                    stroke="#818cf8"
                    strokeWidth={4}
                    dot={{ r: 6, fill: "#818cf8", strokeWidth: 2, stroke: "#0f0c29" }}
                    activeDot={{ r: 8, strokeWidth: 0 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="resolved"
                    stroke="#34d399"
                    strokeWidth={4}
                    dot={{ r: 6, fill: "#34d399", strokeWidth: 2, stroke: "#0f0c29" }}
                    activeDot={{ r: 8, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>


        {/* Agent Performance Table */}
        <div className={styles.statsTable}>
          <div className={styles.tableHeader}>
            <h3 className={styles.tableTitle}>Agent Performance</h3>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Agent Name</th>
                <th>Assigned Tickets</th>
                <th>Resolved Tickets</th>
                <th>Avg. Resolution Time</th>
                <th>Performance</th>
              </tr>
            </thead>
            <tbody>
              {agentPerformance.map((agent) => (
                <tr key={agent.name}>
                  <td className={styles.agentName}>{agent.name}</td>
                  <td>{agent.assigned}</td>
                  <td>{agent.resolved}</td>
                  <td>{agent.avgTime}</td>
                  <td>
                    <span className={`${styles.performanceIndicator} ${styles[agent.performance]}`}>
                      {agent.performance === "excellent" && "⭐ Excellent"}
                      {agent.performance === "good" && "✓ Good"}
                      {agent.performance === "average" && "• Average"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
  );
}
