import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ChevronRight } from "lucide-react";
import {
  BarChart,
  Bar,
  LabelList,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getAllAgentsPerformance, getTicketStats } from "~/services/ticket.service";
import { usersApi } from "~/services/api.service";
import { requireAuth } from "~/services/session.service";
import type { Route } from "./+types/route";
import styles from "./style.module.css";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await requireAuth(request);

  // Fetch data from API (trend 28 hari untuk agregasi mingguan Week 1–4)
  const [agentsPerformance, stats] = await Promise.all([
    getAllAgentsPerformance(),
    getTicketStats(false, 28)
  ]);

  return Response.json({
    session,
    agentsPerformance,
    stats,
  });
}

/** Tooltip gelap bersama untuk chart di halaman ini. */
function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const stamp = payload[0]?.payload?.range ? `${label} · ${payload[0].payload.range}` : label;
  return (
    <div className={styles.tip}>
      <p className={styles.tipTitle}>{stamp}</p>
      {payload.map((p: any) => (
        <div key={String(p.dataKey)} className={styles.tipRow}>
          <span className={styles.tipDot} style={{ background: p.color ?? p.fill ?? p.stroke }} />
          <span className={styles.tipName}>{p.name}</span>
          <span className={styles.tipVal}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function StaffPerformance({ loaderData }: Route.ComponentProps) {
  const { session, agentsPerformance, stats } = loaderData;
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"overview" | "analytics" | "leaderboard" | "break">("overview");
  const [breakPeriod, setBreakPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [breakSummary, setBreakSummary] = useState<Array<{
    userId: number; userName: string; username: string; role: string;
    isOnBreak: boolean; liveSeconds: number; usedSeconds: number;
    sessionsCount: number; limitMinutes: number; remainingSeconds: number;
  }> | null>(null);
  const [breakRange, setBreakRange] = useState<{ start: string; end: string } | null>(null);
  const [breakLimit, setBreakLimit] = useState<number | null>(null);
  const [breakLogs, setBreakLogs] = useState<Array<{
    id: number; userId: number; userName: string | null;
    startedAt: string | null; endedAt: string | null;
    durationSeconds: number; logDate: string | null;
  }> | null>(null);
  const [breakLogsTotal, setBreakLogsTotal] = useState<number | null>(null);
  const [breakLoading, setBreakLoading] = useState(false);
  const [breakError, setBreakError] = useState<string | null>(null);

  // Sub-page Break: ringkasan pemakaian vs sisa per staff + seluruh sesi log
  // (limit 200 = maks backend; list di-scroll di dalam container sendiri).
  useEffect(() => {
    if (activeTab !== "break") return;
    let cancelled = false;
    setBreakLoading(true);
    setBreakError(null);
    Promise.all([usersApi.getBreakSummary(breakPeriod), usersApi.getBreakLogs({ period: breakPeriod, limit: 200 })])
      .then(([sumRes, logRes]) => {
        if (cancelled) return;
        if (sumRes.success && sumRes.data) {
          const d = sumRes.data as any;
          const body = d?.summary ? d : d?.data;
          setBreakSummary(body?.summary ?? null);
          setBreakRange(body?.range ?? null);
          setBreakLimit(body?.limitMinutes ?? null);
        } else {
          setBreakError(sumRes.error || "Gagal memuat ringkasan break.");
        }
        if (logRes.success && logRes.data) {
          const d = logRes.data as any;
          const body = d?.logs ? d : d?.data;
          setBreakLogs(body?.logs ?? null);
          setBreakLogsTotal(typeof body?.total === "number" ? body.total : (body?.logs?.length ?? null));
        }
      })
      .catch((e) => { if (!cancelled) setBreakError(e instanceof Error ? e.message : "Gagal memuat data break."); })
      .finally(() => { if (!cancelled) setBreakLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab, breakPeriod]);

  const formatBreakHM = (seconds: number) => {
    const s = Math.max(0, Math.round(seconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const formatBreakTime = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

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

  // Chart data for staff comparison — nama penuh (YAxis horizontal),
  // diurut sama dengan leaderboard (by resolved).
  const comparisonData = sortedStats.map((staff) => ({
    name: staff.name,
    resolved: staff.resolved,
    inProgress: staff.inProgress,
    pending: staff.pending,
    total: staff.resolved + staff.inProgress + staff.pending,
  }));

  // Trend bulanan: 28 hari dari API dikelompokkan jadi Week 1–4 (per 7 hari).
  // Week 1 = 7 hari terlama, Week 4 = 7 hari terakhir.
  const weeklyTrendData = useMemo(() => {
    const daily = stats?.trend || [];
    const fmt = (iso?: string) =>
      iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : "";
    const weeks = [];
    for (let w = 0; w < 4; w++) {
      const slice = daily.slice(w * 7, w * 7 + 7);
      if (!slice.length) continue;
      weeks.push({
        week: `Week ${w + 1}`,
        created: slice.reduce((s, d) => s + (d.created || 0), 0),
        resolved: slice.reduce((s, d) => s + (d.resolved || 0), 0),
        range: `${fmt(slice[0].date)} – ${fmt(slice[slice.length - 1].date)}`,
      });
    }
    return weeks;
  }, [stats?.trend]);

  const teamAssists = sortedStats.reduce((sum, staff) => sum + (staff.totalAssists || 0), 0);
  const sumResolved = comparisonData.reduce((s, d) => s + d.resolved, 0);
  const sumInProg = comparisonData.reduce((s, d) => s + d.inProgress, 0);
  const sumPend = comparisonData.reduce((s, d) => s + d.pending, 0);
  // Tinggi chart mengikuti jumlah staff agar tiap bar tetap lega dibaca.
  const workloadH = Math.max(300, comparisonData.length * 54 + 48);

  const slaTone = (staff: { totalAssigned: number; slaCompliance: string }) => {
    if (!staff.totalAssigned) return styles.toneIdle;
    const v = parseFloat(staff.slaCompliance);
    if (v >= 90) return styles.toneGood;
    if (v >= 70) return styles.toneMid;
    return styles.toneBad;
  };

  return (
    <div className={styles.contentWrapper}>
      <header className={styles.head}>
        <div>
          <p className={styles.kicker}>Team · All time</p>
          <h1 className={styles.title}>Performance insights</h1>
          <p className={styles.sub}>Who carries the load, how fast work closes, and where it stalls.</p>
        </div>
        <div className={styles.seg} role="tablist" aria-label="Performance views">
          {(["overview", "analytics", "leaderboard", "break"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={activeTab === t}
              className={activeTab === t ? styles.segOn : styles.segBtn}
              onClick={() => setActiveTab(t)}
            >
              {t === "overview" ? "Overview" : t === "analytics" ? "Analytics" : t === "leaderboard" ? "Leaderboard" : "Break"}
            </button>
          ))}
        </div>
      </header>

      {activeTab === "overview" && (
        <div className={styles.fade}>
          {topPerformer && (
            <section className={styles.hero} aria-label="Top performer">
              <span className={styles.heroRank}>01</span>
              <div className={styles.heroMain}>
                <p className={styles.kicker}>Top performer · All time</p>
                <h2 className={styles.heroName}>{topPerformer.name}</h2>
                <p className={styles.heroMeta}>{topPerformer.email} · {topPerformer.totalAssists || 0} assists</p>
              </div>
              <div className={styles.heroStats}>
                <div>
                  <p className={styles.heroNum}>{topPerformer.resolved}</p>
                  <p className={styles.heroLbl}>Resolved</p>
                </div>
                <div>
                  <p className={styles.heroNum}>{topPerformer.resolutionRate}<span className={styles.heroUnit}>%</span></p>
                  <p className={styles.heroLbl}>Rate</p>
                </div>
                <div>
                  <p className={styles.heroNum}>{topPerformer.avgResolutionTime}<span className={styles.heroUnit}>h</span></p>
                  <p className={styles.heroLbl}>Avg. time</p>
                </div>
              </div>
            </section>
          )}

          {/* Summary Statistics — stats TIM (seluruh staff), sesuai label Team
              pada tiap kartu. Bukan milik Top Performer di atas. */}
          <section className={styles.kpis} aria-label="Team metrics">
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>In progress</p>
              <p className={styles.kpiNum}>{stats?.workedOn || 0}</p>
              <p className={styles.kpiCtx}>team-wide open work</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>Resolved</p>
              <p className={styles.kpiNum}>{stats?.resolved || 0}</p>
              <p className={styles.kpiCtx}>resolved all time</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>Avg. resolution</p>
              <p className={styles.kpiNum}>{(stats?.avgResolutionTime ?? 0).toFixed(1)}<span className={styles.kpiUnit}>h</span></p>
              <p className={styles.kpiCtx}>per resolved ticket</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>Assists</p>
              <p className={styles.kpiNum}>{teamAssists}</p>
              <p className={styles.kpiCtx}>collaborator contributions</p>
            </div>
          </section>
        </div>
      )}

      {activeTab === "analytics" && (
        <div className={styles.grid2 + " " + styles.fade}>
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2 className={styles.panelTitle}>Workload by staff</h2>
                <p className={styles.panelSub}>Open vs. closed work per person</p>
              </div>
              <div className={styles.seriesKey}>
                <span className={styles.keyItem}><span className={styles.keyDot} style={{ background: "#10b981" }} />Resolved · {sumResolved}</span>
                <span className={styles.keyItem}><span className={styles.keyDot} style={{ background: "#3b82f6" }} />In progress · {sumInProg}</span>
                <span className={styles.keyItem}><span className={styles.keyDot} style={{ background: "#64748b" }} />Pending · {sumPend}</span>
              </div>
            </div>
            <div className={styles.chartScroll}>
              <div className={styles.chartMid} style={{ height: workloadH }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} layout="vertical" margin={{ top: 8, right: 48, left: 8, bottom: 0 }} barCategoryGap="26%">
                  <CartesianGrid strokeDasharray="2 4" horizontal={false} stroke="rgba(255,255,255,0.07)" />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#7d8590", fontSize: 11 }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={118}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#d1d5db", fontSize: 12 }}
                    tickFormatter={(v: string) => (v.length > 16 ? `${v.slice(0, 15)}…` : v)}
                  />
                  <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(255, 255, 255, 0.03)" }} />
                  <Bar dataKey="resolved" name="Resolved" fill="#10b981" radius={[4, 0, 0, 4]} barSize={18} stackId="w" />
                  <Bar dataKey="inProgress" name="In Progress" fill="#3b82f6" barSize={18} stackId="w" />
                  <Bar
                    dataKey="pending"
                    name="Pending"
                    fill="#64748b"
                    radius={[0, 4, 4, 0]}
                    barSize={18}
                    stackId="w"
                    background={{ fill: "rgba(255,255,255,0.04)", radius: 4 } as any}
                  >
                    <LabelList dataKey="total" position="right" fill="#e5e7eb" fontSize={12} fontWeight={700} formatter={(v: any) => (v > 0 ? v : "")} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2 className={styles.panelTitle}>Resolution trends</h2>
                <p className={styles.panelSub}>Created vs. resolved per week</p>
              </div>
            </div>
            <div className={styles.chartMid}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyTrendData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="rgba(255,255,255,0.07)" />
                  <XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fill: "#7d8590", fontSize: 12 }} dy={6} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: "#7d8590", fontSize: 12 }} allowDecimals={false} />
                  <Tooltip content={<ChartTip />} />
                  <Line type="monotone" dataKey="created" name="Created" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                  <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}

      {activeTab === "leaderboard" && (
        <section className={styles.panel + " " + styles.fade}>
          <div className={styles.panelHead}>
            <div>
              <h2 className={styles.panelTitle}>Leaderboard</h2>
              <p className={styles.panelSub}>Ranked by resolved tickets</p>
            </div>
          </div>
          <div className={styles.tableHead}>
            <span className={styles.rankH}>#</span>
            <span>Staff</span>
            <span className={styles.num}>Resolved</span>
            <span>Efficiency</span>
            <span className={styles.num}>SLA</span>
            <span />
          </div>
          <div>
            {sortedStats.map((staff, index) => {
              const isOwnProfile = session.userId === staff.id;
              const canViewProfile = isOwnProfile || session.userRole === 'Administrator' || session.userRole === 'Management';
              return (
                <div
                  key={staff.id}
                  className={canViewProfile ? styles.rowLink : styles.tableRow}
                  onClick={() => canViewProfile ? navigate(`/profile/${staff.id}`) : undefined}
                >
                  <span className={styles.rank}>{String(index + 1).padStart(2, "0")}</span>
                  <span className={styles.staffCell}>
                    <span className={styles.avatar}>{staff.name.charAt(0)}</span>
                    <span className={styles.staffMeta}>
                      <span className={styles.staffName}>{staff.name}</span>
                      <span className={styles.staffEmail}>{staff.email}</span>
                    </span>
                  </span>
                  <span className={styles.num + " " + styles.big}>{staff.resolved}</span>
                  <span className={styles.effCell}>
                    <span className={styles.num}>{staff.resolutionRate}%</span>
                    <span className={styles.hairline}>
                      <span className={styles.hairlineFill} style={{ width: `${staff.resolutionRate}%` }} />
                    </span>
                  </span>
                  <span className={styles.num}>
                    <span className={`${styles.pill} ${slaTone(staff)}`}>
                      <span className={styles.pillDot} />
                      {staff.totalAssigned > 0 ? `${staff.slaCompliance}%` : "—"}
                    </span>
                  </span>
                  <span className={styles.go}>
                    {canViewProfile && <ChevronRight size={16} />}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {activeTab === "break" && (
        <div className={styles.fade}>
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2 className={styles.panelTitle}>Break time log</h2>
                <p className={styles.panelSub}>
                  Pemakaian vs sisa per staff
                  {breakRange ? ` · ${breakRange.start} s/d ${breakRange.end}` : ""}
                  {breakLimit != null ? ` · batas ${breakLimit} mnt` : ""}
                  {session && (session as any)?.userRole === "Staff" ? " · (akun Staff hanya melihat datanya sendiri)" : ""}
                </p>
              </div>
              <div className={styles.seg} role="tablist" aria-label="Break period">
                {(["daily", "weekly", "monthly"] as const).map((p) => (
                  <button
                    key={p}
                    role="tab"
                    aria-selected={breakPeriod === p}
                    className={breakPeriod === p ? styles.segOn : styles.segBtn}
                    onClick={() => setBreakPeriod(p)}
                  >
                    {p === "daily" ? "Harian" : p === "weekly" ? "Mingguan" : "Bulanan"}
                  </button>
                ))}
              </div>
            </div>
            {breakLoading && <p className={styles.panelSub}>Memuat data break…</p>}
            {breakError && <p className={styles.panelSub} style={{ color: "#fca5a5" }}>{breakError}</p>}
            {!breakLoading && !breakError && breakSummary && (
              <div className={styles.breakScroll}>
                <div className={styles.breakHead}>
                  <span className={styles.rankH}>#</span>
                  <span>Staff</span>
                  <span className={`${styles.num} ${styles.breakHeadNum}`}>Sesi</span>
                  <span className={`${styles.num} ${styles.breakHeadNum}`}>Dipakai</span>
                  <span className={`${styles.num} ${styles.breakHeadNum}`}>Sisa</span>
                  <span className={styles.breakHeadStatus}>Status</span>
                </div>
                <div>
                  {breakSummary.length === 0 && (
                    <p className={styles.panelSub}>Belum ada data break pada periode ini.</p>
                  )}
                  {breakSummary.map((row, index) => {
                    const over = row.remainingSeconds < 0;
                    return (
                      <div key={row.userId} className={styles.breakRow}>
                        <span className={styles.rank}>{String(index + 1).padStart(2, "0")}</span>
                        <span className={styles.staffCell}>
                          <span className={styles.avatar}>{(row.userName || "?").charAt(0)}</span>
                          <span className={styles.staffMeta}>
                            <span className={styles.staffName}>
                              {row.userName}
                              {row.isOnBreak && (
                                <span style={{ marginLeft: 8, fontSize: 11, color: "#6ee7b7" }}>● on break</span>
                              )}
                            </span>
                            <span className={styles.staffEmail}>{row.username} · {row.role}</span>
                          </span>
                        </span>
                        <span className={`${styles.num} ${styles.big} ${styles.breakNum}`}>{row.sessionsCount}</span>
                        <span className={`${styles.num} ${styles.breakNum}`}>{formatBreakHM(row.usedSeconds)}</span>
                        <span className={`${styles.num} ${styles.breakSisa}`} style={{ color: over ? "#fca5a5" : undefined }}>
                          {over ? `Habis (+${formatBreakHM(-row.remainingSeconds)})` : formatBreakHM(row.remainingSeconds)}
                        </span>
                        <span className={`${styles.num} ${styles.breakStatus}`}>
                          <span className={`${styles.pill} ${styles.breakPill} ${row.isOnBreak ? styles.toneMid : over ? styles.toneBad : styles.toneGood}`}>
                            <span className={styles.pillDot} />
                            {row.isOnBreak ? "Break" : over ? "Over" : "Aman"}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2 className={styles.panelTitle}>Sesi log</h2>
                <p className={styles.panelSub}>
                  {breakLogsTotal != null ? `${breakLogsTotal} sesi` : "Log sesi break yang sudah END"}
                  {breakRange ? ` · ${breakRange.start} s/d ${breakRange.end}` : ""}
                  {" · terbaru dulu"}
                </p>
              </div>
            </div>
            {!breakLogs || breakLogs.length === 0 ? (
              <p className={styles.panelSub}>Belum ada sesi break pada periode ini.</p>
            ) : (
              <div className={styles.breakLogScroll}>
                {breakLogs.map((log) => (
                  <div key={log.id} className={styles.breakLogRow}>
                    <span className={styles.staffCell}>
                      <span className={styles.staffMeta}>
                        <span className={styles.staffName}>{log.userName || `User ${log.userId}`}</span>
                        <span className={styles.staffEmail}>
                          {formatBreakTime(log.startedAt)} → {formatBreakTime(log.endedAt)}
                        </span>
                      </span>
                    </span>
                    <span className={`${styles.num} ${styles.big} ${styles.breakLogDur}`}>{formatBreakHM(log.durationSeconds)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
