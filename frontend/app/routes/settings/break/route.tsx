/**
 * route.tsx — Break Settings
 *
 * Batas waktu break (menit) untuk staff IT. Satu baris setting, diubah admin.
 * Per sesi dipakai overtime + profil; batas harian/mingguan/bulanan dipakai
 * sub-page Break di Performance. Total harian reset otomatis tiap hari.
 *
 * @module settings/break
 */

import { Form, useLoaderData, useActionData } from "react-router";
import type { Route } from "./+types/route";
import { Button } from "~/components/ui/button/button";
import { Input } from "~/components/ui/input/input";
import { Label } from "~/components/ui/label/label";
import { Card, CardContent } from "~/components/ui/card/card";
import { Alert, AlertDescription } from "~/components/ui/alert/alert";
import { Coffee } from "lucide-react";
import { settingsApi } from "~/services/settings.service";
import styles from "../style.module.css";
import type { BreakSetting } from "~/services/settings.service";

export async function loader({ request }: Route.LoaderArgs) {
    const response = await settingsApi.getBreakSetting();
    return Response.json({ setting: response.data?.data || null });
}

export async function action({ request }: Route.ActionArgs) {
    const formData = await request.formData();
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

    const response = await settingsApi.updateBreakSetting({ maxBreakMinutes, dailyMaxMinutes, weeklyMaxMinutes, monthlyMaxMinutes } as any);
    if (!response.success) return Response.json({ error: response.error }, { status: 400 });
    return Response.json({ success: true, setting: response.data?.data }, { status: 200 });
}

export default function BreakSettings() {
    const { setting } = useLoaderData() as { setting: BreakSetting | null };
    const actionData = useActionData() as { error?: string; success?: boolean } | undefined;

    return (
        <div>
            <div className={styles.pageHeader}>
                <div className={styles.actionHeader}>
                    <div>
                        <h1 className={styles.pageTitle}>Break Time Limit</h1>
                        <p className={styles.pageDescription}>
                            Batas per sesi dipakai notifikasi overtime + profil. Batas harian/mingguan/bulanan dipakai sub-page Break di Performance (pemakaian vs sisa per staff).
                        </p>
                    </div>
                </div>
            </div>

            {actionData?.error && (
                <Alert variant="destructive" style={{ marginBottom: 16 }}>
                    <AlertDescription>{actionData.error}</AlertDescription>
                </Alert>
            )}
            {actionData?.success && (
                <Alert style={{ marginBottom: 16 }}>
                    <AlertDescription>Batas break tersimpan.</AlertDescription>
                </Alert>
            )}

            <Card>
                <CardContent>
                    <Form
                        method="post"
                        key={`${setting?.maxBreakMinutes ?? 60}-${setting?.dailyMaxMinutes ?? 60}-${setting?.weeklyMaxMinutes ?? 300}-${setting?.monthlyMaxMinutes ?? 1200}`}
                    >
                        <div className={styles.formGrid} style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                            <div style={{
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid rgba(255,255,255,0.08)",
                                borderRadius: 12,
                                padding: 14,
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                            }}>
                                <Label htmlFor="maxBreakMinutes">Maks. per sesi (menit)</Label>
                                <Input
                                    id="maxBreakMinutes"
                                    name="maxBreakMinutes"
                                    type="number"
                                    min={1}
                                    max={1440}
                                    defaultValue={setting?.maxBreakMinutes ?? 60}
                                    required
                                    style={{ height: 44 }}
                                />
                                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                                    Batas 1x break · picu notifikasi overtime + live sisa di profil.
                                </span>
                            </div>
                            <div style={{
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid rgba(255,255,255,0.08)",
                                borderRadius: 12,
                                padding: 14,
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                            }}>
                                <Label htmlFor="dailyMaxMinutes">Batas harian (menit)</Label>
                                <Input
                                    id="dailyMaxMinutes"
                                    name="dailyMaxMinutes"
                                    type="number"
                                    min={1}
                                    max={1440}
                                    defaultValue={setting?.dailyMaxMinutes ?? 60}
                                    required
                                    style={{ height: 44 }}
                                />
                                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                                    Batas periode Harian di tab Break Performance.
                                </span>
                            </div>
                            <div style={{
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid rgba(255,255,255,0.08)",
                                borderRadius: 12,
                                padding: 14,
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                            }}>
                                <Label htmlFor="weeklyMaxMinutes">Batas mingguan (menit)</Label>
                                <Input
                                    id="weeklyMaxMinutes"
                                    name="weeklyMaxMinutes"
                                    type="number"
                                    min={1}
                                    max={10080}
                                    defaultValue={setting?.weeklyMaxMinutes ?? 300}
                                    required
                                    style={{ height: 44 }}
                                />
                                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                                    Batas periode Mingguan (Senin–Minggu).
                                </span>
                            </div>
                            <div style={{
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid rgba(255,255,255,0.08)",
                                borderRadius: 12,
                                padding: 14,
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                            }}>
                                <Label htmlFor="monthlyMaxMinutes">Batas bulanan (menit)</Label>
                                <Input
                                    id="monthlyMaxMinutes"
                                    name="monthlyMaxMinutes"
                                    type="number"
                                    min={1}
                                    max={43200}
                                    defaultValue={setting?.monthlyMaxMinutes ?? 1200}
                                    required
                                    style={{ height: 44 }}
                                />
                                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                                    Batas periode Bulanan (tgl 1–akhir).
                                </span>
                            </div>
                        </div>
                        <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 16,
                            flexWrap: "wrap",
                            marginTop: 20,
                            paddingTop: 16,
                            borderTop: "1px solid rgba(255,255,255,0.08)",
                        }}>
                            <p className={styles.pageDescription} style={{ fontSize: "0.9rem", flex: "1 1 280px", margin: 0 }}>
                                Berlaku saat ini: sesi {setting?.maxBreakMinutes ?? 60} mnt · harian {setting?.dailyMaxMinutes ?? 60} mnt · mingguan {setting?.weeklyMaxMinutes ?? 300} mnt · bulanan {setting?.monthlyMaxMinutes ?? 1200} mnt.
                                Total harian tiap staff reset otomatis tiap hari (WIB).
                            </p>
                            <Button
                                type="submit"
                                size="lg"
                                style={{ minWidth: 180, height: 46, fontSize: "0.95rem", flexShrink: 0 }}
                            >
                                <Coffee size={16} style={{ marginRight: 8 }} />
                                Simpan
                            </Button>
                        </div>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}
