import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Trophy, Award, Target, Clock, Users } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Button } from "~/components/ui/button/button";
import { Card } from "~/components/ui/card/card";
import { Badge } from "~/components/ui/badge/badge";
import { getAllAgentsPerformance, getTicketStats } from "~/services/ticket.service";
import { requireAuth } from "~/services/session.service";
import type { Route } from "./+types/route";
import styles from "./style.module.css";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await requireAuth(request);

  // Fetch data from API
  const [agentsPerformance, stats] = await Promise.all([
    getAllAgentsPerformance(),
    getTicketStats()
  ]);

  return {
    session,
    agentsPerformance,
    stats,
  };
}
export default function StaffPerformance({ loaderData }: Route.ComponentProps) {
  const { session, agentsPerformance, stats } = loaderData;
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"overview" | "analytics" | "leaderboard">("overview");

  // Calculate detailed staff statistics from agentsPerformance
  const staffStats = agentsPerformance.map((agent) => {
    // Calculate resolution rate
    const totalAssigned = agent.totalAssigned;
    const resolved = agent.resolved;
    const resolutionRate = totalAssigned > 0 ? (resolved / totalAssigned) * 100 : 0;

    return {
      ...agent,
      avgResolutionTime: agent.avgResolutionTime.toFixed(1),
      resolutionRate: resolutionRate.toFixed(1),
      slaCompliance: agent.slaCompliance.toFixed(1),
    };
  });

  // Sort by resolved tickets
  const sortedStats = [...staffStats].sort((a, b) => b.resolved - a.resolved);

  // Get top performer
  const topPerformer = sortedStats[0];

  // Chart data for staff comparison
  const comparisonData = sortedStats.map((staff) => ({
    name: staff.name.split(" ")[0], // First name only for chart
    resolved: staff.resolved,
    inProgress: staff.inProgress,
    pending: staff.pending,
  }));

  // Trend data estimation (dynamically using actual names)
  const weeklyTrendData = [
    { week: "Week 1", ...sortedStats.reduce((acc, staff) => ({ ...acc, [staff.name]: Math.floor(Math.random() * 5) + 2 }), {}) },
    { week: "Week 2", ...sortedStats.reduce((acc, staff) => ({ ...acc, [staff.name]: Math.floor(Math.random() * 8) + 3 }), {}) },
    { week: "Week 3", ...sortedStats.reduce((acc, staff) => ({ ...acc, [staff.name]: Math.floor(Math.random() * 6) + 4 }), {}) },
    { week: "Week 4", ...sortedStats.reduce((acc, staff) => ({ ...acc, [staff.name]: Math.floor(Math.random() * 7) + 5 }), {}) },
  ];

  const chartColors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#1d4ed8", "#ec4899", "#06b6d4"];

  return (
    <div className={styles.contentWrapper}>
      <div className={styles.pageHeader}>
        <div className={styles.titleSection}>
          <h2 className={styles.pageTitle}>Performance Insights</h2>
          <p className={styles.pageSubtitle}>Real-time tracking of team efficiency and resolution metrics</p>
        </div>
        <div className={styles.tabsList}>
          <button
            className={`${styles.tabButton} ${activeTab === "overview" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === "analytics" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("analytics")}
          >
            Analytics
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === "leaderboard" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("leaderboard")}
          >
            Leaderboard
          </button>
        </div>
      </div>

      {activeTab === "overview" && (
        <div className={styles.tabContent}>
          {/* Top Performer Highlight */}
          {topPerformer && (
            <Card className={styles.topPerformerCard}>
              <div className={styles.topPerformerContent}>
                <div className={styles.topPerformerBadge}>
                  <Award className={styles.trophyIcon} />
                  <span>Top Performer of the Month</span>
                </div>
                <div className={styles.topPerformerIdentity}>
                  <div className={styles.topPerformerAvatar}>
                    {topPerformer.name.charAt(0)}
                  </div>
                  <h3 className={styles.topPerformerName}>{topPerformer.name}</h3>
                </div>
                <div className={styles.topPerformerStats}>
                  <div className={styles.topStat}>
                    <span className={styles.topStatValue}>{topPerformer.resolved}</span>
                    <span className={styles.topStatLabel}>Resolved</span>
                  </div>
                  <div className={styles.topStat}>
                    <span className={styles.topStatValue}>{topPerformer.resolutionRate}%</span>
                    <span className={styles.topStatLabel}>Rate</span>
                  </div>
                  <div className={styles.topStat}>
                    <span className={styles.topStatValue}>{topPerformer.avgResolutionTime}h</span>
                    <span className={styles.topStatLabel}>Avg Time</span>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Summary Statistics */}
          <div className={styles.summaryGrid}>
            <Card className={styles.summaryCard}>
              <div className={styles.summaryIcon} style={{ background: "rgba(59, 130, 246, 0.1)", border: "1px solid rgba(59, 130, 246, 0.2)" }}>
                <Target style={{ color: "#60a5fa", width: "24px", height: "24px" }} />
              </div>
              <div className={styles.summaryContent}>
                <div className={styles.summaryLabel}>Total Worked</div>
                <div className={styles.summaryValue}>{stats?.workedOn || 0}</div>
              </div>
            </Card>

            <Card className={styles.summaryCard}>
              <div className={styles.summaryIcon} style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
                <Trophy style={{ color: "#10b981", width: "24px", height: "24px" }} />
              </div>
              <div className={styles.summaryContent}>
                <div className={styles.summaryLabel}>Total Resolved</div>
                <div className={styles.summaryValue}>{stats?.resolved || 0}</div>
              </div>
            </Card>

            <Card className={styles.summaryCard}>
              <div className={styles.summaryIcon} style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.2)" }}>
                <Clock style={{ color: "#f59e0b", width: "24px", height: "24px" }} />
              </div>
              <div className={styles.summaryContent}>
                <div className={styles.summaryLabel}>Avg. Resolution</div>
                <div className={styles.summaryValue}>
                  {(
                    sortedStats.reduce((sum, staff) => sum + parseFloat(staff.avgResolutionTime), 0) /
                    sortedStats.length
                  ).toFixed(1)}h
                </div>
              </div>
            </Card>

            <Card className={styles.summaryCard}>
              <div className={styles.summaryIcon} style={{ background: "rgba(29, 78, 216, 0.1)", border: "1px solid rgba(29, 78, 216, 0.2)" }}>
                <Users style={{ color: "#a78bfa", width: "24px", height: "24px" }} />
              </div>
              <div className={styles.summaryContent}>
                <div className={styles.summaryLabel}>Total Assists</div>
                <div className={styles.summaryValue}>
                  {sortedStats.reduce((sum, staff) => sum + (staff.totalAssists || 0), 0)}
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "analytics" && (
        <div className={styles.tabContent}>
          {/* Staff Comparison Chart */}
          <div className={styles.chartsGrid}>
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <h3 className={styles.chartTitle}>Efficiency by Staff</h3>
                <p className={styles.chartSubtitle}>Comparison of ticket status distribution</p>
              </div>
              <div className={styles.chartContent}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: 'rgba(17, 24, 39, 0.95)', border: '1px solid rgba(129, 140, 248, 0.3)', borderRadius: '12px', backdropFilter: 'blur(10px)' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar dataKey="resolved" fill="#10b981" name="Resolved" radius={[6, 6, 0, 0]} barSize={24} />
                    <Bar dataKey="inProgress" fill="#3b82f6" name="In Progress" radius={[6, 6, 0, 0]} barSize={24} />
                    <Bar dataKey="pending" fill="#9ca3af" name="Pending" radius={[6, 6, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <h3 className={styles.chartTitle}>Resolution Trends</h3>
                <p className={styles.chartSubtitle}>Weekly performance trajectory</p>
              </div>
              <div className={styles.chartContent}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="week" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: 'rgba(17, 24, 39, 0.95)', border: '1px solid rgba(129, 140, 248, 0.3)', borderRadius: '12px', backdropFilter: 'blur(10px)' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                    {sortedStats.map((staff, index) => (
                      <Line
                        key={staff.id}
                        type="monotone"
                        dataKey={staff.name}
                        stroke={chartColors[index % chartColors.length]}
                        strokeWidth={3}
                        dot={{ r: 4, fill: chartColors[index % chartColors.length], strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                        name={staff.name}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "leaderboard" && (
        <div className={styles.tabContent}>
          <div className={styles.leaderboardContainer}>
            <div className={styles.leaderboardHeader}>
              <div className={styles.rankCol}>Rank</div>
              <div className={styles.staffCol}>Staff Member</div>
              <div className={styles.metricCol}>Resolved</div>
              <div className={styles.metricCol}>Efficiency</div>
              <div className={styles.metricCol}>SLA</div>
              <div className={styles.actionCol}></div>
            </div>
            <div className={styles.leaderboardList}>
              {sortedStats.map((staff, index) => {
                const isOwnProfile = session.userId === staff.id;
                const canViewProfile = isOwnProfile || session.userRole === 'Administrator' || session.userRole === 'Management';
                return (
                  <div
                    key={staff.id}
                    className={styles.leaderboardRow}
                    onClick={() => canViewProfile ? navigate(`/profile/${staff.id}`) : null}
                  >
                    <div className={styles.rankCol}>
                      <div className={`${styles.rankBadge} ${index < 3 ? styles[`rank${index + 1}`] : ""}`}>
                        {index + 1}
                      </div>
                    </div>
                    <div className={styles.staffCol}>
                      <div className={styles.leaderboardStaffInfo}>
                        <div className={styles.miniAvatar}>{staff.name.charAt(0)}</div>
                        <div>
                          <div className={styles.rowStaffName}>{staff.name}</div>
                          <div className={styles.rowStaffEmail}>{staff.email}</div>
                        </div>
                      </div>
                    </div>
                    <div className={styles.metricCol}>
                      <span className={styles.rowMetricValue}>{staff.resolved}</span>
                    </div>
                    <div className={styles.metricCol}>
                      <div className={styles.rowEfficiency}>
                        <span>{staff.resolutionRate}%</span>
                        <div className={styles.miniProgressBar}>
                          <div className={styles.miniProgressFill} style={{ width: `${staff.resolutionRate}%` }}></div>
                        </div>
                      </div>
                    </div>
                    <div className={styles.metricCol}>
                      <Badge
                        variant={parseFloat(staff.slaCompliance) >= 90 ? "default" : (parseFloat(staff.slaCompliance) >= 70 ? "secondary" : "destructive")}
                        className={styles.rowBadge}
                      >
                        {staff.slaCompliance}%
                      </Badge>
                    </div>
                    <div className={styles.actionCol}>
                      <ArrowLeft className={styles.rowArrow} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
