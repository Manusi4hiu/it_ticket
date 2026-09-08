import React from "react";
import { v4 as uuidv4 } from "uuid";
import { Form, Link, useNavigate, useNavigation, useSubmit } from "react-router";
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
    CheckCircle,
    User,
    Mail,
    Phone,
    Building2,
    Flag,
    FileText,
    MessageSquare,
    Image as ImageIcon,
    X,
} from "lucide-react";
import styles from "./style.module.css";

import { createTicket } from "~/services/ticket.service";
import { settingsApi, type Category, type Priority, type Department } from "~/services/settings.service";
import { getUserSession } from "~/services/session.service";
import { compressImage } from "~/utils/image-compression";

export async function loader({ request }: Route.LoaderArgs) {
    // Deteksi sesi: pengunjung tanpa login (dari landing page) vs staff login (dari dashboard).
    // Menentukan arah tombol "Back to Home"/"Cancel":
    //   - tanpa login  -> kembali ke landing page "/"
    //   - sudah login -> kembali ke dashboard "/dashboard"
    const session = await getUserSession(request);

    const [categoriesRes, prioritiesRes, departmentsRes] = await Promise.all([
        settingsApi.getCategories(),
        settingsApi.getPriorities(),
        settingsApi.getDepartments()
    ]);

    return {
        isAuthenticated: Boolean(session),
        homePath: session ? "/dashboard" : "/",
        categories: (categoriesRes.data?.data || []) as Category[],
        priorities: (prioritiesRes.data?.data || []) as Priority[],
        departments: (departmentsRes.data?.data || []) as Department[]
    };
}

export async function action({ request }: Route.ActionArgs) {
    const formData = await request.formData();
    const name = (formData.get("name") as string || "").trim();
    const email = (formData.get("email") as string || "").trim();
    const phone = (formData.get("phone") as string || "").trim();
    const department = (formData.get("department") as string || "").trim();
    const priority = (formData.get("priority") as string || 'medium').trim();
    const category = (formData.get("category") as string || "Uncategorized").trim();
    const subject = (formData.get("subject") as string || "").trim();
    const description = (formData.get("description") as string || "").trim();

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
}

export default function SubmitTicket({ actionData, loaderData }: Route.ComponentProps) {
    const { priorities, departments, homePath } = loaderData;
    const navigate = useNavigate();
    const navigation = useNavigation();
    const isSubmitting = navigation.state !== "idle";
    const [imagePreview, setImagePreview] = React.useState<string | null>(null);
    const [fileError, setFileError] = React.useState<string | null>(null);
    const idempotencyKey = React.useMemo(() => uuidv4(), []);
    const submit = useSubmit();
    const [compressedFile, setCompressedFile] = React.useState<File | null>(null);

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
        formData.delete("image");
        if (compressedFile) {
            formData.append("image", compressedFile);
        }
        submit(formData, { method: "post", encType: "multipart/form-data" });
    };

    return (
        <main className={styles.main}>
            <div style={{ marginBottom: 'var(--space-6)' }}>
                <Link to={homePath} className={styles.backLink}>
                    <ArrowLeft size={20} />
                    Back to Home
                </Link>
            </div>
            <div className={styles.formContainer}>
                {actionData?.success ? (
                    <div className={styles.successCard}>
                        <div className={styles.successIcon}>
                            <CheckCircle size={64} />
                        </div>
                        <h2 className={styles.successTitle}>Ticket Created Successfully!</h2>
                        <p className={styles.successMessage}>
                            Your ticket number is:
                        </p>
                        <div className={styles.ticketId}>{actionData.ticketCode || actionData.ticketId}</div>
                        <p className={styles.successHint}>
                            Please save this ID to track your ticket status. We've also sent a confirmation to your email.
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
                            <CardTitle className={styles.cardTitle}>
                                <FileText size={24} />
                                New Support Ticket
                            </CardTitle>
                            <CardDescription className={styles.cardDescription}>
                                Please fill out the form below to submit your support request. Our team will respond as soon as possible.
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
                                        Contact Information
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
                                                placeholder="John Doe"
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
                                                placeholder="john@company.com"
                                                maxLength={120}
                                                className={styles.input}
                                            />
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

                                {/* Ticket Details */}
                                <div className={styles.formSection}>
                                    <h3 className={styles.sectionTitle}>
                                        <FileText size={18} />
                                        Ticket Details
                                    </h3>

                                    <div className={styles.formGroup}>
                                        <Label htmlFor="priority" className={styles.label}>
                                            <Flag size={14} />
                                            Priority *
                                        </Label>
                                        <Select name="priority" defaultValue="medium" required>
                                            <SelectTrigger className={styles.select}>
                                                <SelectValue placeholder="Select Priority" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {priorities.filter(p => p.isActive).map((p) => (
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

                                    <div className={styles.formGroup}>
                                        <Label htmlFor="subject" className={styles.label}>
                                            <FileText size={14} />
                                            Subject *
                                        </Label>
                                        <Input
                                            id="subject"
                                            name="subject"
                                            required
                                            placeholder="Brief summary of the issue"
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
                                            placeholder="Please provide detailed information about your issue..."
                                            rows={6}
                                            className={styles.textarea}
                                            maxLength={5000}
                                        />
                                    </div>

                                    <div className={styles.formGroup}>
                                        <Label htmlFor="image" className={styles.label}>
                                            <ImageIcon size={14} />
                                            Attachment Image (Optional)
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
        </main>
    );
}
