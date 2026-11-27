import React from "react";
import { Form, Link, redirect, useNavigate, useNavigation, useSubmit } from "react-router";
import type { Route } from "./+types/route";
import { Button } from "~/components/ui/button/button";
import { Input } from "~/components/ui/input/input";
import { Label } from "~/components/ui/label/label";
import { Textarea } from "~/components/ui/textarea/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card/card";
import { Alert, AlertDescription } from "~/components/ui/alert/alert";
import {
    TicketPlus,
    ArrowLeft,
    ArrowLeftRight,
    CheckCircle,
    User,
    Mail,
    Phone,
    Building2,
    Flag,
    Tag,
    FileText,
    MessageSquare,
    Image as ImageIcon,
    X,
    Clock,
    MonitorCog,
    Palette,
} from "lucide-react";
import styles from "./style.module.css";

import { createTicket } from "~/services/ticket.service";
import { settingsApi, type Category, type Priority, type Department, type Team } from "~/services/settings.service";
import { runWithUserSession } from "~/services/session.service";
import { compressImage } from "~/utils/image-compression";

const submitBase = import.meta.env.BASE_URL.replace(/\/$/, "");

function destinationCode(request: Request) {
    const pathname = new URL(request.url).pathname.slice(submitBase.length).replace(/\/$/, "");
    if (pathname === "/submit-ticket") return "IT";
    if (pathname === "/corcom/submit-ticket") return "COC";
    throw new Response("Not Found", { status: 404 });
}

export async function loader({ request }: Route.LoaderArgs) {
    // Deteksi sesi: pengunjung tanpa login (dari landing page) vs staff login (dari dashboard).
    // Menentukan arah tombol "Back to Home"/"Cancel":
    //   - tanpa login  -> kembali ke landing page "/"
    //   - sudah login -> kembali ke dashboard "/dashboard"
    return runWithUserSession(request, async (session) => {
    const [categoriesRes, prioritiesRes, departmentsRes, teamsRes] = await Promise.all([
        settingsApi.getCategories(),
        settingsApi.getPriorities(),
        settingsApi.getDepartments(),
        settingsApi.getTeams()
    ]);

    const url = new URL(request.url);
    const teams = (teamsRes.data?.data || []) as Team[];
    const teamCode = destinationCode(request);
    const legacyValues = ["team", "teamId", "teamCode"].flatMap(key => url.searchParams.getAll(key));
    if (legacyValues.length) {
        const legacyTeams = legacyValues.map(value => teams.find(t =>
            t.isActive && (String(t.id) === value || t.code.toUpperCase() === value.toUpperCase()) &&
            ["IT", "COC"].includes(t.code.toUpperCase())
        ));
        if (legacyTeams.some(t => !t) || new Set(legacyTeams.map(t => t!.code)).size !== 1) {
            throw new Response("Team tidak valid", { status: 400 });
        }
        const path = legacyTeams[0]!.code.toUpperCase() === "COC" ? "/corcom/submit-ticket" : "/submit-ticket";
        ["team", "teamId", "teamCode"].forEach(key => url.searchParams.delete(key));
        const query = url.searchParams.toString();
        return redirect(path + (query ? `?${query}` : ""));
    }
    const team = teams.find(t => t.isActive && t.code.toUpperCase() === teamCode);
    if (!team) throw new Response("Team tidak tersedia", { status: 503 });

    return {
        isAuthenticated: Boolean(session),
        homePath: session ? "/dashboard" : "/",
        teamCode,
        categories: ((categoriesRes.data?.data || []) as Category[]).filter(c => c.isActive && (!c.teamId || String(c.teamId) === String(team.id))),
        priorities: (prioritiesRes.data?.data || []) as Priority[],
        departments: (departmentsRes.data?.data || []) as Department[],
    };
    });
}

export async function action({ request }: Route.ActionArgs) {
    return runWithUserSession(request, async () => {
    const formData = await request.formData();
    const name = (formData.get("name") as string || "").trim();
    const email = (formData.get("email") as string || "").trim();
    const phone = (formData.get("phone") as string || "").trim();
    const department = (formData.get("department") as string || "").trim();
    const priority = (formData.get("priority") as string || 'medium').trim();
    const category = (formData.get("category") as string || "Uncategorized").trim();
    const teamCode = destinationCode(request);
    const deadlineRaw = (formData.get("deadline") as string || "").trim();
    const subject = (formData.get("subject") as string || "").trim();
    const description = (formData.get("description") as string || "").trim();
    const receiveUpdates = formData.get("receiveUpdates") === "true" || formData.get("receiveUpdates") === "on";

        const image = formData.get("image") as File | null;
        const validImage = image && typeof image === 'object' && image.size > 0 && image.name ? image : undefined;

        const idempotencyKey = formData.get("idempotencyKey") as string;

        if (!name) {
            return { error: "Full Name tidak boleh kosong atau hanya berisi spasi" };
        }
        if (!department) {
            return { error: "Department wajib dipilih" };
        }
        if (!subject) {
            return { error: "Subject / Judul tidak boleh kosong atau hanya berisi spasi" };
        }
        if (subject.length < 3) {
            return { error: "Subject / Judul minimal 3 karakter" };
        }
        if (subject.length > 255) {
            return { error: "Subject / Judul maksimal 255 karakter" };
        }
        if (!description) {
            return { error: "Description tidak boleh kosong atau hanya berisi spasi" };
        }
        if (description.length > 5000) {
            return { error: "Description maksimal 5000 karakter" };
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return { error: "Format Email tidak valid" };
        }
        if (phone && !/^[\d\s+\-()]{6,20}$/.test(phone)) {
            return { error: "Nomor telepon hanya boleh berisi angka dan simbol +, -, ()" };
        }

    const teamsRes = await settingsApi.getTeams();
    if (!teamsRes.data?.data.some(t => t.isActive && t.code.toUpperCase() === teamCode)) {
        return { error: "Team tidak tersedia" };
    }
    if (teamCode === "COC" && !deadlineRaw) {
        return { error: "Waktu deadline wajib diisi untuk tiket Corcom" };
    }

    let deadlineIso: string | undefined = undefined;
    if (teamCode === "COC" && deadlineRaw) {
        const d = new Date(`${deadlineRaw}:00+07:00`);
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(deadlineRaw) || isNaN(d.getTime()) ||
            new Date(d.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 16) !== deadlineRaw) {
            return { error: "Format Waktu Deadline tidak valid" };
        }
        if (d.getTime() < Date.now() - 60 * 1000) {
            return { error: "Waktu deadline tidak boleh di masa lalu" };
        }
        deadlineIso = d.toISOString();
    }

    try {
        const newTicket = await createTicket({
            title: subject,
            description: description,
            priority: priority,
            category: category,
            submitterName: name,
            submitterEmail: email || "",
            submitterPhone: phone || undefined,
            submitterDepartment: department,
            receiveUpdates: receiveUpdates,
            teamCode,
            deadline: deadlineIso,
        }, validImage, idempotencyKey);

            if (!newTicket) {
                return { error: "Gagal membuat ticket." };
            }

            return { success: true, ticketId: newTicket.id, ticketCode: newTicket.ticketCode };
        } catch (error: any) {
            console.error("Failed to create ticket:", error);
            const errorMsg = error?.response?.data?.error || error?.message || "Gagal membuat ticket. Silakan coba lagi nanti.";
            return { error: errorMsg };
        }
    });
}

/** Generates an RFC 4122 v4 UUID safely on both HTTPS and plain HTTP LAN contexts. */
function generateIdempotencyKey(): string {
    if (typeof crypto !== "undefined") {
        if (typeof crypto.randomUUID === "function") {
            return crypto.randomUUID();
        }
        if (typeof crypto.getRandomValues === "function") {
            const bytes = new Uint8Array(16);
            crypto.getRandomValues(bytes);
            bytes[6] = (bytes[6] & 0x0f) | 0x40;
            bytes[8] = (bytes[8] & 0x3f) | 0x80;
            const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
            return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
        }
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = Math.floor(Math.random() * 16);
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

export default function SubmitTicket({ actionData, loaderData }: Route.ComponentProps) {
    const { priorities, departments, homePath, categories, teamCode } = loaderData;
    const activePriorities = priorities.filter((p) => p.isActive);
    const defaultPriority =
        activePriorities.find((p) => p.name.toLowerCase() === "medium")?.name.toLowerCase() ||
        activePriorities[0]?.name.toLowerCase() ||
        "medium";
    const navigate = useNavigate();
    const navigation = useNavigation();
    const isSubmitting = navigation.state !== "idle";
    const [imagePreview, setImagePreview] = React.useState<string | null>(null);
    const [fileError, setFileError] = React.useState<string | null>(null);
    // Empty on SSR + first client render to avoid hydration mismatch, then populated on mount.
    const [idempotencyKey, setIdempotencyKey] = React.useState<string>("");
    React.useEffect(() => {
        setIdempotencyKey((prev) => prev || generateIdempotencyKey());
    }, []);
    const submit = useSubmit();
    const [compressedFile, setCompressedFile] = React.useState<File | null>(null);

    const isGraphicDesign = teamCode === "COC";

    const minDeadline = React.useMemo(() => {
        return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 16);
    }, []);

    // "Back to Home" context-aware:
    // - sesi tanpa login (dari landing page)  -> "/" (landing page)
    // - sesi login (dari dashboard manual)     -> "/dashboard"
    const goHome = () => navigate(homePath);

    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        setFileError(null);
        if (file) {
            try {
                const compressed = await compressImage(file);
                setCompressedFile(compressed);
                const reader = new FileReader();
                reader.onloadend = () => {
                    setImagePreview(reader.result as string);
                };
                reader.readAsDataURL(compressed);
            } catch (err) {
                console.error("Image compression error:", err);
                setCompressedFile(file);
                const reader = new FileReader();
                reader.onloadend = () => {
                    setImagePreview(reader.result as string);
                };
                reader.readAsDataURL(file);
            }
        } else {
            setImagePreview(null);
            setCompressedFile(null);
        }
    };

    const handleRemoveImage = () => {
        setCompressedFile(null);
        setImagePreview(null);
        setFileError(null);
        const fileInput = document.getElementById("image") as HTMLInputElement;
        if (fileInput) fileInput.value = "";
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (fileError) return;
        const formData = new FormData(e.currentTarget);
        if (!formData.get("idempotencyKey")) {
            const key = idempotencyKey || generateIdempotencyKey();
            if (!idempotencyKey) setIdempotencyKey(key);
            formData.set("idempotencyKey", key);
        }
        formData.delete("image");
        if (compressedFile) {
            formData.append("image", compressedFile);
        }
        submit(formData, { method: "post", encType: "multipart/form-data" });
    };

    return (
        <div className={`${styles.main} ${isGraphicDesign ? styles.cocTheme : styles.itTheme}`}>
            <div className={styles.topActionRow}>
                <Link to={homePath} className={styles.backLink}>
                    <ArrowLeft size={18} />
                    Back to Home
                </Link>
                <Link
                    to={isGraphicDesign ? "/submit-ticket" : "/corcom/submit-ticket"}
                    className={styles.switchPortalLink}
                >
                    <ArrowLeftRight size={14} />
                    <span>
                        {isGraphicDesign ? "Switch to IT Support" : "Switch to Corcom"}
                    </span>
                </Link>
            </div>
            <div className={styles.formContainer}>
                {actionData?.success ? (
                    <div className={styles.successCard}>
                        <div className={styles.successIcon}>
                            <CheckCircle size={64} />
                        </div>
                        <div className={styles.successTeamPill}>
                            {isGraphicDesign ? "CORCOM • CREATIVE REQUEST" : "IT SUPPORT • HELPDESK"}
                        </div>
                        <h2 className={styles.successTitle}>Ticket Created Successfully!</h2>
                        <p className={styles.successMessage}>
                            Your ticket number is:
                        </p>
                        <div className={styles.ticketId}>{actionData.ticketCode || actionData.ticketId}</div>
                        <p className={styles.successHint}>
                            {isGraphicDesign
                                ? "Save this ID to track design progress and release schedule. Confirmation has been sent if email was provided."
                                : "Please save this ID to track your ticket status. We've also sent a confirmation to your email."}
                        </p>
                        <div className={styles.successActions}>
                            <Button onClick={() => navigate(`/ticket/${actionData.ticketCode || actionData.ticketId}`)}>
                                Track This Ticket
                            </Button>
                            <Button variant="outline" onClick={goHome}>
                                Back to Home
                            </Button>
                        </div>
                    </div>
                ) : (
                    <Card className={styles.formCard}>
                        <CardHeader className={styles.cardHeader}>
                            <div className={styles.headerMeta}>
                                {isGraphicDesign ? "CORCOM • CREATIVE & DESIGN" : "IT SUPPORT • HELPDESK"}
                            </div>
                            <CardTitle className={styles.cardTitle}>
                                {isGraphicDesign ? <Palette size={22} /> : <MonitorCog size={22} />}
                                {isGraphicDesign ? "Request Corcom" : "Request IT"}
                            </CardTitle>
                            <CardDescription className={styles.cardDescription}>
                                {isGraphicDesign
                                    ? "Submit graphic design, publication, or event material requests with a clear target deadline."
                                    : "Report hardware, network, account, or application issues for the IT team to handle."}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Form method="post" encType="multipart/form-data" className={styles.form} onSubmit={handleSubmit}>
                                <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
                                {actionData?.error && (
                                    <Alert variant="destructive" className={styles.errorAlert}>
                                        <AlertDescription>{actionData.error}</AlertDescription>
                                    </Alert>
                                )}

                                {/* Contact Information */}
                                <div className={styles.formSection}>
                                    <h3 className={styles.sectionTitle}>
                                        <User size={18} />
                                        Requester Information
                                    </h3>
                                    <div className={styles.formGrid}>
                                        <div className={styles.formGroup}>
                                            <Label htmlFor="name" className={styles.label}>
                                                <User size={14} />
                                                Full Name *
                                            </Label>
                                            <Input
                                                id="name"
                                                name="name"
                                                required
                                                placeholder="Your full name"
                                                maxLength={100}
                                                className={styles.input}
                                            />
                                        </div>

                                        <div className={styles.formGroup}>
                                            <Label htmlFor="email" className={styles.label}>
                                                <Mail size={14} />
                                                Email Address (Optional)
                                            </Label>
                                            <Input
                                                id="email"
                                                name="email"
                                                type="email"
                                                placeholder="name@company.com"
                                                maxLength={120}
                                                className={styles.input}
                                            />
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                                                <input
                                                    type="checkbox"
                                                    id="receiveUpdates"
                                                    name="receiveUpdates"
                                                    defaultChecked={true}
                                                    style={{ width: '16px', height: '16px', accentColor: isGraphicDesign ? '#f59e0b' : '#2563eb', cursor: 'pointer' }}
                                                />
                                                <Label htmlFor="receiveUpdates" style={{ cursor: 'pointer', fontSize: '13px', color: '#94a3b8', fontWeight: 'normal', margin: 0 }}>
                                                    Receive updates and activities via email
                                                </Label>
                                            </div>
                                        </div>

                                        <div className={styles.formGroup}>
                                            <Label htmlFor="phone" className={styles.label}>
                                                <Phone size={14} />
                                                Phone Number (Optional)
                                            </Label>
                                            <Input
                                                id="phone"
                                                name="phone"
                                                type="tel"
                                                pattern="[0-9+\-() ]*"
                                                title="Hanya angka, spasi, dan simbol +, -, ()"
                                                placeholder="+62 812 3456 7890"
                                                maxLength={20}
                                                className={styles.input}
                                            />
                                        </div>

                                        <div className={styles.formGroup}>
                                            <Label htmlFor="department" className={styles.label}>
                                                <Building2 size={14} />
                                                Department *
                                            </Label>
                                            <Select name="department" required>
                                                <SelectTrigger className={styles.select}>
                                                    <SelectValue placeholder="Select Department" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {departments.filter(d => d.isActive).map((d) => (
                                                        <SelectItem key={d.id} value={d.name}>
                                                            {d.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>

                                {/* Ticket Details / Design Brief */}
                                <div className={styles.formSection}>
                                    <h3 className={styles.sectionTitle}>
                                        {isGraphicDesign ? <Palette size={18} /> : <FileText size={18} />}
                                        {isGraphicDesign ? "Creative Brief & Schedule" : "Technical Issue Details"}
                                    </h3>

                                    {/* Deadline field khusus tiket Graphic Design (COC) */}
                                    {isGraphicDesign && (
                                        <div className={styles.deadlineBox}>
                                            <div className={styles.formGroup}>
                                                <Label htmlFor="deadline" className={styles.label}>
                                                    <Clock size={14} />
                                                    Target Deadline (WIB) *
                                                </Label>
                                                <Input
                                                    id="deadline"
                                                    name="deadline"
                                                    type="datetime-local"
                                                    required={isGraphicDesign}
                                                    min={minDeadline}
                                                    className={styles.input}
                                                />
                                                <p className={styles.fieldHint}>
                                                    Set the target completion date and time (WIB) for the design release schedule.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    <div className={styles.formGrid}>
                                        <div className={styles.formGroup}>
                                            <Label htmlFor="category" className={styles.label}>
                                                <Tag size={14} />
                                                Category *
                                            </Label>
                                            <Select name="category" required>
                                                <SelectTrigger className={styles.select}>
                                                    <SelectValue placeholder={isGraphicDesign ? "Select Design Category" : "Select IT Category"} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {categories.map((c) => (
                                                        <SelectItem key={c.id} value={c.name}>
                                                            {c.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className={styles.formGroup}>
                                            <Label htmlFor="priority" className={styles.label}>
                                                <Flag size={14} />
                                                Priority *
                                            </Label>
                                            <Select name="priority" defaultValue={defaultPriority} required>
                                                <SelectTrigger className={styles.select}>
                                                    <SelectValue placeholder="Select Priority" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {activePriorities.map((p) => (
                                                        <SelectItem key={p.id} value={p.name.toLowerCase()}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: p.color }} />
                                                                {p.name}
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className={styles.formGroup}>
                                        <Label htmlFor="subject" className={styles.label}>
                                            <FileText size={14} />
                                            Subject *
                                        </Label>
                                        <Input
                                            id="subject"
                                            name="subject"
                                            required
                                            placeholder={
                                                isGraphicDesign
                                                    ? "e.g. Q4 Townhall Event Banner / Social Media Poster"
                                                    : "e.g. Laptop cannot connect to Wi-Fi / Email account locked"
                                            }
                                            className={styles.input}
                                            maxLength={255}
                                        />
                                    </div>

                                    <div className={styles.formGroup}>
                                        <Label htmlFor="description" className={styles.label}>
                                            <MessageSquare size={14} />
                                            Description *
                                        </Label>
                                        <Textarea
                                            id="description"
                                            name="description"
                                            required
                                            placeholder={
                                                isGraphicDesign
                                                    ? "Describe the visual concept, dimensions, required text, target channels, and any revision notes..."
                                                    : "Describe the technical issue, error messages, desk or room location, and steps already tried..."
                                            }
                                            rows={6}
                                            className={styles.textarea}
                                            maxLength={5000}
                                        />
                                    </div>

                                    <div className={styles.formGroup}>
                                        <Label htmlFor="image" className={styles.label}>
                                            <ImageIcon size={14} />
                                            {isGraphicDesign
                                                ? "Visual Reference / Draft Image (Optional)"
                                                : "Error Screenshot / Device Photo (Optional)"}
                                        </Label>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            <div style={{ position: 'relative' }}>
                                                <Input
                                                    id="image"
                                                    name="image"
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleImageChange}
                                                    className={styles.input}
                                                    style={{ padding: '8px 12px', height: 'auto' }}
                                                />
                                            </div>

                                            {fileError && (
                                                <Alert variant="destructive" className={styles.errorAlert} style={{ marginTop: 4 }}>
                                                    <AlertDescription>{fileError}</AlertDescription>
                                                </Alert>
                                            )}

                                            {imagePreview && (
                                                <div style={{ position: 'relative', width: 'fit-content', marginTop: 8 }}>
                                                    <img
                                                        src={imagePreview}
                                                        alt="Preview"
                                                        style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}
                                                    />
                                                    {compressedFile && (
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-neutral-10)', marginTop: 4 }}>
                                                            Ukuran dikompresi: {(compressedFile.size / 1024).toFixed(0)} KB
                                                        </div>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={handleRemoveImage}
                                                        style={{
                                                            position: 'absolute',
                                                            top: -10,
                                                            right: -10,
                                                            background: '#ef4444',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '50%',
                                                            width: 26,
                                                            height: 26,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            cursor: 'pointer',
                                                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                                            zIndex: 10
                                                        }}
                                                        title="Hapus gambar"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.formActions}>
                                    <Button type="button" variant="outline" onClick={goHome} disabled={isSubmitting}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" className={styles.submitButton} disabled={isSubmitting}>
                                        {isSubmitting ? (
                                            <>Wait...</>
                                        ) : (
                                            <TicketPlus size={18} />
                                        )}
                                        {isSubmitting ? "Submitting..." : "Submit Ticket"}
                                    </Button>
                                </div>
                            </Form>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
