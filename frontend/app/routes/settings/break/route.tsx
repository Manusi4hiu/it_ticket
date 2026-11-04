/**

 * route.tsx — Jam Kerja, Batas Break & Pengaturan SLA

 *

 * Pengaturan terpadu untuk:

 * 1. Jam Kerja Operasional Kantor (Senin - Jumat, 08:00 - 17:00 WIB)

 * 2. Aturan Countdown & Pause SLA Tiket di luar jam kerja & hari libur

 * 3. Batas Waktu Istirahat (Break) Staff IT & Otomatisasi Auto-End

 * 4. Data Hari Libur Nasional & Cuti Bersama Indonesia (Otomatis via API Publik)

 *

 * @module settings/break

 */

import { useState, useMemo } from "react";

import { Form, useLoaderData, useActionData, useNavigation } from "react-router";

import type { Route } from "./+types/route";

import { Button } from "~/components/ui/button/button";

import { Input } from "~/components/ui/input/input";

import { Label } from "~/components/ui/label/label";

import { Card, CardContent } from "~/components/ui/card/card";

import { Alert, AlertDescription } from "~/components/ui/alert/alert";

import {
  Coffee,
  Clock,
  Calendar,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  CalendarDays,
  Search,
  AlertCircle,
  Building2,
  Sparkles,
  Pencil,
  Trash2,
  Plus,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog/dialog";

import { settingsApi } from "~/services/settings.service";

import { requireRole } from "~/services/session.service";

import styles from "../style.module.css";

import type { BreakSetting, Holiday } from "~/services/settings.service";

export async function loader({ request }: Route.LoaderArgs) {
  await requireRole(request, ["Administrator"]);

  const [breakRes, holidaysRes] = await Promise.all([settingsApi.getBreakSetting(), settingsApi.getHolidays()]);

  return Response.json({
    setting: breakRes.data?.data || null,

    holidays: holidaysRes.data?.data || [],

    meta: holidaysRes.data?.meta || null,
  });
}

export async function action({ request }: Route.ActionArgs) {
  await requireRole(request, ["Administrator"]);

  const formData = await request.formData();

  const intent = formData.get("intent") as string;

  if (intent === "sync_holidays") {
    const res = await settingsApi.syncHolidays();

    if (!res.success) {
      return Response.json(
        { error: res.error || "Gagal menyinkronkan hari libur dari API Indonesia." },
        { status: 400 },
      );
    }

    return Response.json(
      {
        success: true,
        message:
          res.data?.message ||
          `Berhasil menyinkronkan ${res.data?.count ?? 0} hari libur nasional & cuti bersama dari API Indonesia.`,
      },
      { status: 200 },
    );
  }

  if (intent === "create_holiday") {
    const name = (formData.get("name") as string)?.trim();
    const mode = formData.get("dateMode") as string;
    const isRecurring = formData.get("isRecurring") === "true" || formData.get("isRecurring") === "on";

    if (!name) {
      return Response.json({ error: "Nama hari libur wajib diisi." }, { status: 400 });
    }

    let payload: any = { name, isRecurring };

    if (mode === "range") {
      const startDate = (formData.get("startDate") as string)?.trim();
      const endDate = (formData.get("endDate") as string)?.trim();
      if (!startDate || !endDate) {
        return Response.json({ error: "Tanggal mulai dan selesai wajib diisi." }, { status: 400 });
      }
      payload.startDate = startDate;
      payload.endDate = endDate;
    } else {
      const holidayDate = (formData.get("holidayDate") as string)?.trim();
      if (!holidayDate) {
        return Response.json({ error: "Tanggal libur wajib diisi." }, { status: 400 });
      }
      payload.holidayDate = holidayDate;
    }

    const isHoliday = formData.get("isHoliday") !== "false" && formData.get("isActive") !== "false";
    payload.isActive = isHoliday;
    payload.isHoliday = isHoliday;

    const res = await settingsApi.createHoliday(payload);
    if (!res.success) {
      return Response.json({ error: res.error || "Gagal menambahkan hari libur." }, { status: 400 });
    }

    return Response.json({ success: true, message: `Hari libur "${name}" berhasil ditambahkan.` }, { status: 200 });
  }

  if (intent === "update_holiday") {
    const id = formData.get("id") as string;
    const name = (formData.get("name") as string)?.trim();
    const holidayDate = (formData.get("holidayDate") as string)?.trim();
    const isRecurring = formData.get("isRecurring") === "true" || formData.get("isRecurring") === "on";

    if (!id || !name || !holidayDate) {
      return Response.json({ error: "ID, nama, dan tanggal hari libur wajib diisi." }, { status: 400 });
    }

    const isHoliday = formData.get("isHoliday") !== "false" && formData.get("isActive") !== "false";
    const res = await settingsApi.updateHoliday(id, { name, holidayDate, isRecurring, isActive: isHoliday, isHoliday });
    if (!res.success) {
      return Response.json({ error: res.error || "Gagal memperbarui hari libur." }, { status: 400 });
    }

    return Response.json({ success: true, message: `Hari libur "${name}" (${holidayDate}) berhasil diperbarui.` }, { status: 200 });
  }

  if (intent === "toggle_holiday_status") {
    const id = formData.get("id") as string;
    const currentStatus = formData.get("currentStatus") === "true";
    const newStatus = !currentStatus;
    const name = (formData.get("name") as string) || "Hari Libur";

    const res = await settingsApi.updateHoliday(id, { isActive: newStatus, isHoliday: newStatus });
    if (!res.success) {
      return Response.json({ error: res.error || "Gagal mengubah status hari libur." }, { status: 400 });
    }

    return Response.json(
      {
        success: true,
        message: `Status "${name}" berhasil diubah menjadi: ${newStatus ? "Libur (SLA Paused)" : "Bukan Libur (SLA Berjalan)"}.`,
      },
      { status: 200 },
    );
  }

  if (intent === "delete_holiday") {
    const id = formData.get("id") as string;
    if (!id) {
      return Response.json({ error: "ID hari libur tidak valid." }, { status: 400 });
    }

    const res = await settingsApi.deleteHoliday(id);
    if (!res.success) {
      return Response.json({ error: res.error || "Gagal menghapus hari libur." }, { status: 400 });
    }

    return Response.json({ success: true, message: "Hari libur berhasil dihapus dari kalender kerja sistem." }, { status: 200 });
  }

  const num = (k: string) => parseInt(formData.get(k) as string);

  const maxBreakMinutes = num("maxBreakMinutes");

  const dailyMaxMinutes = num("dailyMaxMinutes");

  const weeklyMaxMinutes = num("weeklyMaxMinutes");

  const monthlyMaxMinutes = num("monthlyMaxMinutes");

  const checks: Array<[string, number, number, number]> = [
    ["maxBreakMinutes", maxBreakMinutes, 1, 1440],

    ["dailyMaxMinutes", dailyMaxMinutes, 1, 1440],

    ["weeklyMaxMinutes", weeklyMaxMinutes, 1, 10080],

    ["monthlyMaxMinutes", monthlyMaxMinutes, 1, 43200],
  ];

  for (const [k, v, min, max] of checks) {
    if (!Number.isFinite(v) || v < min) {
      return Response.json({ error: `${k} harus angka >= ${min} (menit).` }, { status: 400 });
    }

    if (v > max) {
      return Response.json({ error: `${k} maksimal ${max} menit.` }, { status: 400 });
    }
  }

  const workStartTime = (formData.get("workStartTime") as string)?.trim() || "08:00";

  const workEndTime = (formData.get("workEndTime") as string)?.trim() || "17:00";

  const autoEndOnShiftEnd = formData.get("autoEndOnShiftEnd") === "on" || formData.get("autoEndOnShiftEnd") === "true";

  const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

  if (!timeRegex.test(workStartTime)) {
    return Response.json({ error: "Jam mulai kerja harus berformat HH:MM (contoh: 08:00)." }, { status: 400 });
  }

  if (!timeRegex.test(workEndTime)) {
    return Response.json({ error: "Jam selesai kerja harus berformat HH:MM (contoh: 17:00)." }, { status: 400 });
  }

  if (workStartTime >= workEndTime) {
    return Response.json({ error: "Jam mulai kerja harus lebih awal dari jam selesai kerja." }, { status: 400 });
  }

  const response = await settingsApi.updateBreakSetting({
    maxBreakMinutes,

    dailyMaxMinutes,

    weeklyMaxMinutes,

    monthlyMaxMinutes,

    workStartTime,

    workEndTime,

    autoEndOnShiftEnd,
  } as any);

  if (!response.success) return Response.json({ error: response.error }, { status: 400 });

  return Response.json(
    { success: true, message: "Pengaturan jam kerja, SLA & batas break berhasil disimpan." },
    { status: 200 },
  );
}

const indonesianDateFormatter = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default function BreakSettings() {
  const { setting, holidays, meta } = useLoaderData() as {
    setting: BreakSetting | null;

    holidays: Holiday[];

    meta?: {
      source: string;
      lastSyncedAt?: string | null;
      cronSchedule: string;
      totalHolidays: number;
      storageMode: string;
    } | null;
  };

  const actionData = useActionData() as { error?: string; success?: boolean; message?: string } | undefined;

  const navigation = useNavigation();

  const isSyncing = navigation.state === "submitting" && navigation.formData?.get("intent") === "sync_holidays";

  const isSaving = navigation.state === "submitting" && navigation.formData?.get("intent") === "save_settings";

  const [searchQuery, setSearchQuery] = useState("");

  const [selectedYear, setSelectedYear] = useState<string>("2026");

  const [isHolidayDialogOpen, setIsHolidayDialogOpen] = useState(false);

  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);

  const [dateMode, setDateMode] = useState<"single" | "range">("single");

  const [isHolidayStatus, setIsHolidayStatus] = useState<boolean>(true);

  const handleOpenCreate = () => {
    setEditingHoliday(null);
    setDateMode("single");
    setIsHolidayStatus(true);
    setIsHolidayDialogOpen(true);
  };

  const handleOpenEdit = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    setDateMode("single");
    setIsHolidayStatus(holiday.isActive !== false && holiday.isHoliday !== false);
    setIsHolidayDialogOpen(true);
  };

  // Extract available years from holidays

  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>();

    holidays.forEach((h) => {
      if (h.holidayDate) {
        const yr = h.holidayDate.substring(0, 4);

        if (yr) yearsSet.add(yr);
      }
    });

    const arr = Array.from(yearsSet).sort();

    return arr.length > 0 ? arr : ["2025", "2026", "2027"];
  }, [holidays]);

  // Filter holidays

  const filteredHolidays = useMemo(() => {
    return holidays.filter((h) => {
      const matchesYear = selectedYear === "ALL" || (h.holidayDate && h.holidayDate.startsWith(selectedYear));

      const matchesSearch =
        !searchQuery ||
        (h.name && h.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (h.holidayDate && h.holidayDate.includes(searchQuery));

      return matchesYear && matchesSearch;
    });
  }, [holidays, selectedYear, searchQuery]);

  // Helper formatting date to Indonesian

  const formatIndonesianDate = (dateStr: string) => {
    try {
      const parts = dateStr.split("-");

      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));

        return indonesianDateFormatter.format(d);
      }
    } catch (e) {
      // fallback
    }

    return dateStr;
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <div className={styles.actionHeader}>
          <div>
            <h1 className={styles.pageTitle}>Jam Kerja, Batas Break & SLA</h1>

            <p className={styles.pageDescription}>
              Pengaturan operasional jam kerja kantor (Senin–Jumat), batas istirahat staff, aturan pause otomatis SLA
              tiket, dan sinkronisasi hari libur nasional Indonesia via API.
            </p>
          </div>
        </div>
      </div>

      {actionData?.error && (
        <Alert variant="destructive" style={{ marginBottom: 16 }}>
          <AlertCircle className="h-4 w-4" style={{ marginRight: 8 }} />

          <AlertDescription>{actionData.error}</AlertDescription>
        </Alert>
      )}

      {actionData?.success && (
        <Alert
          style={{
            marginBottom: 16,
            background: "rgba(16, 185, 129, 0.1)",
            borderColor: "rgba(16, 185, 129, 0.3)",
            color: "#34d399",
          }}
        >
          <CheckCircle2 className="h-4 w-4" style={{ marginRight: 8, color: "#34d399" }} />

          <AlertDescription>{actionData.message || "Perubahan berhasil disimpan."}</AlertDescription>
        </Alert>
      )}

      {/* SECTION 1 & 2: FORM PENGATURAN JAM KERJA, OTOMATISASI SLA & BATAS BREAK */}

      <Card className={styles.mainCard} style={{ marginBottom: 24 }}>
        <CardContent>
          <Form
            method="post"
            key={`${setting?.maxBreakMinutes ?? 60}-${setting?.dailyMaxMinutes ?? 60}-${setting?.weeklyMaxMinutes ?? 300}-${setting?.monthlyMaxMinutes ?? 1200}-${setting?.workStartTime ?? "08:00"}-${setting?.workEndTime ?? "17:00"}-${setting?.autoEndOnShiftEnd ?? true}`}
          >
            <input type="hidden" name="intent" value="save_settings" />

            {/* SUB-SECTION: JAM KERJA & ATURAN COUNTDOWN SLA */}

            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "rgba(59, 130, 246, 0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#60a5fa",
                    }}
                  >
                    <Clock size={18} />
                  </div>

                  <div>
                    <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#f8fafc", margin: 0 }}>
                      Jam Kerja Operasional & Aturan SLA
                    </h3>

                    <span style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
                      Hari kerja operasional: <strong style={{ color: "#60a5fa" }}>Senin – Jumat</strong> (Sabtu &
                      Minggu Libur)
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: 20,
                    background: "rgba(59, 130, 246, 0.1)",
                    border: "1px solid rgba(59, 130, 246, 0.25)",
                    fontSize: "0.78rem",
                    color: "#93c5fd",
                    fontWeight: 600,
                  }}
                >
                  <Building2 size={13} />

                  <span>Kantor: Senin – Jumat</span>
                </div>
              </div>
            </div>

            <div className={styles.breakGrid}>
              <div className={styles.breakMetricCard}>
                <div className={styles.breakMetricHeader}>
                  <Label htmlFor="workStartTime" className={styles.breakMetricLabel}>
                    Jam Mulai Kerja
                  </Label>
                </div>

                <div className={styles.breakInputWrap}>
                  <Input
                    id="workStartTime"
                    name="workStartTime"
                    type="time"
                    defaultValue={setting?.workStartTime ?? "08:00"}
                    required
                  />

                  <span className={styles.breakUnitTag}>WIB</span>
                </div>

                <span className={styles.breakMetricSubtext}>Awal jam operasional kantor & SLA aktif</span>
              </div>

              <div className={styles.breakMetricCard}>
                <div className={styles.breakMetricHeader}>
                  <Label htmlFor="workEndTime" className={styles.breakMetricLabel}>
                    Jam Selesai Kerja
                  </Label>
                </div>

                <div className={styles.breakInputWrap}>
                  <Input
                    id="workEndTime"
                    name="workEndTime"
                    type="time"
                    defaultValue={setting?.workEndTime ?? "17:00"}
                    required
                  />

                  <span className={styles.breakUnitTag}>WIB</span>
                </div>

                <span className={styles.breakMetricSubtext}>
                  Akhir jam kantor (SLA otomatis Pause & Break Auto-End)
                </span>
              </div>
            </div>

            {/* HIGHLIGHT ATURAN COUNTDOWN & PAUSE SLA */}

            <div
              style={{
                marginTop: 16,

                marginBottom: 16,

                padding: "14px 16px",

                background: "linear-gradient(135deg, rgba(30, 58, 138, 0.2) 0%, rgba(15, 23, 42, 0.5) 100%)",

                border: "1px solid rgba(59, 130, 246, 0.3)",

                borderRadius: "14px",

                display: "flex",

                gap: "14px",

                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  width: 36,

                  height: 36,

                  borderRadius: 10,

                  background: "rgba(59, 130, 246, 0.2)",

                  display: "flex",

                  alignItems: "center",

                  justifyContent: "center",

                  color: "#93c5fd",

                  flexShrink: 0,

                  marginTop: 2,
                }}
              >
                <ShieldCheck size={20} />
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <h4 style={{ fontSize: "0.92rem", fontWeight: 700, color: "#f1f5f9", margin: 0 }}>
                    Fitur Countdown SLA Otomatis & Aturan Pause
                  </h4>

                  <span
                    style={{
                      fontSize: "0.7rem",
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: "rgba(16, 185, 129, 0.2)",
                      color: "#34d399",
                      fontWeight: 600,
                    }}
                  >
                    Aktif Otomatis
                  </span>
                </div>

                <p style={{ fontSize: "0.82rem", color: "#cbd5e1", lineHeight: 1.5, margin: "0 0 6px 0" }}>
                  Countdown waktu SLA tiket dihitung murni pada hari kerja (<strong>Senin – Jumat</strong>) di rentang
                  jam operasional (
                  <strong>
                    {setting?.workStartTime ?? "08:00"} – {setting?.workEndTime ?? "17:00"} WIB
                  </strong>
                  ).
                </p>

                <ul style={{ fontSize: "0.8rem", color: "#94a3b8", margin: 0, paddingLeft: 18, lineHeight: 1.5 }}>
                  <li>
                    Di luar jam kerja (sebelum {setting?.workStartTime ?? "08:00"} & sesudah{" "}
                    {setting?.workEndTime ?? "17:00"} WIB), countdown SLA tiket otomatis{" "}
                    <strong style={{ color: "#fbbf24" }}>Paused (Jeda)</strong>.
                  </li>

                  <li>
                    Pada akhir pekan (Sabtu & Minggu) serta pada seluruh{" "}
                    <strong>Hari Libur Nasional & Cuti Bersama</strong> dari API, countdown SLA otomatis{" "}
                    <strong style={{ color: "#fbbf24" }}>Paused (Jeda)</strong> dan tidak memotong kuota SLA.
                  </li>
                </ul>
              </div>
            </div>

            {/* CHECKBOX AUTO-END BREAK */}

            <div
              style={{
                marginTop: 12,

                padding: "12px 14px",

                background: "rgba(255, 255, 255, 0.03)",

                border: "1px solid rgba(255, 255, 255, 0.08)",

                borderRadius: "12px",

                display: "flex",

                alignItems: "flex-start",

                gap: "12px",

                cursor: "pointer",
              }}
            >
              <input
                id="autoEndOnShiftEnd"
                name="autoEndOnShiftEnd"
                type="checkbox"
                defaultChecked={setting?.autoEndOnShiftEnd !== false}
                style={{ width: "18px", height: "18px", marginTop: "2px", accentColor: "#3b82f6", cursor: "pointer" }}
              />

              <Label
                htmlFor="autoEndOnShiftEnd"
                style={{ cursor: "pointer", display: "flex", flexDirection: "column", gap: "4px" }}
              >
                <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "#f1f5f9" }}>
                  Otomatis Nonaktifkan Break Saat Lewat Jam Kerja
                </span>

                <span style={{ fontSize: "0.8rem", color: "#94a3b8", lineHeight: 1.4 }}>
                  Jika staf lupa mengakhiri sesi break saat pulang kantor, sistem secara otomatis mengakhiri break dan
                  memotong durasi maksimal tepat pada jam selesai kerja ({setting?.workEndTime ?? "17:00"} WIB) agar
                  tidak terus berjalan semalaman.
                </span>
              </Label>
            </div>

            {/* SUB-SECTION: BATAS WAKTU BREAK STAFF */}

            <div style={{ marginTop: 28, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: "rgba(245, 158, 11, 0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fbbf24",
                  }}
                >
                  <Coffee size={18} />
                </div>

                <div>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#f8fafc", margin: 0 }}>
                    Batas Waktu Break Staff (IT Support)
                  </h3>

                  <span style={{ fontSize: "0.82rem", color: "#94a3b8" }}>
                    Batas durasi istirahat staff untuk notifikasi overtime dan pemantauan kinerja. Total harian reset
                    otomatis tiap 00:00 WIB.
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.breakGrid}>
              <div className={styles.breakMetricCard}>
                <div className={styles.breakMetricHeader}>
                  <Label htmlFor="maxBreakMinutes" className={styles.breakMetricLabel}>
                    Maks. Sesi
                  </Label>
                </div>

                <div className={styles.breakInputWrap}>
                  <Input
                    id="maxBreakMinutes"
                    name="maxBreakMinutes"
                    type="number"
                    min={1}
                    max={1440}
                    defaultValue={setting?.maxBreakMinutes ?? 60}
                    required
                  />

                  <span className={styles.breakUnitTag}>mnt</span>
                </div>

                <span className={styles.breakMetricSubtext}>Batas 1x break staff</span>
              </div>

              <div className={styles.breakMetricCard}>
                <div className={styles.breakMetricHeader}>
                  <Label htmlFor="dailyMaxMinutes" className={styles.breakMetricLabel}>
                    Batas Harian
                  </Label>
                </div>

                <div className={styles.breakInputWrap}>
                  <Input
                    id="dailyMaxMinutes"
                    name="dailyMaxMinutes"
                    type="number"
                    min={1}
                    max={1440}
                    defaultValue={setting?.dailyMaxMinutes ?? 60}
                    required
                  />

                  <span className={styles.breakUnitTag}>mnt</span>
                </div>

                <span className={styles.breakMetricSubtext}>Periode 1 hari (WIB)</span>
              </div>

              <div className={styles.breakMetricCard}>
                <div className={styles.breakMetricHeader}>
                  <Label htmlFor="weeklyMaxMinutes" className={styles.breakMetricLabel}>
                    Batas Mingguan
                  </Label>
                </div>

                <div className={styles.breakInputWrap}>
                  <Input
                    id="weeklyMaxMinutes"
                    name="weeklyMaxMinutes"
                    type="number"
                    min={1}
                    max={10080}
                    defaultValue={setting?.weeklyMaxMinutes ?? 300}
                    required
                  />

                  <span className={styles.breakUnitTag}>mnt</span>
                </div>

                <span className={styles.breakMetricSubtext}>Senin – Minggu</span>
              </div>

              <div className={styles.breakMetricCard}>
                <div className={styles.breakMetricHeader}>
                  <Label htmlFor="monthlyMaxMinutes" className={styles.breakMetricLabel}>
                    Batas Bulanan
                  </Label>
                </div>

                <div className={styles.breakInputWrap}>
                  <Input
                    id="monthlyMaxMinutes"
                    name="monthlyMaxMinutes"
                    type="number"
                    min={1}
                    max={43200}
                    defaultValue={setting?.monthlyMaxMinutes ?? 1200}
                    required
                  />

                  <span className={styles.breakUnitTag}>mnt</span>
                </div>

                <span className={styles.breakMetricSubtext}>Tgl 1 – akhir bulan</span>
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <Button type="submit" size="lg" disabled={isSaving} className={styles.breakFooterBtn}>
                <Coffee size={16} style={{ marginRight: 8 }} />

                {isSaving ? "Menyimpan..." : "Simpan Pengaturan Jam Kerja & Break"}
              </Button>
            </div>
          </Form>
        </CardContent>
      </Card>

      {/* SECTION 3: HARI LIBUR NASIONAL INDONESIA (OTOMATIS VIA API) */}

      <Card className={styles.mainCard}>
        <CardContent>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 16,
              marginBottom: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: "rgba(239, 68, 68, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#f87171",
                  flexShrink: 0,
                }}
              >
                <CalendarDays size={20} />
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "#f8fafc", margin: 0 }}>
                    Hari Libur Nasional & Cuti Bersama Indonesia
                  </h2>

                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "2px 8px",
                      borderRadius: 20,
                      background: "rgba(16, 185, 129, 0.15)",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                      color: "#34d399",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                    }}
                  >
                    <Sparkles size={11} /> API Otomatis
                  </span>
                </div>

                <p style={{ fontSize: "0.85rem", color: "#94a3b8", margin: "4px 0 0 0", maxWidth: 650 }}>
                  Data hari libur ditarik otomatis via API Kalender Resmi Indonesia (Titimangsa & Kalender Nasional).
                  Tidak perlu input manual satu per satu — seluruh tanggal ini otomatis mengecualikan dan men-jeda
                  (pause) countdown SLA tiket.
                </p>
              </div>
            </div>

            {/* TOMBOL AKSI HARI LIBUR: TAMBAH MANUAL & SINKRONISASI API */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <Button
                type="button"
                onClick={handleOpenCreate}
                style={{
                  background: "rgba(16, 185, 129, 0.15)",
                  border: "1px solid rgba(16, 185, 129, 0.35)",
                  color: "#34d399",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  height: 40,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Plus size={15} />
                Tambah Hari Libur
              </Button>

              <Form method="post">
                <input type="hidden" name="intent" value="sync_holidays" />

                <Button
                  type="submit"
                  variant="outline"
                  disabled={isSyncing}
                  style={{
                    borderColor: "rgba(59, 130, 246, 0.4)",
                    background: "rgba(59, 130, 246, 0.1)",
                    color: "#93c5fd",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    height: 40,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <RefreshCw size={15} className={isSyncing ? "animate-spin" : ""} />
                  {isSyncing ? "Menyinkronkan API..." : "Sinkronkan dari API Hari Libur"}
                </Button>
              </Form>
            </div>
          </div>

          {/* CRON JOB & LOCAL STORAGE BANNER */}
          <div
            style={{
              marginBottom: 18,
              padding: "14px 16px",
              background: "linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.4) 100%)",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              borderRadius: 14,
              display: "flex",
              alignItems: "flex-start",
              gap: 14,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "rgba(16, 185, 129, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#34d399",
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              <CheckCircle2 size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                <h4 style={{ fontSize: "0.92rem", fontWeight: 700, color: "#f1f5f9", margin: 0 }}>
                  Penyimpanan Server Lokal & Cron Job Akhir Tahun (31 Desember)
                </h4>
                <span
                  style={{
                    fontSize: "0.7rem",
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: "rgba(59, 130, 246, 0.2)",
                    color: "#60a5fa",
                    fontWeight: 600,
                  }}
                >
                  Hemat Panggilan API (1x / Tahun)
                </span>
              </div>
              <p style={{ fontSize: "0.82rem", color: "#cbd5e1", lineHeight: 1.5, margin: "0 0 8px 0" }}>
                Seluruh data libur disimpan langsung ke server project (
                <strong>backend/app/data/holidays_indonesia.json</strong>) dan database. Sistem tidak memanggil API
                eksternal setiap saat, melainkan hanya dijadwalkan secara otomatis melalui{" "}
                <strong>Cron Job tahunan setiap 31 Desember pukul 23:59 WIB</strong> untuk menarik kalender tahun
                berikutnya.
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                  fontSize: "0.75rem",
                  color: "#94a3b8",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    background: "rgba(255, 255, 255, 0.05)",
                    padding: "2px 8px",
                    borderRadius: 6,
                  }}
                >
                  <Clock size={12} style={{ color: "#fbbf24" }} /> Jadwal Cron: <strong>31 Desember (Tahunan)</strong>
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    background: "rgba(255, 255, 255, 0.05)",
                    padding: "2px 8px",
                    borderRadius: 6,
                  }}
                >
                  <Building2 size={12} style={{ color: "#60a5fa" }} /> Sumber:{" "}
                  <strong>api.co.id (Resmi Indonesia)</strong>
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    background: "rgba(255, 255, 255, 0.05)",
                    padding: "2px 8px",
                    borderRadius: 6,
                  }}
                >
                  <ShieldCheck size={12} style={{ color: "#34d399" }} /> Mode: <strong>Local Project File & DB</strong>
                </span>
              </div>
            </div>
          </div>

          {/* STATS & FILTER BAR */}

          <div
            style={{
              display: "flex",

              alignItems: "center",

              justifyContent: "space-between",

              flexWrap: "wrap",

              gap: 12,

              padding: "12px 14px",

              background: "rgba(255, 255, 255, 0.02)",

              border: "1px solid rgba(255, 255, 255, 0.06)",

              borderRadius: 12,

              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.8rem", color: "#94a3b8", fontWeight: 600 }}>Tahun:</span>

              {availableYears.map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setSelectedYear(yr)}
                  style={{
                    padding: "4px 10px",

                    fontSize: "0.78rem",

                    fontWeight: 600,

                    borderRadius: 8,

                    border: "1px solid",

                    borderColor: selectedYear === yr ? "#3b82f6" : "rgba(255, 255, 255, 0.1)",

                    background: selectedYear === yr ? "rgba(59, 130, 246, 0.25)" : "rgba(255, 255, 255, 0.03)",

                    color: selectedYear === yr ? "#ffffff" : "#94a3b8",

                    cursor: "pointer",

                    transition: "all 0.15s ease",
                  }}
                >
                  {yr}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setSelectedYear("ALL")}
                style={{
                  padding: "4px 10px",

                  fontSize: "0.78rem",

                  fontWeight: 600,

                  borderRadius: 8,

                  border: "1px solid",

                  borderColor: selectedYear === "ALL" ? "#3b82f6" : "rgba(255, 255, 255, 0.1)",

                  background: selectedYear === "ALL" ? "rgba(59, 130, 246, 0.25)" : "rgba(255, 255, 255, 0.03)",

                  color: selectedYear === "ALL" ? "#ffffff" : "#94a3b8",

                  cursor: "pointer",

                  transition: "all 0.15s ease",
                }}
              >
                Semua
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, maxWidth: 300, minWidth: 200 }}>
              <div style={{ position: "relative", width: "100%" }}>
                <Search
                  size={14}
                  style={{
                    position: "absolute",
                    left: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#64748b",
                  }}
                />

                <Input
                  type="text"
                  placeholder="Cari nama hari libur..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: 32, height: 34, fontSize: "0.8rem" }}
                />
              </div>
            </div>
          </div>

          {/* TABLE / LIST OF HOLIDAYS */}

          {filteredHolidays.length === 0 ? (
            <div style={{ textAlign: "center", padding: "36px 16px", color: "#94a3b8" }}>
              <Calendar size={36} style={{ margin: "0 auto 10px", opacity: 0.4 }} />

              <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600 }}>Tidak ada data hari libur yang cocok.</p>

              <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "#64748b" }}>
                Klik tombol "Sinkronkan dari API Hari Libur" di atas untuk memperbarui data kalender Indonesia.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" }}>
                <thead>
                  <tr
                    style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)", textAlign: "left", color: "#94a3b8" }}
                  >
                    <th style={{ padding: "10px 14px", fontWeight: 600 }}>Tanggal</th>

                    <th style={{ padding: "10px 14px", fontWeight: 600 }}>Hari & Kalender</th>

                    <th style={{ padding: "10px 14px", fontWeight: 600 }}>Keterangan Hari Libur</th>

                    <th style={{ padding: "10px 14px", fontWeight: 600, textAlign: "center" }}>Tipe</th>

                    <th style={{ padding: "10px 14px", fontWeight: 600, textAlign: "center" }}>Pengaruh SLA</th>

                    <th style={{ padding: "10px 14px", fontWeight: 600, textAlign: "right" }}>Aksi</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredHolidays.map((h, idx) => {
                    const isCuti = h.name.toLowerCase().includes("cuti bersama");

                    return (
                      <tr
                        key={h.id || idx}
                        style={{
                          borderBottom: "1px solid rgba(255, 255, 255, 0.05)",

                          background: idx % 2 === 0 ? "transparent" : "rgba(255, 255, 255, 0.015)",
                        }}
                      >
                        <td
                          style={{ padding: "10px 14px", color: "#f8fafc", fontWeight: 600, fontFamily: "monospace" }}
                        >
                          {h.holidayDate}
                        </td>

                        <td style={{ padding: "10px 14px", color: "#cbd5e1" }}>
                          {formatIndonesianDate(h.holidayDate)}
                        </td>

                        <td style={{ padding: "10px 14px", color: "#f1f5f9", fontWeight: 500 }}>{h.name}</td>

                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          {isCuti ? (
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 8px",
                                borderRadius: 6,
                                background: "rgba(245, 158, 11, 0.15)",
                                color: "#fbbf24",
                                fontSize: "0.72rem",
                                fontWeight: 600,
                              }}
                            >
                              Cuti Bersama
                            </span>
                          ) : h.isActive === false || h.isHoliday === false ? (
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 8px",
                                borderRadius: 6,
                                background: "rgba(148, 163, 184, 0.15)",
                                color: "#94a3b8",
                                fontSize: "0.72rem",
                                fontWeight: 600,
                              }}
                            >
                              Hari Nasional
                            </span>
                          ) : (
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 8px",
                                borderRadius: 6,
                                background: "rgba(239, 68, 68, 0.15)",
                                color: "#f87171",
                                fontSize: "0.72rem",
                                fontWeight: 600,
                              }}
                            >
                              Libur Nasional
                            </span>
                          )}
                        </td>

                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          <Form method="post" style={{ display: "inline-block" }}>
                            <input type="hidden" name="intent" value="toggle_holiday_status" />
                            <input type="hidden" name="id" value={h.id} />
                            <input type="hidden" name="name" value={h.name} />
                            <input
                              type="hidden"
                              name="currentStatus"
                              value={String(h.isActive !== false && h.isHoliday !== false)}
                            />
                            <button
                              type="submit"
                              title="Klik untuk mengubah status: Libur (SLA Paused) atau Bukan Libur (SLA Berjalan)"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "4px 10px",
                                borderRadius: 8,
                                fontSize: "0.74rem",
                                fontWeight: 600,
                                cursor: "pointer",
                                border: "1px solid",
                                transition: "all 0.15s ease",
                                ...(h.isActive !== false && h.isHoliday !== false
                                  ? {
                                      background: "rgba(16, 185, 129, 0.15)",
                                      borderColor: "rgba(16, 185, 129, 0.35)",
                                      color: "#34d399",
                                    }
                                  : {
                                      background: "rgba(245, 158, 11, 0.12)",
                                      borderColor: "rgba(245, 158, 11, 0.3)",
                                      color: "#fbbf24",
                                    }),
                              }}
                            >
                              {h.isActive !== false && h.isHoliday !== false ? (
                                <>
                                  <ShieldCheck size={13} />
                                  <span>Libur (SLA Paused)</span>
                                </>
                              ) : (
                                <>
                                  <Clock size={13} />
                                  <span>Bukan Libur (SLA Berjalan)</span>
                                </>
                              )}
                            </button>
                          </Form>
                        </td>

                        <td style={{ padding: "10px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(h)}
                              title="Edit tanggal & keterangan hari libur"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: 28,
                                height: 28,
                                borderRadius: 6,
                                border: "1px solid rgba(255, 255, 255, 0.1)",
                                background: "rgba(255, 255, 255, 0.04)",
                                color: "#cbd5e1",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgba(59, 130, 246, 0.2)";
                                e.currentTarget.style.color = "#60a5fa";
                                e.currentTarget.style.borderColor = "rgba(59, 130, 246, 0.4)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
                                e.currentTarget.style.color = "#cbd5e1";
                                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                              }}
                            >
                              <Pencil size={13} />
                            </button>

                            <Form
                              method="post"
                              onSubmit={(e) => {
                                if (
                                  !confirm(
                                    `Hapus hari libur "${h.name}" (${h.holidayDate})? Tanggal ini tidak akan lagi men-jeda SLA tiket.`
                                  )
                                ) {
                                  e.preventDefault();
                                }
                              }}
                              style={{ display: "inline" }}
                            >
                              <input type="hidden" name="intent" value="delete_holiday" />
                              <input type="hidden" name="id" value={h.id} />
                              <button
                                type="submit"
                                title="Hapus hari libur ini (misal bukan libur cuti bersama)"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  width: 28,
                                  height: 28,
                                  borderRadius: 6,
                                  border: "1px solid rgba(239, 68, 68, 0.25)",
                                  background: "rgba(239, 68, 68, 0.1)",
                                  color: "#f87171",
                                  cursor: "pointer",
                                  transition: "all 0.15s ease",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = "rgba(239, 68, 68, 0.25)";
                                  e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.5)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                                  e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.25)";
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </Form>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div
                style={{
                  padding: "12px 14px",
                  fontSize: "0.78rem",
                  color: "#64748b",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>
                  Menampilkan {filteredHolidays.length} hari libur (
                  {selectedYear === "ALL" ? "Semua Tahun" : `Tahun ${selectedYear}`})
                </span>

                <span>Total terdaftar di sistem: {holidays.length} tanggal libur</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DIALOG MODAL: TAMBAH & EDIT HARI LIBUR / CUTI BERSAMA */}
      <Dialog open={isHolidayDialogOpen} onOpenChange={setIsHolidayDialogOpen}>
        <DialogContent style={{ maxWidth: 500 }}>
          <DialogHeader>
            <DialogTitle>
              {editingHoliday ? "Edit Hari Libur" : "Tambah Hari Libur / Cuti Bersama"}
            </DialogTitle>
          </DialogHeader>

          <Form method="post" onSubmit={() => setIsHolidayDialogOpen(false)}>
            <input
              type="hidden"
              name="intent"
              value={editingHoliday ? "update_holiday" : "create_holiday"}
            />
            {editingHoliday && <input type="hidden" name="id" value={editingHoliday.id} />}
            <input type="hidden" name="dateMode" value={dateMode} />

            <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "16px 0" }}>
              {!editingHoliday && (
                <div>
                  <Label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#f1f5f9", marginBottom: 8, display: "block" }}>
                    Mode Input Tanggal
                  </Label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setDateMode("single")}
                      style={{
                        flex: 1,
                        padding: "7px 12px",
                        borderRadius: 8,
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        border: "1px solid",
                        borderColor: dateMode === "single" ? "#3b82f6" : "rgba(255, 255, 255, 0.1)",
                        background: dateMode === "single" ? "rgba(59, 130, 246, 0.25)" : "rgba(255, 255, 255, 0.04)",
                        color: dateMode === "single" ? "#ffffff" : "#94a3b8",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      1 Hari Tunggal
                    </button>
                    <button
                      type="button"
                      onClick={() => setDateMode("range")}
                      style={{
                        flex: 1,
                        padding: "7px 12px",
                        borderRadius: 8,
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        border: "1px solid",
                        borderColor: dateMode === "range" ? "#3b82f6" : "rgba(255, 255, 255, 0.1)",
                        background: dateMode === "range" ? "rgba(59, 130, 246, 0.25)" : "rgba(255, 255, 255, 0.04)",
                        color: dateMode === "range" ? "#ffffff" : "#94a3b8",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      Rentang Tanggal (Cuti Bersama)
                    </button>
                  </div>
                </div>
              )}

              {editingHoliday || dateMode === "single" ? (
                <div>
                  <Label
                    htmlFor="holidayDate"
                    style={{ fontSize: "0.85rem", fontWeight: 600, color: "#f1f5f9", marginBottom: 6, display: "block" }}
                  >
                    Tanggal Hari Libur
                  </Label>
                  <Input
                    id="holidayDate"
                    name="holidayDate"
                    type="date"
                    defaultValue={editingHoliday?.holidayDate || ""}
                    required
                  />
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 4, display: "block" }}>
                    Pada tanggal ini countdown SLA tiket otomatis dijeda (paused).
                  </span>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <Label
                      htmlFor="startDate"
                      style={{ fontSize: "0.85rem", fontWeight: 600, color: "#f1f5f9", marginBottom: 6, display: "block" }}
                    >
                      Tanggal Mulai
                    </Label>
                    <Input id="startDate" name="startDate" type="date" required />
                  </div>
                  <div>
                    <Label
                      htmlFor="endDate"
                      style={{ fontSize: "0.85rem", fontWeight: 600, color: "#f1f5f9", marginBottom: 6, display: "block" }}
                    >
                      Tanggal Selesai
                    </Label>
                    <Input id="endDate" name="endDate" type="date" required />
                  </div>
                </div>
              )}

              <div>
                <Label
                  htmlFor="name"
                  style={{ fontSize: "0.85rem", fontWeight: 600, color: "#f1f5f9", marginBottom: 6, display: "block" }}
                >
                  Keterangan / Nama Hari Libur
                </Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Contoh: Cuti Bersama Idul Fitri"
                  defaultValue={editingHoliday?.name || ""}
                  required
                />
              </div>

              {/* OPSI LIBUR ATAU TIDAK (PENGARUH KE COUNTDOWN SLA) */}
              <div>
                <Label style={{ fontSize: "0.85rem", fontWeight: 600, color: "#f1f5f9", marginBottom: 8, display: "block" }}>
                  Status Hari Libur Kantor & Pengaruh SLA
                </Label>
                <input type="hidden" name="isHoliday" value={String(isHolidayStatus)} />
                <input type="hidden" name="isActive" value={String(isHolidayStatus)} />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setIsHolidayStatus(true)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      textAlign: "left",
                      cursor: "pointer",
                      border: "1px solid",
                      transition: "all 0.15s ease",
                      ...(isHolidayStatus
                        ? {
                            background: "rgba(16, 185, 129, 0.15)",
                            borderColor: "#10b981",
                            color: "#ffffff",
                          }
                        : {
                            background: "rgba(255, 255, 255, 0.03)",
                            borderColor: "rgba(255, 255, 255, 0.08)",
                            color: "#94a3b8",
                          }),
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: "0.84rem", color: isHolidayStatus ? "#34d399" : "#cbd5e1" }}>
                      <ShieldCheck size={16} />
                      <span>Libur / Cuti Bersama</span>
                    </div>
                    <div style={{ fontSize: "0.72rem", marginTop: 4, lineHeight: 1.35, color: isHolidayStatus ? "#cbd5e1" : "#64748b" }}>
                      Kantor libur, countdown SLA tiket otomatis dijeda (paused).
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsHolidayStatus(false)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      textAlign: "left",
                      cursor: "pointer",
                      border: "1px solid",
                      transition: "all 0.15s ease",
                      ...(!isHolidayStatus
                        ? {
                            background: "rgba(245, 158, 11, 0.15)",
                            borderColor: "#f59e0b",
                            color: "#ffffff",
                          }
                        : {
                            background: "rgba(255, 255, 255, 0.03)",
                            borderColor: "rgba(255, 255, 255, 0.08)",
                            color: "#94a3b8",
                          }),
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: "0.84rem", color: !isHolidayStatus ? "#fbbf24" : "#cbd5e1" }}>
                      <Clock size={16} />
                      <span>Bukan Libur (Masuk Kerja)</span>
                    </div>
                    <div style={{ fontSize: "0.72rem", marginTop: 4, lineHeight: 1.35, color: !isHolidayStatus ? "#cbd5e1" : "#64748b" }}>
                      Kantor tetap buka & SLA berjalan normal (contoh: Hari Pahlawan / Cuti opsional).
                    </div>
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                <input
                  id="isRecurring"
                  name="isRecurring"
                  type="checkbox"
                  value="true"
                  defaultChecked={editingHoliday?.isRecurring || false}
                  style={{ width: 16, height: 16, accentColor: "#3b82f6", cursor: "pointer" }}
                />
                <Label htmlFor="isRecurring" style={{ cursor: "pointer", fontSize: "0.85rem", color: "#cbd5e1" }}>
                  Ulangi otomatis tiap tahun (Recurring Holiday)
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsHolidayDialogOpen(false)}
              >
                Batal
              </Button>
              <Button type="submit">
                {editingHoliday ? "Simpan Perubahan" : "Tambah Hari Libur"}
              </Button>
            </DialogFooter>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
