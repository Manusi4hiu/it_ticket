/**
 * route.tsx — Public Holidays Settings
 *
 * Halaman pengelolaan Master Data Hari Libur Nasional & Cuti Bersama.
 * Digunakan untuk perhitungan Business Hours SLA dan pengecualian kalender kerja.
 *
 * @module settings/holidays
 */

import { useState } from "react";
import { Form, useLoaderData, useActionData } from "react-router";
import type { Route } from "./+types/route";
import { Button } from "~/components/ui/button/button";
import { Input } from "~/components/ui/input/input";
import { Label } from "~/components/ui/label/label";
import { Card, CardContent } from "~/components/ui/card/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "~/components/ui/dialog/dialog";
import { Alert, AlertDescription } from "~/components/ui/alert/alert";
import { Plus, Pencil, Trash2, Calendar, Repeat, CalendarDays } from "lucide-react";
import { settingsApi } from "~/services/settings.service";
import { requireRole } from "~/services/session.service";
import styles from "../style.module.css";
import type { Holiday } from "~/services/settings.service";

export async function loader({ request }: Route.LoaderArgs) {
    await requireRole(request, ["Administrator"]);
    const response = await settingsApi.getHolidays();
    return Response.json({ holidays: response.data?.data || [] });
}

export async function action({ request }: Route.ActionArgs) {
    await requireRole(request, ["Administrator"]);
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "create") {
        const name = (formData.get("name") as string || "").trim();
        const dateMode = (formData.get("dateMode") as string || "single");
        const holidayDate = (formData.get("holidayDate") as string || "").trim();
        const startDate = (formData.get("startDate") as string || "").trim();
        const endDate = (formData.get("endDate") as string || "").trim();
        const isRecurring = formData.get("isRecurring") === "true";

        if (!name) {
            return Response.json({ error: "Nama hari libur wajib diisi." }, { status: 400 });
        }

        if (dateMode === "range") {
            if (!startDate || !endDate) {
                return Response.json({ error: "Tanggal mulai dan tanggal selesai wajib diisi." }, { status: 400 });
            }
            if (endDate < startDate) {
                return Response.json({ error: "Tanggal selesai tidak boleh lebih awal dari tanggal mulai." }, { status: 400 });
            }
            const response = await settingsApi.createHoliday({ name, startDate, endDate, isRecurring });
            if (!response.success) {
                return Response.json({ error: response.error || "Gagal menambahkan rentang hari libur" }, { status: 400 });
            }
            return Response.json({ success: true }, { status: 200 });
        } else {
            if (!holidayDate) {
                return Response.json({ error: "Tanggal libur wajib dipilih." }, { status: 400 });
            }

            const response = await settingsApi.createHoliday({ name, holidayDate, isRecurring });
            if (!response.success) {
                return Response.json({ error: response.error || "Gagal menambahkan hari libur" }, { status: 400 });
            }
            return Response.json({ success: true }, { status: 200 });
        }
    }

    if (intent === "update") {
        const id = formData.get("id") as string;
        const name = (formData.get("name") as string || "").trim();
        const holidayDate = (formData.get("holidayDate") as string || "").trim();
        const isRecurring = formData.get("isRecurring") === "true";

        if (!id || !name || !holidayDate) {
            return Response.json({ error: "ID, Nama, dan Tanggal wajib diisi." }, { status: 400 });
        }

        const response = await settingsApi.updateHoliday(id, { name, holidayDate, isRecurring });
        if (!response.success) {
            return Response.json({ error: response.error || "Gagal mengubah hari libur" }, { status: 400 });
        }
        return Response.json({ success: true }, { status: 200 });
    }

    if (intent === "delete") {
        const id = formData.get("id") as string;
        if (!id) {
            return Response.json({ error: "ID hari libur tidak valid." }, { status: 400 });
        }
        const response = await settingsApi.deleteHoliday(id);
        if (!response.success) {
            return Response.json({ error: response.error || "Gagal menghapus hari libur" }, { status: 400 });
        }
        return Response.json({ success: true }, { status: 200 });
    }

    return null;
}

function formatHolidayDate(dateStr: string): string {
    if (!dateStr) return "-";
    try {
        const [year, month, day] = dateStr.split("-").map(Number);
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString("id-ID", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        });
    } catch {
        return dateStr;
    }
}

export default function HolidaysSettings() {
    const { holidays } = useLoaderData() as { holidays: Holiday[] };
    const actionData = useActionData() as { error?: string; success?: boolean } | undefined;
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
    const [dateMode, setDateMode] = useState<"single" | "range">("single");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const openCreateDialog = () => {
        setEditingHoliday(null);
        setDateMode("single");
        setStartDate("");
        setEndDate("");
        setIsDialogOpen(true);
    };

    const openEditDialog = (holiday: Holiday) => {
        setEditingHoliday(holiday);
        setDateMode("single");
        setStartDate("");
        setEndDate("");
        setIsDialogOpen(true);
    };

    const rangeDaysCount = (() => {
        if (!startDate || !endDate) return 0;
        try {
            const [sy, sm, sd] = startDate.split("-").map(Number);
            const [ey, em, ed] = endDate.split("-").map(Number);
            const start = new Date(sy, sm - 1, sd);
            const end = new Date(ey, em - 1, ed);
            const diffTime = end.getTime() - start.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
            return diffDays;
        } catch {
            return 0;
        }
    })();

    return (
        <div>
            <div className={styles.pageHeader}>
                <div className={styles.actionHeader}>
                    <div>
                        <h1 className={styles.pageTitle}>Public Holidays & Days Off</h1>
                        <p className={styles.pageDescription}>
                            Kelola daftar hari libur nasional dan tanggal cuti bersama untuk kalkulasi SLA & kalender kerja operasional IT.
                        </p>
                    </div>
                    <Button onClick={openCreateDialog}>
                        <Plus size={16} style={{ marginRight: 8 }} />
                        Add Holiday
                    </Button>
                </div>
            </div>

            {actionData?.error && (
                <Alert variant="destructive" style={{ marginBottom: 16 }}>
                    <AlertDescription>{actionData.error}</AlertDescription>
                </Alert>
            )}

            <Card className={styles.mainCard}>
                <CardContent>
                    {holidays.length === 0 ? (
                        <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-neutral-10)' }}>
                            <CalendarDays size={48} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
                            <p style={{ fontWeight: 500, fontSize: '1rem', marginBottom: 4 }}>Belum ada hari libur terdaftar</p>
                            <p style={{ fontSize: '0.875rem', opacity: 0.8 }}>
                                Klik tombol &quot;Add Holiday&quot; untuk menambahkan tanggal libur baru.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table View */}
                            <div className={styles.desktopTable}>
                                <div className={styles.tableContainer}>
                                    <div className={styles.scrollableArea}>
                                        <table className={styles.dataTable}>
                                            <thead>
                                                <tr>
                                                    <th>Nama Hari Libur</th>
                                                    <th>Tanggal</th>
                                                    <th>Sifat Hari Libur</th>
                                                    <th style={{ textAlign: "right" }}>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {holidays.map((holiday) => (
                                                    <tr key={holiday.id}>
                                                        <td style={{ fontWeight: 600 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                                <div style={{
                                                                    width: 28,
                                                                    height: 28,
                                                                    borderRadius: 6,
                                                                    background: "rgba(59, 130, 246, 0.15)",
                                                                    display: "flex",
                                                                    alignItems: "center",
                                                                    justifyContent: "center",
                                                                    color: "#60a5fa"
                                                                }}>
                                                                    <Calendar size={15} />
                                                                </div>
                                                                <span>{holiday.name}</span>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                <span style={{ fontWeight: 500 }}>{formatHolidayDate(holiday.holidayDate)}</span>
                                                                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{holiday.holidayDate}</span>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            {holiday.isRecurring ? (
                                                                <span style={{
                                                                    display: "inline-flex",
                                                                    alignItems: "center",
                                                                    gap: 5,
                                                                    padding: "4px 10px",
                                                                    borderRadius: 8,
                                                                    fontSize: "0.75rem",
                                                                    fontWeight: 600,
                                                                    background: "rgba(59, 130, 246, 0.2)",
                                                                    color: "#93c5fd",
                                                                    border: "1px solid rgba(59, 130, 246, 0.35)"
                                                                }}>
                                                                    <Repeat size={12} />
                                                                    Berulang Tiap Tahun
                                                                </span>
                                                            ) : (
                                                                <span style={{
                                                                    display: "inline-flex",
                                                                    alignItems: "center",
                                                                    padding: "4px 10px",
                                                                    borderRadius: 8,
                                                                    fontSize: "0.75rem",
                                                                    fontWeight: 600,
                                                                    background: "rgba(148, 163, 184, 0.15)",
                                                                    color: "#cbd5e1",
                                                                    border: "1px solid rgba(148, 163, 184, 0.25)"
                                                                }}>
                                                                    Satu Kali / Khusus Tahun Ini
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                                                <Button variant="outline" size="sm" onClick={() => openEditDialog(holiday)}>
                                                                    <Pencil size={14} />
                                                                </Button>
                                                                <Form method="post" onSubmit={(e) => {
                                                                    if (!confirm(`Hapus hari libur "${holiday.name}" (${holiday.holidayDate})?`)) {
                                                                        e.preventDefault();
                                                                    }
                                                                }}>
                                                                    <input type="hidden" name="intent" value="delete" />
                                                                    <input type="hidden" name="id" value={holiday.id} />
                                                                    <Button variant="outline" size="sm" style={{ color: 'var(--color-critical-9)' }}>
                                                                        <Trash2 size={14} />
                                                                    </Button>
                                                                </Form>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Mobile Card List View */}
                            <div className={styles.mobileCardList}>
                                {holidays.map((holiday) => (
                                    <div key={holiday.id} className={styles.settingCard}>
                                        <div className={styles.settingCardHeader}>
                                            <div className={styles.settingCardTitleGroup}>
                                                <div style={{
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: 8,
                                                    background: "rgba(59, 130, 246, 0.12)",
                                                    border: "1px solid rgba(59, 130, 246, 0.25)",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    flexShrink: 0,
                                                }}>
                                                    <Calendar size={15} style={{ color: "#60a5fa" }} />
                                                </div>
                                                <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                                                    <span className={styles.settingCardTitle}>{holiday.name}</span>
                                                    <span style={{ fontSize: "0.8rem", color: "#93c5fd" }}>
                                                        {formatHolidayDate(holiday.holidayDate)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className={styles.settingCardActions}>
                                                <button
                                                    type="button"
                                                    className={styles.settingCardActionBtn}
                                                    onClick={() => openEditDialog(holiday)}
                                                    title="Edit holiday"
                                                >
                                                    <Pencil size={13} />
                                                </button>
                                                <Form method="post" onSubmit={(e) => {
                                                    if (!confirm(`Hapus hari libur "${holiday.name}"?`)) {
                                                        e.preventDefault();
                                                    }
                                                }}>
                                                    <input type="hidden" name="intent" value="delete" />
                                                    <input type="hidden" name="id" value={holiday.id} />
                                                    <button
                                                        type="submit"
                                                        className={styles.settingCardActionBtnDanger}
                                                        title="Delete holiday"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </Form>
                                            </div>
                                        </div>

                                        <div className={styles.settingCardBody} style={{ paddingTop: 6 }}>
                                            {holiday.isRecurring ? (
                                                <span style={{ fontSize: "0.75rem", color: "#93c5fd", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                                    <Repeat size={11} /> Berulang setiap tahun
                                                </span>
                                            ) : (
                                                <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                                                    Hanya berlaku tahun {holiday.holidayDate.split("-")[0]}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingHoliday ? 'Edit Hari Libur' : 'Tambah Hari Libur Baru'}</DialogTitle>
                    </DialogHeader>
                    <Form method="post" onSubmit={() => setIsDialogOpen(false)}>
                        <input type="hidden" name="intent" value={editingHoliday ? "update" : "create"} />
                        {editingHoliday && <input type="hidden" name="id" value={editingHoliday.id} />}
                        <input type="hidden" name="dateMode" value={dateMode} />

                        <div className={styles.modalContent}>
                            <div className={styles.formGrid}>
                                <div className={`${styles.formFullWidth} space-y-2`}>
                                    <Label htmlFor="name">Nama Hari Libur / Cuti</Label>
                                    <Input
                                        id="name"
                                        name="name"
                                        placeholder="Contoh: Libur & Cuti Bersama Idul Fitri, Tahun Baru Masehi"
                                        defaultValue={editingHoliday?.name}
                                        required
                                    />
                                </div>

                                {!editingHoliday && (
                                    <div className={`${styles.formFullWidth} space-y-2`}>
                                        <Label>Tipe Pilihan Tanggal</Label>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                            <button
                                                type="button"
                                                onClick={() => setDateMode("single")}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: 8,
                                                    padding: '10px 14px',
                                                    borderRadius: 8,
                                                    fontSize: '0.85rem',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    border: dateMode === 'single' ? '2px solid #3b82f6' : '1px solid rgba(148, 163, 184, 0.25)',
                                                    background: dateMode === 'single' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(15, 23, 42, 0.4)',
                                                    color: dateMode === 'single' ? '#60a5fa' : '#94a3b8',
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                <Calendar size={15} />
                                                Satu Hari
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDateMode("range")}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: 8,
                                                    padding: '10px 14px',
                                                    borderRadius: 8,
                                                    fontSize: '0.85rem',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    border: dateMode === 'range' ? '2px solid #3b82f6' : '1px solid rgba(148, 163, 184, 0.25)',
                                                    background: dateMode === 'range' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(15, 23, 42, 0.4)',
                                                    color: dateMode === 'range' ? '#60a5fa' : '#94a3b8',
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                <CalendarDays size={15} />
                                                Rentang Tanggal (Multi Hari)
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {dateMode === "single" || editingHoliday ? (
                                    <div className={`${styles.formFullWidth} space-y-2`}>
                                        <Label htmlFor="holidayDate">Tanggal Libur</Label>
                                        <Input
                                            id="holidayDate"
                                            name="holidayDate"
                                            type="date"
                                            defaultValue={editingHoliday?.holidayDate}
                                            required
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <div className="space-y-2" style={{ gridColumn: 'span 1' }}>
                                            <Label htmlFor="startDate">Tanggal Mulai</Label>
                                            <Input
                                                id="startDate"
                                                name="startDate"
                                                type="date"
                                                value={startDate}
                                                onChange={(e) => setStartDate(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2" style={{ gridColumn: 'span 1' }}>
                                            <Label htmlFor="endDate">Tanggal Selesai</Label>
                                            <Input
                                                id="endDate"
                                                name="endDate"
                                                type="date"
                                                value={endDate}
                                                onChange={(e) => setEndDate(e.target.value)}
                                                required
                                            />
                                        </div>

                                        {startDate && endDate && (
                                            <div className={styles.formFullWidth} style={{ marginTop: -4 }}>
                                                {rangeDaysCount > 0 ? (
                                                    <div style={{
                                                        padding: '10px 14px',
                                                        borderRadius: 8,
                                                        background: 'rgba(59, 130, 246, 0.12)',
                                                        border: '1px solid rgba(59, 130, 246, 0.25)',
                                                        fontSize: '0.82rem',
                                                        color: '#93c5fd',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 8
                                                    }}>
                                                        <CalendarDays size={16} />
                                                        <span>
                                                            <strong>{rangeDaysCount} hari libur</strong> akan didaftarkan otomatis ({formatHolidayDate(startDate)} s/d {formatHolidayDate(endDate)})
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div style={{
                                                        padding: '8px 12px',
                                                        borderRadius: 8,
                                                        background: 'rgba(239, 68, 68, 0.15)',
                                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                                        fontSize: '0.8rem',
                                                        color: '#f87171'
                                                    }}>
                                                        Tanggal selesai tidak boleh lebih awal dari tanggal mulai.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}

                                <div className={`${styles.formFullWidth}`} style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                                    <input
                                        type="checkbox"
                                        id="isRecurring"
                                        name="isRecurring"
                                        value="true"
                                        defaultChecked={editingHoliday ? editingHoliday.isRecurring : false}
                                        style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#2563eb' }}
                                    />
                                    <div>
                                        <Label htmlFor="isRecurring" style={{ cursor: 'pointer', margin: 0, fontWeight: 600 }}>
                                            Berulang setiap tahun
                                        </Label>
                                        <p style={{ margin: 0, fontSize: "0.78rem", color: "#94a3b8" }}>
                                            Centang jika hari libur ini jatuh pada tanggal & bulan yang sama setiap tahunnya (contoh: 17 Agustus, 1 Januari, 25 Desember).
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <DialogFooter style={{ marginTop: 20 }}>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
                            <Button type="submit" disabled={dateMode === 'range' && rangeDaysCount <= 0}>
                                {editingHoliday ? 'Simpan Perubahan' : dateMode === 'range' && rangeDaysCount > 1 ? `Tambah ${rangeDaysCount} Hari Libur` : 'Tambah Hari Libur'}
                            </Button>
                        </DialogFooter>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
