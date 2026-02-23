import React from "react";
import { Form, Link, useNavigate } from "react-router";
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
    Tag,
    FileText,
    MessageSquare,
    Image as ImageIcon,
    X,
} from "lucide-react";
import styles from "./style.module.css";

import { createTicket } from "~/services/ticket.service";
import { settingsApi, type Category, type Priority, type Department } from "~/services/settings.service";

export async function loader({ request }: Route.LoaderArgs) {
    const [categoriesRes, prioritiesRes, departmentsRes] = await Promise.all([
        settingsApi.getCategories(),
        settingsApi.getPriorities(),
        settingsApi.getDepartments()
    ]);

    return {
        categories: (categoriesRes.data?.data || []) as Category[],
        departments: (departmentsRes.data?.data || []) as Department[]
    };
}

export async function action({ request }: Route.ActionArgs) {
    const formData = await request.formData();
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;
    const department = formData.get("department") as string;
    const category = formData.get("category") as string;
    const subject = formData.get("subject") as string;
    const description = formData.get("description") as string;
    const image = formData.get("image") as File | null;

    if (!name || !department || !category || !subject || !description) {
        return { error: "All required fields must be filled" };
    }

    try {
        const newTicket = await createTicket({
            title: subject,
            description: description,
            priority: 'medium', // Default priority, to be set by admin later
            category: category,
            submitterName: name,
            submitterEmail: email,
            submitterPhone: phone,
            submitterDepartment: department,
        }, image && image.size > 0 ? image : undefined);

        if (!newTicket) {
            return { error: "Failed to create ticket." };
        }

        return { success: true, ticketId: newTicket.id };
    } catch (error) {
        console.error("Failed to create ticket:", error);
        return { error: "Failed to create ticket. Please try again later." };
    }
}

export default function SubmitTicket({ actionData, loaderData }: Route.ComponentProps) {
    const { categories, departments } = loaderData;
    const navigate = useNavigate();
    const [imagePreview, setImagePreview] = React.useState<string | null>(null);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        } else {
            setImagePreview(null);
        }
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerContent}>
                    <Link to="/" className={styles.backLink}>
                        <ArrowLeft size={20} />
                        Back to Home
                    </Link>
                    <div className={styles.headerTitle}>
                        <TicketPlus size={28} className={styles.headerIcon} />
                        <h1>Submit Support Request</h1>
                    </div>
                </div>
            </header>

            <main className={styles.main}>
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
                            <div className={styles.ticketId}>{actionData.ticketId}</div>
                            <p className={styles.successHint}>
                                Please save this ID to track your ticket status. We've also sent a confirmation to your email.
                            </p>
                            <div className={styles.successActions}>
                                <Button onClick={() => navigate(`/ticket/${actionData.ticketId}`)}>
                                    Track This Ticket
                                </Button>
                                <Button variant="outline" onClick={() => navigate("/")}>
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
                                <Form method="post" encType="multipart/form-data" className={styles.form}>
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
                                                    className={styles.input}
                                                />
                                            </div>

                                            <div className={styles.formGroup}>
                                                <Label htmlFor="email" className={styles.label}>
                                                    <Mail size={14} />
                                                    Email Address
                                                </Label>
                                                <Input
                                                    id="email"
                                                    name="email"
                                                    type="email"
                                                    placeholder="john@company.com"
                                                    className={styles.input}
                                                />
                                            </div>

                                            <div className={styles.formGroup}>
                                                <Label htmlFor="phone" className={styles.label}>
                                                    <Phone size={14} />
                                                    Phone Number
                                                </Label>
                                                <Input
                                                    id="phone"
                                                    name="phone"
                                                    type="tel"
                                                    placeholder="+62 812 3456 7890"
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
                                            <Label htmlFor="category" className={styles.label}>
                                                <Tag size={14} />
                                                Category *
                                            </Label>
                                            <Select name="category" required>
                                                <SelectTrigger className={styles.select}>
                                                    <SelectValue placeholder="Select Category" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {categories.filter(c => c.isActive).map((c) => (
                                                        <SelectItem key={c.id} value={c.name}>
                                                            {c.name}
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
                                            />
                                        </div>

                                        <div className={styles.formGroup}>
                                            <Label htmlFor="image" className={styles.label}>
                                                <ImageIcon size={14} />
                                                Attachment Image (Optional)
                                            </Label>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                                                {imagePreview && (
                                                    <div style={{ position: 'relative', width: 'fit-content', marginTop: 8 }}>
                                                        <img
                                                            src={imagePreview}
                                                            alt="Preview"
                                                            style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setImagePreview(null);
                                                                const fileInput = document.getElementById('image') as HTMLInputElement;
                                                                if (fileInput) fileInput.value = '';
                                                            }}
                                                            style={{
                                                                position: 'absolute',
                                                                top: -10,
                                                                right: -10,
                                                                background: '#ef4444',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '50%',
                                                                width: 24,
                                                                height: 24,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                cursor: 'pointer',
                                                                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                                                zIndex: 10
                                                            }}
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className={styles.formActions}>
                                        <Button type="button" variant="outline" onClick={() => navigate("/")}>
                                            Cancel
                                        </Button>
                                        <Button type="submit" className={styles.submitButton}>
                                            <TicketPlus size={18} />
                                            Submit Ticket
                                        </Button>
                                    </div>
                                </Form>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </main>
        </div>
    );
}
