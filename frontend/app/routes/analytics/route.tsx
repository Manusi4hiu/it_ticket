import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
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
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { getTicketStats, getAllAgentsPerformance } from "~/services/ticket.service";
import { settingsApi, type Category, type Priority, type Status, type Department } from "~/services/settings.service";
import { requireRole } from "~/services/session.service";
import type { Route } from "./+types/route";
import styles from "./style.module.css";

// Warna otomatis tak terbatas untuk data master tanpa warna sendiri
// (Category/Department): rotasi golden-angle → tiap urutan master selalu
// dapat warna berbeda, berapa pun jumlah kategorinya. Deterministik
// berdasarkan urutan master yang stabil (bukan urutan data).
const autoColor = (index: number) =>
  `hsl(${Math.round((index * 137.508) % 360)}, 65%, 55%)`;

// Periode tren: "7d" = 7 hari terakhir dari hari ini (rolling),
// "30d" = 30 hari terakhir dari hari ini (rolling), atau quarter
// tahun berjalan (jangkar kalender — jangan diubah, sudah benar).
const RANGES = ["7d", "30d", "q1", "q2", "q3", "q4", "custom"] as const;
type TrendRange = (typeof RANGES)[number];
const PRESET_RANGES = ["7d", "30d", "q1", "q2", "q3", "q4"] as const;

// Rentang custom maksimal 365 hari (inklusif).
const CUSTOM_MAX_DAYS = 365;

/** Batas tanggal quarter (ISO YYYY-MM-DD). Akhir dijepit ke hari ini agar
    quarter berjalan tak meminta hari masa depan. */
function quarterBounds(q: number, now: Date) {
  const year = now.getFullYear();
  const sm = (q - 1) * 3; // bulan awal (0-based)
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = `${year}-${pad(sm + 1)}-01`;
  const lastDay = new Date(year, sm + 3, 0).getDate();
  let end = `${year}-${pad(sm + 3)}-${pad(lastDay)}`;
  const today = `${year}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  if (end > today) end = today;
  return { start, end };
}

/** 7 hari terakhir dari hari ini (rolling, inklusif). Mis. dibuka
    tanggal 8 → 2–8. Bukan Senin–Minggu. */
function last7Days(now: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const start = new Date(now);
  start.setDate(start.getDate() - 6);
  return { start: iso(start), end: iso(now) };
}

/** 30 hari terakhir dari hari ini (rolling, inklusif). Bukan
    tanggal 1–akhir bulan. */
function last30Days(now: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const start = new Date(now);
  start.setDate(start.getDate() - 29);
  return { start: iso(start), end: iso(now) };
}

/** Rentang custom pilihan user (ISO YYYY-MM-DD). Invalid (format salah,
    start > end, keduanya di masa depan) → null supaya loader fallback ke 7d.
    Akhir dijepit ke hari ini, rentang dijepit ke CUSTOM_MAX_DAYS. */
function customBounds(startRaw: string | null, endRaw: string | null, now: Date) {
  const valid = (s: string | null) =>
    !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(`${s}T00:00:00`).getTime());
  if (!valid(startRaw) || !valid(endRaw)) return null;
  let start = startRaw as string;
  let end = endRaw as string;
  if (start > end) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  if (end > today) end = today;
  if (start > end) return null;
  const earliest = new Date(`${end}T00:00:00`);
  earliest.setDate(earliest.getDate() - (CUSTOM_MAX_DAYS - 1));
  const earliestIso = `${earliest.getFullYear()}-${pad(earliest.getMonth() + 1)}-${pad(earliest.getDate())}`;
  if (start < earliestIso) start = earliestIso;
  return { start, end };
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await requireRole(request, ["Administrator", "Management"]);

  const params = new URL(request.url).searchParams;
  const raw = params.get("range") || "7d";
  let range: TrendRange = (RANGES as readonly string[]).includes(raw) ? (raw as TrendRange) : "7d";

  // Jendela eksplisit per periode — HANYA untuk sub-page Overview (KPI kohort
  // + tren). Rolling dari hari ini: 7d = 7 hari terakhir, 30d = 30 hari
  // terakhir, custom = pilihan user (divalidasi, fallback 7d bila invalid),
  // q* = quarter kalender (jangan diubah).
  // Distribution & Staff ranking selalu all-time (semua data, tanpa
  // filter waktu), jadi diambil dari panggilan terpisah tanpa window.
  const now = new Date();
  let window;
  if (range === "custom") {
    const custom = customBounds(params.get("start"), params.get("end"), now);
    if (!custom) range = "7d";
    window = custom ?? last7Days(now);
  } else {
    window =
      range === "7d" ? last7Days(now)
      : range === "30d" ? last30Days(now)
      : quarterBounds(Number(range.slice(1)), now);
  }

  const [stats, statsAll, agentsPerformance, categoriesRes, prioritiesRes, statusesRes, departmentsRes] = await Promise.all([
    getTicketStats(false, undefined, window),
    getTicketStats(),
    getAllAgentsPerformance(),
    settingsApi.getCategories(),
    settingsApi.getPriorities(),
    settingsApi.getStatuses(),
    settingsApi.getDepartments(),
  ]);

  // Master hanya yang aktif (isActive !== false) — sama dengan aturan dropdown Tickets.
  // Status tambahan: hanya yang muncul di IT Helpdesk (bukan Development board).
  const categories = ((categoriesRes.data?.data || []) as Category[]).filter((c) => c.isActive !== false);
  const priorities = ((prioritiesRes.data?.data || []) as Priority[]).filter((p) => p.isActive !== false);
  const statuses = ((statusesRes.data?.data || []) as Status[]).filter((s) => s.showOnItHelpdesk !== false);
  const departments = ((departmentsRes.data?.data || []) as Department[]).filter((d) => d.isActive !== false);

  return Response.json({
    session,
    range,
    start: window.start,
    end: window.end,
    stats,
    statsAll,
    agentsPerformance,
    categories,
    priorities,
    statuses,
    departments
  });
}

/** Tanggal penuh Indonesia untuk tooltip — mis. "Kamis, 11 September 2026". */
const fullDate = (iso?: string) =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

/** Tooltip gelap bersama untuk semua chart garis di halaman ini. */
function TrendTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  const stamp = p?.range ? `${label} · ${p.range}` : p?.date ? fullDate(p.date) : label;
  return (
    <div className={styles.tip}>
      <p className={styles.tipTitle}>{stamp}</p>
      {payload.map((p: any) => (
        <div key={String(p.dataKey)} className={styles.tipRow}>
          <span className={styles.tipDot} style={{ background: p.color ?? p.stroke }} />
          <span className={styles.tipName}>{p.name}</span>
          <span className={styles.tipVal}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Baris legenda + angka untuk donat: nama, jumlah, persen. */
function Ledger({ rows, total }: { rows: { name: string; value: number; color: string }[]; total: number }) {
  return (
    <ul className={styles.ledger}>
      {rows.map((r) => (
        <li key={r.name} className={styles.ledgerRow}>
          <span className={styles.ledgerDot} style={{ background: r.color }} />
          <span className={styles.ledgerName}>{r.name}</span>
          <span className={styles.ledgerVal}>{r.value}</span>
          <span className={styles.ledgerPct}>{total > 0 ? ((r.value / total) * 100).toFixed(0) : 0}%</span>
        </li>
      ))}
    </ul>
  );
}

export default function Analytics({ loaderData }: Route.ComponentProps) {
  const { stats, statsAll, agentsPerformance, categories, priorities, statuses, departments, range, start, end } = loaderData;
  const [activeTab, setActiveTab] = useState<"overview" | "distribution" | "staff">("overview");
  const [, setParams] = useSearchParams();

  if (!stats) return <div className="p-12 text-center text-slate-400">Loading analytics...</div>;

  return (
    <AnalyticsBody
      stats={stats}
      statsAll={statsAll || stats}
      agentsPerformance={agentsPerformance}
      categories={categories}
      priorities={priorities}
      statuses={statuses}
      departments={departments}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      range={range as TrendRange}
      rangeStart={start}
      rangeEnd={end}
      onRangeChange={(r, custom) =>
        setParams(r === "7d" ? {} : custom ? { range: r, start: custom.start, end: custom.end } : { range: r })
      }
    />
  );
}

function AnalyticsBody({
  stats, statsAll, agentsPerformance, categories, priorities, statuses, departments, activeTab, setActiveTab, range, rangeStart, rangeEnd, onRangeChange,
}: {
  stats: any;
  statsAll: any;
  agentsPerformance: any[];
  categories: Category[];
  priorities: Priority[];
  statuses: Status[];
  departments: Department[];
  activeTab: "overview" | "distribution" | "staff";
  setActiveTab: (t: "overview" | "distribution" | "staff") => void;
  range: TrendRange;
  rangeStart: string;
  rangeEnd: string;
  onRangeChange: (r: TrendRange, custom?: { start: string; end: string }) => void;
}) {
  const resolvedTickets = stats.resolved;
  const avgResolutionTime = `${stats.avgResolutionTime}h`;
  const slaCompliance = stats.total > 0
    ? ((stats.sla.healthy / stats.total) * 100).toFixed(1)
    : "0.0";
  const openPct = stats.total > 0 ? ((stats.open / stats.total) * 100).toFixed(1) : "0.0";
  const resolutionRate = stats.total > 0 ? ((stats.resolved / stats.total) * 100).toFixed(1) : "0.0";

  // Rentang custom: input tanggal user. Hanya disinkron dari loader saat
  // periode custom aktif, agar pilihan tanggal bertahan saat user pindah
  // ke periode lain lalu kembali. Hari ini (lokal) = batas atas input.
  const todayIso = useMemo(() => {
    const t = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
  }, []);
  const [customStart, setCustomStart] = useState(rangeStart);
  const [customEnd, setCustomEnd] = useState(rangeEnd);
  useEffect(() => {
    if (range === "custom") {
      setCustomStart(rangeStart);
      setCustomEnd(rangeEnd);
    }
  }, [range, rangeStart, rangeEnd]);
  const customValid =
    !!customStart && !!customEnd && customStart <= customEnd && customEnd <= todayIso;

  // Panjang jendela efektif (hari, inklusif). Custom ≤14 hari digambar harian
  // seperti 7d; selebihnya diagregasi per minggu seperti 30d/quarter.
  const spanDays = useMemo(() => {
    const ms = new Date(`${rangeEnd}T00:00:00`).getTime() - new Date(`${rangeStart}T00:00:00`).getTime();
    return Number.isFinite(ms) ? Math.round(ms / 86400000) + 1 : 0;
  }, [rangeStart, rangeEnd]);
  const isDaily = range === "7d" || (range === "custom" && spanDays <= 14);

  const fmtShort = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  const customLabel = `${fmtShort(rangeStart)} – ${fmtShort(rangeEnd)} ${rangeEnd.slice(0, 4)}`;

  // Distribusi status: 4 grup kerja backend (New/In Progress/Pending/Resolved).
  // Warna diambil dari master Status (case-insensitive); fallback ke netral bila
  // master tidak punya warna — tidak ada lagi warna status hardcode.
  // Distribusi status: snapshot terkini (all-time, tak ikut periode) —
  // new/workedOn/pending live, resolved dari snapshot all-time.
  const statusData = useMemo(() => {
    const colorOf = (name: string, fallback: string) => {
      const hit = statuses.find((s) => s.name.toLowerCase() === name.toLowerCase());
      return hit?.color || fallback;
    };
    return [
      { name: "New", value: stats.new, color: colorOf("New", "#3b82f6") },
      { name: "In Progress", value: stats.workedOn, color: colorOf("In Progress", "#f59e0b") },
      { name: "Pending", value: stats.pending, color: colorOf("Pending", "#9ca3af") },
      { name: "Resolved", value: statsAll.resolved, color: colorOf("Resolved", "#10b981") },
    ];
  }, [stats.new, stats.workedOn, stats.pending, statsAll.resolved, statuses]);

  // Priority: nama & warna dari master (bukan COLOR_MAP hardcode), urut level
  // master (1=Critical ... 4=Low). Nilai lama di luar master tetap tampil
  // sebagai cadangan agar angka tiket tidak hilang — tidak ada warna acak.
  // Priority/categories/departments: all-time (tak ikut periode) — dibaca
  // dari snapshot statsAll.
  const priorityData = useMemo(() => {
    const masterByName = new Map(priorities.map((p) => [p.name.toLowerCase(), p]));
    return Object.entries(statsAll.byPriority)
      .map(([key, count]) => {
        const master = masterByName.get(key.toLowerCase());
        return {
          name: master?.name || key.charAt(0).toUpperCase() + key.slice(1),
          count,
          color: master?.color || "#94a3b8",
          level: master?.level ?? 99,
        };
      })
      .sort((a, b) => a.level - b.level);
  }, [statsAll.byPriority, priorities]);

  // Category: hanya category master yang aktif. Nilai lama di tiket
  // (mis. "Maintenance System") atau di luar master tidak digambar — itu
  // sumber grafik "category hantu" yang tidak ada di Settings.
  // Lookup case-insensitive supaya nilai tiket berbeda kapitalisasi tetap
  // terhitung ke master-nya tanpa memunculkan label duplikat.
  const categoryData = useMemo(() => {
    const countByLower = new Map(
      Object.entries(statsAll.byCategory).map(([k, v]) => [k.toLowerCase(), v])
    );
    return categories
      .map((c, index) => ({
        name: c.name,
        value: countByLower.get(c.name.toLowerCase()) || 0,
        color: autoColor(index),
      }))
      .filter((c) => c.value > 0);
  }, [statsAll.byCategory, categories]);

  // Ticket dengan category di luar master (data lama / tidak sinkron) —
  // ditampilkan sebagai catatan terpisah agar tidak jadi potongan pai palsu.
  const unlistedCategories = useMemo(() => {
    const activeNames = new Set(categories.map((c) => c.name.toLowerCase()));
    return Object.entries(statsAll.byCategory)
      .filter(([name]) => !activeNames.has(name.toLowerCase()))
      .sort((a, b) => b[1] - a[1]);
  }, [statsAll.byCategory, categories]);

  // Department: sinkron master seperti Category — iterasi master departments
  // yang aktif (urutan stabil untuk warna), lookup hitungan case-insensitive.
  // Department baru yang ditambah admin otomatis muncul begitu ada tiketnya,
  // tanpa edit kode. Nilai di luar master jadi catatan, bukan batang palsu.
  const departmentData = useMemo(() => {
    const countByLower = new Map(
      Object.entries(statsAll.byDepartment).map(([k, v]) => [k.toLowerCase(), v])
    );
    return departments
      .map((d, index) => ({
        name: d.name,
        count: countByLower.get(d.name.toLowerCase()) || 0,
        color: autoColor(index),
      }))
      .filter((d) => d.count > 0);
  }, [statsAll.byDepartment, departments]);

  // Ticket dengan department di luar master — catatan terpisah (simetris
  // dengan kategori), agar batang asing tidak muncul diam-diam.
  const unlistedDepartments = useMemo(() => {
    const activeNames = new Set(departments.map((d) => d.name.toLowerCase()));
    return Object.entries(statsAll.byDepartment)
      .filter(([name]) => !activeNames.has(name.toLowerCase()))
      .sort((a, b) => b[1] - a[1]);
  }, [statsAll.byDepartment, departments]);

  // Staff dinilai hanya jika punya tiket. Angka rata-rata hanya muncul bila
  // ada tiket selesai — tidak ada lagi "0.0h" atau badge "good" bagi staff
  // tanpa aktivitas (halusinasi dari || dan avg 0).
  const agentPerformance = useMemo(() => agentsPerformance
    .map((agent) => {
      const total = agent.totalAssigned;
      const resolvedCount = agent.resolved;

      let performance: "excellent" | "good" | "average" = "average";
      if (total > 0) {
        if (resolvedCount >= 5 && agent.avgResolutionTime <= 4) performance = "excellent";
        else if (resolvedCount >= 2 && agent.avgResolutionTime <= 8) performance = "good";
      }

      return {
        id: agent.id,
        name: agent.name,
        assigned: total,
        resolved: resolvedCount,
        avgTime: resolvedCount > 0 ? `${agent.avgResolutionTime.toFixed(1)}h` : "—",
        performance,
      };
    })
    .filter((agent) => agent.assigned > 0)
    .sort((a, b) => b.resolved - a.resolved || b.assigned - a.assigned), [agentsPerformance]);

  const unassignedAgents = useMemo(
    () => agentsPerformance.filter((agent) => agent.totalAssigned === 0).length,
    [agentsPerformance]
  );

  // Kicker mengikuti periode aktif (rolling dari hari ini / custom user).
  const rangeKicker = useMemo(() => {
    if (range === "custom") return `Helpdesk · ${customLabel}`;
    if (range === "30d") return "Helpdesk · Last 30 days";
    if (range.startsWith("q")) {
      const q = Number(range.slice(1));
      const year = new Date().getFullYear();
      const sm = (q - 1) * 3;
      const mon = (mi: number) =>
        new Date(year, mi, 1).toLocaleDateString("en-US", { month: "short" });
      return `Helpdesk · Q${q} ${year} · ${mon(sm)}–${mon(sm + 2)}`;
    }
    return "Helpdesk · Last 7 days";
  }, [range, customLabel]);

  // Tren harian backend diagregasi per minggu (7 hari) untuk 30d/quarter agar
  // garis tetap terbaca — pola sama seperti staff-performance: Week 1..N +
  // rentang tanggal lengkap di tooltip. Mode 7d tetap harian, label sumbu
  // memakai tanggal ("11 Sep") dan tooltip memakai tanggal penuh Indonesia.
  const trendData = useMemo(() => {
    const daily = stats.trend || [];
    const shortDay = (iso?: string) =>
      iso
        ? new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" })
        : "";
    if (isDaily) return daily.map((d: any) => ({ ...d, short: shortDay(d.date) || d.day }));
    const fmtDay = (iso?: string) =>
      iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "long" }) : "";
    const out: { week: string; created: number; resolved: number; range: string }[] = [];
    for (let i = 0; i < daily.length; i += 7) {
      const slice = daily.slice(i, i + 7);
      const year = slice[slice.length - 1]?.date?.slice(0, 4) || "";
      out.push({
        week: `Week ${out.length + 1}`,
        created: slice.reduce((s: number, d: any) => s + (d.created || 0), 0),
        resolved: slice.reduce((s: number, d: any) => s + (d.resolved || 0), 0),
        range: `${fmtDay(slice[0]?.date)} – ${fmtDay(slice[slice.length - 1]?.date)}${year ? ` ${year}` : ""}`,
      });
    }
    return out;
  }, [stats.trend, range, isDaily]);

  // Frasa periode untuk sub-judul panel ("in the last 30 days", "in Q3 2026",
  // "in 2–20 Sep 2026" untuk custom).
  const periodNoun = useMemo(() => {
    if (range === "custom") return customLabel;
    if (range === "30d") return "the last 30 days";
    if (range.startsWith("q")) return `Q${range.slice(1)} ${new Date().getFullYear()}`;
    return "the last 7 days";
  }, [range, customLabel]);
  const trendTotals = useMemo(() => trendData.reduce(
    (s: { created: number; resolved: number }, d: any) => ({
      created: s.created + (d.created || 0),
      resolved: s.resolved + (d.resolved || 0),
    }),
    { created: 0, resolved: 0 }
  ), [trendData]);
  const statusTotal = statusData.reduce((s, d) => s + d.value, 0);
  // Terapkan rentang custom. Bila input tak valid, kembalikan ke jendela
  // efektif terakhir lalu terapkan itu (tak pernah navigasi buta).
  const applyCustom = () => {
    if (customValid) {
      onRangeChange("custom", { start: customStart, end: customEnd });
    } else {
      setCustomStart(rangeStart);
      setCustomEnd(rangeEnd);
      onRangeChange("custom", { start: rangeStart, end: rangeEnd });
    }
  };
  const categoryTotal = categoryData.reduce((s, d) => s + (d.value as number), 0);

  return (
    <div className={styles.contentWrapper}>
      <header className={styles.head}>
        <div>
          <p className={styles.kicker}>{activeTab === "overview" ? rangeKicker : "Helpdesk · All time"}</p>
          <h1 className={styles.title}>System analytics</h1>
          <p className={styles.sub}>Throughput, backlog shape and SLA health across IT support.</p>
        </div>
        <div className={styles.seg} role="tablist" aria-label="Analytics views">
          {(["overview", "distribution", "staff"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={activeTab === t}
              className={activeTab === t ? styles.segOn : styles.segBtn}
              onClick={() => setActiveTab(t)}
            >
              {t === "overview" ? "Overview" : t === "distribution" ? "Distribution" : "Staff"}
            </button>
          ))}
        </div>
      </header>

      {activeTab === "overview" && (
        <div className={styles.fade}>
          <section className={styles.kpis} aria-label="Key metrics">
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>Total tickets</p>
              <p className={styles.kpiNum}>{stats.total}</p>
              <p className={styles.kpiCtx}>in {periodNoun}</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>Open</p>
              <p className={styles.kpiNum}>{stats.open}</p>
              <p className={styles.kpiCtx}>{openPct}% of total</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>Resolved</p>
              <p className={styles.kpiNum}>{resolvedTickets}</p>
              <p className={styles.kpiCtx}>{resolutionRate}% resolution rate</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>Avg. resolution</p>
              <p className={styles.kpiNum}>{avgResolutionTime}</p>
              <p className={styles.kpiCtx}>per resolved ticket</p>
            </div>
            <div className={styles.kpi}>
              <p className={styles.kpiLabel}>SLA compliance</p>
              <p className={styles.kpiNum}>{slaCompliance}<span className={styles.kpiUnit}>%</span></p>
              <p className={styles.kpiCtx}>{stats.sla.healthy} healthy · {stats.sla.breached} breached</p>
            </div>
          </section>

          <div className={styles.rangeRow}>
            <div className={styles.rangeHeaderGroup}>
              <span className={styles.rangeLbl}>Period</span>
              <div className={styles.seg} role="tablist" aria-label="Trend period">
                {PRESET_RANGES.map((r) => {
                  const label = r === "7d" ? "7D" : r === "30d" ? "1M" : r.toUpperCase();
                  const hint =
                    r === "7d" ? "7 hari terakhir dari hari ini"
                    : r === "30d" ? "30 hari terakhir dari hari ini"
                    : `Quarter ${r.slice(1)}, this year`;
                  return (
                    <button
                      key={r}
                      type="button"
                      role="tab"
                      aria-selected={range === r}
                      title={hint}
                      className={range === r ? styles.segOn : styles.segBtn}
                      onClick={() => onRangeChange(r)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={styles.rangeDivider} />

            <div className={styles.customRow}>
              <div className={styles.customDateInputs}>
                <label className={styles.dateField}>
                  <span className={styles.dateFieldLabel}>Dari</span>
                  <input
                    type="date"
                    value={customStart}
                    max={customEnd || todayIso}
                    onChange={(e) => setCustomStart(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && customValid) applyCustom(); }}
                  />
                </label>
                <label className={styles.dateField}>
                  <span className={styles.dateFieldLabel}>Sampai</span>
                  <input
                    type="date"
                    value={customEnd}
                    min={customStart}
                    max={todayIso}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && customValid) applyCustom(); }}
                  />
                </label>
              </div>
              <button
                type="button"
                className={`${styles.applyBtn} ${range === "custom" ? styles.applyBtnActive : ""}`}
                disabled={!customValid || (range === "custom" && customStart === rangeStart && customEnd === rangeEnd)}
                onClick={applyCustom}
                title="Terapkan rentang tanggal kustom"
              >
                Terapkan
              </button>
            </div>

            {customStart && customEnd && !customValid && (
              <span className={styles.dateHint}>
                Tanggal &ldquo;Sampai&rdquo; harus &ge; &ldquo;Dari&rdquo; dan tidak melewati hari ini.
              </span>
            )}
          </div>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2 className={styles.panelTitle}>Ticket activity</h2>
                <p className={styles.panelSub}>
                  {isDaily ? "Created vs. resolved per day" : "Created vs. resolved per week"}
                </p>
              </div>
              <div className={styles.seriesKey}>
                <span className={styles.keyItem}><span className={styles.keyDot} style={{ background: "#3b82f6" }} />Created · {trendTotals.created}</span>
                <span className={styles.keyItem}><span className={styles.keyDot} style={{ background: "#10b981" }} />Resolved · {trendTotals.resolved}</span>
              </div>
            </div>
            <div className={styles.chartTall}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                  <XAxis
                    dataKey={isDaily ? "short" : "week"}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                    dy={6}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 12 }}
                    allowDecimals={false}
                  />
                  <Tooltip content={<TrendTip />} />
                  <Line
                    type="monotone"
                    dataKey="created"
                    name="Created"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="resolved"
                    name="Resolved"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {trendData.length === 0 && (
              <p className={styles.note}>No activity in this period yet — this quarter has not started.</p>
            )}
          </section>
        </div>
      )}

      {activeTab === "distribution" && (
        <div className={styles.grid2 + " " + styles.fade}>
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2 className={styles.panelTitle}>Status</h2>
                <p className={styles.panelSub}>Current workload by ticket status</p>
              </div>
            </div>
            <div className={styles.donutWrap}>
              <div className={styles.donut}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={68}
                      outerRadius={92}
                      paddingAngle={3}
                      cornerRadius={4}
                      stroke="none"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<TrendTip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className={styles.donutCenter}>
                  <span className={styles.donutNum}>{statusTotal}</span>
                  <span className={styles.donutLbl}>tickets</span>
                </div>
              </div>
              <Ledger rows={statusData} total={statusTotal} />
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2 className={styles.panelTitle}>Priority load</h2>
                <p className={styles.panelSub}>Open tickets by priority, ordered by urgency</p>
              </div>
            </div>
            {/* Jika priority banyak: layout horizontal + tinggi dinamis agar semua label terbaca;
                jika sedikit: tetap bar vertikal seperti semula */}
            <div className={styles.chartScroll}>
              <div
                className={styles.chartMid}
                style={{
                  height: priorityData.length > 8 ? Math.max(264, priorityData.length * 26 + 12) : 264,
                }}
              >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout={priorityData.length > 8 ? "vertical" : "horizontal"}
                  data={priorityData}
                  margin={
                    priorityData.length > 8
                      ? { top: 0, right: 36, left: 8, bottom: 0 }
                      : { top: 16, right: 8, left: -18, bottom: 0 }
                  }
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255, 255, 255, 0.05)"
                    vertical={!(priorityData.length > 8)}
                    horizontal={priorityData.length > 8}
                  />
                  {priorityData.length > 8 ? (
                    <XAxis type="number" hide />
                  ) : (
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      dy={6}
                    />
                  )}
                  {priorityData.length > 8 ? (
                    <YAxis
                      dataKey="name"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      width={118}
                    />
                  ) : (
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 12 }}
                      allowDecimals={false}
                    />
                  )}
                  <Tooltip content={<TrendTip />} cursor={{ fill: "rgba(255, 255, 255, 0.03)" }} />
                  <Bar
                    dataKey="count"
                    barSize={priorityData.length > 8 ? 16 : 30}
                    radius={(priorityData.length > 8 ? [0, 4, 4, 0] : [4, 4, 0, 0]) as [number, number, number, number]}
                  >
                    {priorityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                    <LabelList
                      dataKey="count"
                      position={priorityData.length > 8 ? "right" : "top"}
                      fill="#aeb6c2"
                      fontSize={12}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2 className={styles.panelTitle}>Categories</h2>
                <p className={styles.panelSub}>Share of active master categories</p>
              </div>
            </div>
            <div className={styles.donutWrap}>
              <div className={styles.donut}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={68}
                      outerRadius={92}
                      paddingAngle={3}
                      cornerRadius={4}
                      stroke="none"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<TrendTip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className={styles.donutCenter}>
                  <span className={styles.donutNum}>{categoryTotal}</span>
                  <span className={styles.donutLbl}>tickets</span>
                </div>
              </div>
              <Ledger rows={categoryData} total={categoryTotal} />
            </div>
            {unlistedCategories.length > 0 && (
              <p className={styles.note}>
                {unlistedCategories.reduce((sum, [, count]) => sum + (count as number), 0)} ticket(s) use categories outside master data: {unlistedCategories.map(([name, count]) => `${name} (${count})`).join(", ")}
              </p>
            )}
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2 className={styles.panelTitle}>Department demand</h2>
                <p className={styles.panelSub}>Ticket volume by reporting unit</p>
              </div>
            </div>
            {/* Tinggi chart mengikuti jumlah departemen agar bar & label tetap lega terbaca;
                dibatasi tinggi nyaman — kelebihannya bisa di-scroll */}
            <div className={styles.chartScroll}>
              <div
                className={styles.chartMid}
                style={{ height: Math.max(264, departmentData.length * 26 + 12) }}
              >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={departmentData}
                  margin={{ top: 0, right: 36, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#aeb6c2", fontSize: 12 }}
                    width={118}
                  />
                  <Tooltip content={<TrendTip />} cursor={{ fill: "rgba(255, 255, 255, 0.03)" }} />
                  <Bar dataKey="count" barSize={16} radius={[0, 4, 4, 0]}>
                    {departmentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                    <LabelList dataKey="count" position="right" fill="#aeb6c2" fontSize={12} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              </div>
            </div>
            {unlistedDepartments.length > 0 && (
              <p className={styles.note}>
                {unlistedDepartments.reduce((sum, [, count]) => sum + (count as number), 0)} ticket(s) use departments outside master data: {unlistedDepartments.map(([name, count]) => `${name} (${count})`).join(", ")}
              </p>
            )}
          </section>
        </div>
      )}

      {activeTab === "staff" && (
        <section className={styles.panel + " " + styles.fade}>
          <div className={styles.panelHead}>
            <div>
                <h2 className={styles.panelTitle}>Staff ranking</h2>
                <p className={styles.panelSub}>Sorted by resolved, then assigned</p>
            </div>
          </div>
          <div className={styles.tableHead}>
            <span>Agent</span>
            <span className={styles.num}>Assigned</span>
            <span className={styles.num}>Resolved</span>
            <span className={styles.num}>Avg. time</span>
            <span>Rating</span>
          </div>
          <div>
            {agentPerformance.map((agent) => (
              <div key={agent.id} className={styles.tableRow}>
                <span className={styles.staffCell}>
                  <span className={styles.avatar}>{agent.name.charAt(0)}</span>
                  <span className={styles.staffName}>{agent.name}</span>
                </span>
                <span className={styles.num}>{agent.assigned}</span>
                <span className={styles.num}>{agent.resolved}</span>
                <span className={styles.num}>{agent.avgTime}</span>
                <span>
                  <span className={`${styles.pill} ${styles[agent.performance]}`}>
                    <span className={styles.pillDot} />
                    {agent.performance}
                  </span>
                </span>
              </div>
            ))}
          </div>
          {unassignedAgents > 0 && (
            <p className={styles.note}>
              {unassignedAgents} staff member(s) hold no tickets and are excluded from this ranking.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
