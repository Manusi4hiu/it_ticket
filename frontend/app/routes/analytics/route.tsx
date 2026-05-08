import { useNavigate } from "react-router";
import { useMemo, useState } from "react";
import { LayoutDashboard, PieChart as PieChartIcon, Users2, Activity, TrendingUp, Inbox, CheckCircle, Clock, ShieldCheck } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState<"overview" | "distribution" | "staff">("overview");

  if (!stats) return <div className="p-12 text-center text-slate-400">Loading analytics...</div>;

  const resolvedTickets = stats.resolved;
  const avgResolutionTime = `${stats.avgResolutionTime}h`;
  const slaCompliance = stats.total > 0
    ? ((stats.sla.healthy / stats.total) * 100).toFixed(1)
    : "100.0";

  const statusData = useMemo(() => [
    { name: "New", value: stats.new, color: "#3b82f6" },
    { name: "Assigned", value: stats.assigned, color: "#f59e0b" },
    { name: "Resolved", value: stats.resolved, color: "#10b981" },
  ], [stats.new, stats.assigned, stats.resolved]);

  const priorityData = useMemo(() => [
    { name: "Low", count: stats.byPriority.low || 0, color: "#94a3b8" },
    { name: "Medium", count: stats.byPriority.medium || 0, color: "#3b82f6" },
    { name: "High", count: stats.byPriority.high || 0, color: "#f59e0b" },
    { name: "Critical", count: stats.byPriority.critical || 0, color: "#ef4444" },
  ], [stats.byPriority]);

  const categoryData = useMemo(() => {
    const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4"];
    return Object.entries(stats.byCategory).map(([name, count], index) => ({
      name,
      value: count,
      color: COLORS[index % COLORS.length]
    }));
  }, [stats.byCategory]);

  const departmentData = useMemo(() => {
    return Object.entries(stats.byDepartment)
      .map(([name, count]) => ({
        name,
        count
      }))
      .sort((a, b) => b.count - a.count);
  }, [stats.byDepartment]);

  const agentPerformance = useMemo(() => agentsPerformance.map((agent) => {
    const total = agent.totalAssigned;
    const resolvedCount = agent.resolved;
    const avgTime = agent.avgResolutionTime;

    let performance: "excellent" | "good" | "average" = "average";
    if (resolvedCount >= 5 && avgTime <= 4) performance = "excellent";
    else if (resolvedCount >= 2 || avgTime <= 8) performance = "good";

    return {
      name: agent.name,
      assigned: total,
      resolved: resolvedCount,
      avgTime: `${avgTime.toFixed(1)}h`,
      performance,
    };
  }), [agentsPerformance]);

  const trendData = useMemo(() => stats.trend || [], [stats.trend]);

  return (
    <div className={styles.contentWrapper}>
      <div className={styles.pageHeader}>
        <div className={styles.titleSection}>
          <h2 className={styles.pageTitle}>System Analytics</h2>
          <p className={styles.pageSubtitle}>In-depth monitoring of support efficiency and metrics</p>
        </div>
        <div className={styles.tabsList}>
          <button
            className={`${styles.tabButton} ${activeTab === "overview" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            <LayoutDashboard className={styles.tabIcon} />
            Overview
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === "distribution" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("distribution")}
          >
            <PieChartIcon className={styles.tabIcon} />
            Distribution
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === "staff" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("staff")}
          >
            <Users2 className={styles.tabIcon} />
            Staff
          </button>
        </div>
      </div>

      {activeTab === "overview" && (
        <div className="animate-fade-in">
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <div className={styles.summaryIcon} style={{ background: "rgba(59, 130, 246, 0.1)", border: "1px solid rgba(59, 130, 246, 0.2)" }}>
                <Inbox size={22} style={{ color: "#3b82f6" }} />
              </div>
              <div className={styles.summaryContent}>
                <span className={styles.summaryLabel}>Total Tickets</span>
                <span className={styles.summaryValue}>{stats.total}</span>
              </div>
            </div>

            <div className={styles.summaryCard}>
              <div className={styles.summaryIcon} style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
                <CheckCircle size={22} style={{ color: "#10b981" }} />
              </div>
              <div className={styles.summaryContent}>
                <span className={styles.summaryLabel}>Resolved</span>
                <span className={styles.summaryValue}>{resolvedTickets}</span>
              </div>
            </div>

            <div className={styles.summaryCard}>
              <div className={styles.summaryIcon} style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.2)" }}>
                <Clock size={22} style={{ color: "#f59e0b" }} />
              </div>
              <div className={styles.summaryContent}>
                <span className={styles.summaryLabel}>Avg. Resolution</span>
                <span className={styles.summaryValue}>{avgResolutionTime}</span>
              </div>
            </div>

            <div className={styles.summaryCard}>
              <div className={styles.summaryIcon} style={{ background: "rgba(139, 92, 246, 0.1)", border: "1px solid rgba(139, 92, 246, 0.2)" }}>
                <ShieldCheck size={22} style={{ color: "#8b5cf6" }} />
              </div>
              <div className={styles.summaryContent}>
                <span className={styles.summaryLabel}>SLA Compliance</span>
                <span className={styles.summaryValue}>{slaCompliance}%</span>
              </div>
            </div>
          </div>

          <div className={`${styles.chartCard} ${styles.fullWidthChart}`}>
            <div className={styles.chartHeader}>
              <h3 className={styles.chartTitle}>Ticket Activity Trends</h3>
              <p className={styles.chartSubtitle}>Comparison of ticket creation vs. resolution (Last 7 Days)</p>
            </div>
            <div className={styles.chartContent}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(15, 23, 42, 0.95)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "12px",
                      backdropFilter: "blur(10px)"
                    }}
                  />
                  <Legend verticalAlign="top" align="right" height={36} iconType="circle" />
                  <Line
                    type="monotone"
                    dataKey="created"
                    name="Created"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "#3b82f6", strokeWidth: 0 }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="resolved"
                    name="Resolved"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "#10b981", strokeWidth: 0 }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {activeTab === "distribution" && (
        <div className={styles.chartsGrid + " animate-fade-in"}>
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <h3 className={styles.chartTitle}>Status Distribution</h3>
              <p className={styles.chartSubtitle}>Current workload breakdown by ticket status</p>
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
                    innerRadius={70}
                    paddingAngle={8}
                    stroke="none"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "rgba(15, 23, 42, 0.95)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "12px",
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <h3 className={styles.chartTitle}>Priority Levels</h3>
              <p className={styles.chartSubtitle}>Workload intensity by ticket priority</p>
            </div>
            <div className={styles.chartContent}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255, 255, 255, 0.02)" }}
                    contentStyle={{
                      background: "rgba(15, 23, 42, 0.95)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "12px",
                    }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={40}>
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
              <h3 className={styles.chartTitle}>Category Breakdown</h3>
              <p className={styles.chartSubtitle}>Service requests distribution by category</p>
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
                    stroke="none"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "rgba(15, 23, 42, 0.95)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "12px",
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <h3 className={styles.chartTitle}>Department Demand</h3>
              <p className={styles.chartSubtitle}>Top departments by support request volume</p>
            </div>
            <div className={styles.chartContent}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={departmentData}
                  margin={{ top: 0, right: 30, left: 30, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    width={100}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255, 255, 255, 0.02)" }}
                    contentStyle={{
                      background: "rgba(15, 23, 42, 0.95)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "12px",
                    }}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {activeTab === "staff" && (
        <div className={styles.leaderboardContainer + " animate-fade-in"}>
          <div className={styles.tableHeader}>
            <div>Agent Name</div>
            <div>Assigned</div>
            <div>Resolved</div>
            <div>Avg. Time</div>
            <div>Performance</div>
          </div>
          <div className={styles.tableBody}>
            {agentPerformance.map((agent) => (
              <div key={agent.name} className={styles.tableRow}>
                <div className={styles.staffInfo}>
                  <div className={styles.miniAvatar}>{agent.name.charAt(0)}</div>
                  <span className={styles.staffName}>{agent.name}</span>
                </div>
                <div className={styles.metricValue}>{agent.assigned}</div>
                <div className={styles.metricValue}>{agent.resolved}</div>
                <div className={styles.metricValue}>{agent.avgTime}</div>
                <div>
                  <span className={`${styles.performanceBadge} ${styles[agent.performance]}`}>
                    {agent.performance}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
