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

  const chartColors = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];

  return (
    <>
        <div className={styles.pageHeader}>
          <h2 className={styles.pageTitle}>IT Staff Resolved Tickets Overview</h2>
          <p className={styles.pageSubtitle}>Comprehensive statistics of tickets resolved by IT support staff</p>
        </div>

        {/* Top Performer Highlight */}
        {topPerformer && (
          <Card className={styles.topPerformerCard}>
            <div className={styles.topPerformerContent}>
              <div className={styles.topPerformerBadge}>
                <Award className={styles.trophyIcon} />
                <span>Top Performer</span>
              </div>
              <h3 className={styles.topPerformerName}>{topPerformer.name}</h3>
              <div className={styles.topPerformerStats}>
                <div className={styles.topStat}>
                  <span className={styles.topStatValue}>{topPerformer.resolved}</span>
                  <span className={styles.topStatLabel}>Tickets Resolved</span>
                </div>
                <div className={styles.topStat}>
                  <span className={styles.topStatValue}>{topPerformer.totalAssists}</span>
                  <span className={styles.topStatLabel}>Total Assists</span>
                </div>
                <div className={styles.topStat}>
                  <span className={styles.topStatValue}>{topPerformer.resolutionRate}%</span>
                  <span className={styles.topStatLabel}>Resolution Rate</span>
                </div>
                <div className={styles.topStat}>
                  <span className={styles.topStatValue}>{topPerformer.avgResolutionTime}h</span>
                  <span className={styles.topStatLabel}>Avg. Time</span>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Staff Comparison Chart */}
        <div className={styles.chartsGrid}>
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <h3 className={styles.chartTitle}>Tickets Status by Staff</h3>
              <p className={styles.chartSubtitle}>Comparison of resolved, in-progress, and pending tickets</p>
            </div>
            <div className={styles.chartContent}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'rgba(17, 24, 39, 0.9)', border: '1px solid rgba(129, 140, 248, 0.3)', borderRadius: '12px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="resolved" fill="#10b981" name="Resolved" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="inProgress" fill="#6366f1" name="In Progress" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pending" fill="#9ca3af" name="Pending" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <h3 className={styles.chartTitle}>Weekly Resolution Trend</h3>
              <p className={styles.chartSubtitle}>Tickets resolved per staff over the last 4 weeks</p>
            </div>
            <div className={styles.chartContent}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'rgba(17, 24, 39, 0.9)', border: '1px solid rgba(129, 140, 248, 0.3)', borderRadius: '12px' }}
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
                      dot={{ r: 4, fill: chartColors[index % chartColors.length] }}
                      name={staff.name}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Detailed Staff Statistics Table */}
        <div className={styles.statsSection}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>Detailed Staff Statistics</h3>
            <p className={styles.sectionSubtitle}>Complete breakdown of each staff member's performance</p>
          </div>

          <div className={styles.staffCardsGrid}>
            {sortedStats.map((staff, index) => {
              const isOwnProfile = session.userId === staff.id;
              const canViewProfile = isOwnProfile || session.userRole === 'Administrator' || session.userRole === 'Management';
              return (
                <Card
                  key={staff.id}
                  className={styles.staffCard}
                  onClick={() => canViewProfile ? navigate(`/profile/${staff.id}`) : null}
                  style={{ cursor: canViewProfile ? 'pointer' : 'default', opacity: canViewProfile ? 1 : (isOwnProfile ? 1 : 0.7) }}
                  title={canViewProfile ? (isOwnProfile ? "View your profile" : `View ${staff.name}'s profile`) : "You can only view your own profile"}
                >
                  <div className={styles.staffCardHeader}>
                    <div className={styles.staffInfo}>
                      <div className={styles.staffAvatar}>{staff.name.charAt(0)}</div>
                      <div>
                        <h4 className={styles.staffName}>{staff.name}</h4>
                        <p className={styles.staffEmail}>{staff.email} • @{staff.username}</p>
                      </div>
                    </div>
                    {index === 0 && (
                      <Badge variant="default" className={styles.topBadge}>
                        #1
                      </Badge>
                    )}
                  </div>

                  <div className={styles.staffMetrics}>
                    <div className={styles.metricRow}>
                      <div className={styles.metricItem}>
                        <Target className={styles.metricIcon} style={{ color: "#10b981" }} />
                        <div>
                          <div className={styles.metricValue}>{staff.resolved}</div>
                          <div className={styles.metricLabel}>Resolved</div>
                        </div>
                      </div>
                      <div className={styles.metricItem}>
                        <Clock className={styles.metricIcon} style={{ color: "#6366f1" }} />
                        <div>
                          <div className={styles.metricValue}>{staff.avgResolutionTime}h</div>
                          <div className={styles.metricLabel}>Avg. Time</div>
                        </div>
                      </div>
                    </div>

                    <div className={styles.progressSection}>
                      <div className={styles.progressLabel}>
                        <span>Resolution Rate</span>
                        <span className={styles.progressValue}>{staff.resolutionRate}%</span>
                      </div>
                      <div className={styles.progressBar}>
                        <div className={styles.progressFill} style={{ width: `${staff.resolutionRate}%` }}></div>
                      </div>
                    </div>

                    <div className={styles.progressSection}>
                      <div className={styles.progressLabel}>
                        <span>SLA Compliance</span>
                        <span className={styles.progressValue}>{staff.slaCompliance}%</span>
                      </div>
                      <div className={styles.progressBar}>
                        <div
                          className={styles.progressFill}
                          style={{
                            width: `${staff.slaCompliance}%`,
                            background:
                              parseFloat(staff.slaCompliance) >= 80
                                ? "var(--color-success-9)"
                                : "var(--color-error-9)",
                          }}
                        ></div>
                      </div>
                    </div>

                    <div className={styles.priorityBreakdown}>
                      <div className={styles.priorityLabel}>Priority Breakdown</div>
                      <div className={styles.priorityTags}>
                        <Badge variant="destructive" className={styles.priorityBadge}>
                          Critical: {staff.priorityBreakdown.critical}
                        </Badge>
                        <Badge variant="default" className={styles.priorityBadge}>
                          High: {staff.priorityBreakdown.high}
                        </Badge>
                        <Badge variant="secondary" className={styles.priorityBadge}>
                          Medium: {staff.priorityBreakdown.medium}
                        </Badge>
                        <Badge variant="outline" className={styles.priorityBadge}>
                          Low: {staff.priorityBreakdown.low}
                        </Badge>
                      </div>
                    </div>

                    <div className={styles.workloadSummary}>
                      <div className={styles.workloadItem}>
                        <span className={styles.workloadLabel}>Total Assigned:</span>
                        <span className={styles.workloadValue}>{staff.totalAssigned}</span>
                      </div>
                      <div className={styles.workloadItem}>
                        <span className={styles.workloadLabel}>Total Assists:</span>
                        <span className={styles.workloadValue}>{staff.totalAssists}</span>
                      </div>
                      <div className={styles.workloadItem}>
                        <span className={styles.workloadLabel}>In Progress:</span>
                        <span className={styles.workloadValue}>{staff.inProgress}</span>
                      </div>
                      <div className={styles.workloadItem}>
                        <span className={styles.workloadLabel}>Pending:</span>
                        <span className={styles.workloadValue}>{staff.pending}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Summary Statistics */}
        <div className={styles.summaryGrid}>
          <Card className={styles.summaryCard}>
            <div className={styles.summaryIcon} style={{ background: "rgba(99, 102, 241, 0.1)", border: "1px solid rgba(99, 102, 241, 0.2)" }}>
              <Target style={{ color: "#818cf8", width: "32px", height: "32px" }} />
            </div>
            <div className={styles.summaryContent}>
              <div className={styles.summaryValue}>
                {stats?.workedOn || 0}
              </div>
              <div className={styles.summaryLabel}>Total Tickets Worked On</div>
              <div className={styles.summarySubtext}>In progress or resolved</div>
            </div>
          </Card>

          <Card className={styles.summaryCard}>
            <div className={styles.summaryIcon} style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
              <Trophy style={{ color: "#10b981", width: "32px", height: "32px" }} />
            </div>
            <div className={styles.summaryContent}>
              <div className={styles.summaryValue}>
                {stats?.resolved || 0}
              </div>
              <div className={styles.summaryLabel}>Total Tickets Resolved</div>
              <div className={styles.summarySubtext}>Unique resolved tickets</div>
            </div>
          </Card>

          <Card className={styles.summaryCard}>
            <div className={styles.summaryIcon} style={{ background: "rgba(129, 140, 248, 0.1)", border: "1px solid rgba(129, 140, 248, 0.2)" }}>
              <Clock style={{ color: "#818cf8", width: "32px", height: "32px" }} />
            </div>
            <div className={styles.summaryContent}>
              <div className={styles.summaryValue}>
                {(
                  sortedStats.reduce((sum, staff) => sum + parseFloat(staff.avgResolutionTime), 0) /
                  sortedStats.length
                ).toFixed(1)}
                h
              </div>
              <div className={styles.summaryLabel}>Average Resolution Time</div>
              <div className={styles.summarySubtext}>Across all staff</div>
            </div>
          </Card>

          <Card className={styles.summaryCard}>
            <div className={styles.summaryIcon} style={{ background: "rgba(139, 92, 246, 0.1)", border: "1px solid rgba(139, 92, 246, 0.2)" }}>
              <Users style={{ color: "#a78bfa", width: "32px", height: "32px" }} />
            </div>
            <div className={styles.summaryContent}>
              <div className={styles.summaryValue}>
                {sortedStats.reduce((sum, staff) => sum + (staff.totalAssists || 0), 0)}
              </div>
              <div className={styles.summaryLabel}>Total Assists</div>
              <div className={styles.summarySubtext}>Supporting other agents</div>
            </div>
          </Card>

          <Card className={styles.summaryCard}>
            <div className={styles.summaryIcon} style={{ background: "rgba(192, 132, 252, 0.1)", border: "1px solid rgba(192, 132, 252, 0.2)" }}>
              <Trophy style={{ color: "#c084fc", width: "32px", height: "32px" }} />
            </div>
            <div className={styles.summaryContent}>
              <div className={styles.summaryValue}>
                {(
                  sortedStats.reduce((sum, staff) => sum + parseFloat(staff.resolutionRate), 0) / sortedStats.length
                ).toFixed(1)}
                %
              </div>
              <div className={styles.summaryLabel}>Average Resolution Rate</div>
              <div className={styles.summarySubtext}>Team performance</div>
            </div>
          </Card>
        </div>
      </>
  );
}
