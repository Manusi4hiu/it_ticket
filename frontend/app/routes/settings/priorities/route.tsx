import { useState } from "react";
import { Form, useLoaderData, useActionData } from "react-router";
import type { Route } from "./+types/route";
import { Button } from "~/components/ui/button/button";
import { Input } from "~/components/ui/input/input";
import { Label } from "~/components/ui/label/label";
import { Card, CardContent } from "~/components/ui/card/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "~/components/ui/dialog/dialog";
import { Alert, AlertDescription } from "~/components/ui/alert/alert";
import { Plus, Pencil, Trash2, Flag, Circle } from "lucide-react";
import { settingsApi } from "~/services/settings.service";
import styles from "../style.module.css";
import type { Priority } from "~/services/settings.service";

export async function loader({ request }: Route.LoaderArgs) {
    const response = await settingsApi.getPriorities();
    return { priorities: response.data?.data || [] };
}

export async function action({ request }: Route.ActionArgs) {
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "create") {
        const name = formData.get("name") as string;
        const slaHours = parseInt(formData.get("slaHours") as string);
        const responseTimeMinutes = parseInt(formData.get("responseTimeMinutes") as string);
        const level = parseInt(formData.get("level") as string);
        const color = formData.get("color") as string;
        const description = formData.get("description") as string;

        if (!name) return { error: "Name is required" };

        const response = await settingsApi.createPriority({
            name, slaHours, responseTimeMinutes, level, color, description, isActive: true
        });
        if (!response.success) return { error: response.error };
        return { success: true };
    }

    if (intent === "update") {
        const id = formData.get("id") as string;
        const name = formData.get("name") as string;
        const slaHours = parseInt(formData.get("slaHours") as string);
        const responseTimeMinutes = parseInt(formData.get("responseTimeMinutes") as string);
        const level = parseInt(formData.get("level") as string);
        const color = formData.get("color") as string;
        const description = formData.get("description") as string;
        const isActive = formData.get("isActive") === "true";

        if (!id || !name) return { error: "ID and Name are required" };

        const response = await settingsApi.updatePriority(id, {
            name, slaHours, responseTimeMinutes, level, color, description, isActive
        });
        if (!response.success) return { error: response.error };
        return { success: true };
    }

    if (intent === "delete") {
        const id = formData.get("id") as string;
        const response = await settingsApi.deletePriority(id);
        if (!response.success) return { error: response.error };
        return { success: true };
    }

    return null;
}

export default function PrioritiesSettings() {
    const { priorities } = useLoaderData() as { priorities: Priority[] };
    const actionData = useActionData() as { error?: string; success?: boolean } | undefined;
    const [selectedColor, setSelectedColor] = useState("#6366f1");
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingPriority, setEditingPriority] = useState<Priority | null>(null);

    const openCreateDialog = () => {
        setEditingPriority(null);
        setSelectedColor("#6366f1");
        setIsDialogOpen(true);
    };

    const openEditDialog = (priority: Priority) => {
        setEditingPriority(priority);
        setSelectedColor(priority.color);
        setIsDialogOpen(true);
    };

    return (
        <div>
            <div className={styles.pageHeader}>
                <div className={styles.actionHeader}>
                    <div>
                        <h1 className={styles.pageTitle}>Priorities & SLA</h1>
                        <p className={styles.pageDescription}>Manage priorities and their default Service Level Agreements (SLA).</p>
                    </div>
                    <Button onClick={openCreateDialog} className={styles.headerButton}>
                        <Plus size={16} />
                        Add Priority
                    </Button>
                </div>
            </div>

            {actionData?.error && (
                <Alert variant="destructive" style={{ marginBottom: 16 }}>
                    <AlertDescription>{actionData.error}</AlertDescription>
                </Alert>
            )}

            <Card>
                <CardContent>
                    {priorities.length === 0 ? (
                        <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-neutral-10)' }}>
                            No priorities found.
                        </div>
                    ) : (
                        <div className={styles.tableContainer}>
                            <table className={styles.dataTable}>
                                <thead>
                                    <tr>
                                        <th style={{ width: 50 }}>Lvl</th>
                                        <th>Name</th>
                                        <th>SLA (Hours)</th>
                                        <th>Resp. (Minutes)</th>
                                        <th>Color</th>
                                        <th>Description</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {priorities.map((priority) => (
                                        <tr key={priority.id}>
                                            <td>{priority.level}</td>
                                            <td style={{ fontWeight: 600, color: 'white' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                    <div style={{ 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        justifyContent: 'center',
                                                        width: 36, 
                                                        height: 36, 
                                                        borderRadius: 10, 
                                                        background: `${priority.color}20`, 
                                                        border: `1px solid ${priority.color}40`,
                                                        boxShadow: `0 0 15px ${priority.color}15`
                                                    }}>
                                                        <Flag size={18} color={priority.color} fill={`${priority.color}40`} />
                                                    </div>
                                                    {priority.name}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={styles.badge} style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#a5b4fc' }}>
                                                    {priority.slaHours}h
                                                </span>
                                            </td>
                                            <td>
                                                <span className={styles.badge} style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#c4b5fd' }}>
                                                    {priority.responseTimeMinutes}m
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{
                                                        width: 24,
                                                        height: 24,
                                                        backgroundColor: priority.color,
                                                        borderRadius: 6,
                                                        border: '2px solid rgba(255, 255, 255, 0.1)',
                                                        boxShadow: `0 0 10px ${priority.color}40`
                                                    }} />
                                                    <code className={styles.code} style={{ fontSize: '0.75rem' }}>{priority.color.toUpperCase()}</code>
                                                </div>
                                            </td>
                                            <td>{priority.description || '-'}</td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 10 }}>
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        onClick={() => openEditDialog(priority)}
                                                        style={{ 
                                                            borderColor: 'rgba(99, 102, 241, 0.3)',
                                                            background: 'rgba(99, 102, 241, 0.05)',
                                                            color: '#a5b4fc',
                                                            padding: '8px'
                                                        }}
                                                    >
                                                        <Pencil size={16} />
                                                    </Button>
                                                    <Form method="post" onSubmit={(e) => {
                                                        if (!confirm('Are you sure you want to delete this priority?')) {
                                                            e.preventDefault();
                                                        }
                                                    }}>
                                                        <input type="hidden" name="intent" value="delete" />
                                                        <input type="hidden" name="id" value={priority.id} />
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm" 
                                                            style={{ 
                                                                borderColor: 'rgba(239, 68, 68, 0.3)',
                                                                background: 'rgba(239, 68, 68, 0.05)',
                                                                color: '#f87171',
                                                                padding: '8px'
                                                            }}
                                                        >
                                                            <Trash2 size={16} />
                                                        </Button>
                                                    </Form>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingPriority ? 'Edit Priority' : 'Create Priority'}</DialogTitle>
                    </DialogHeader>
                    <Form method="post" onSubmit={() => setIsDialogOpen(false)}>
                        <input type="hidden" name="intent" value={editingPriority ? "update" : "create"} />
                        {editingPriority && <input type="hidden" name="id" value={editingPriority.id} />}

                    <div className={styles.modalContent} key={editingPriority?.id || 'new'}>
                        <div className={styles.formGrid}>
                            <div className="space-y-2">
                                <Label htmlFor="name">Name</Label>
                                <Input id="name" name="name" defaultValue={editingPriority?.name} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="level">Level (1=Critical)</Label>
                                <Input id="level" name="level" type="number" min="1" defaultValue={editingPriority?.level ?? 1} required />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="slaHours">SLA Resolution (Hours)</Label>
                                <Input id="slaHours" name="slaHours" type="number" min="1" defaultValue={editingPriority?.slaHours ?? 24} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="responseTimeMinutes">SLA Response (Minutes)</Label>
                                <Input id="responseTimeMinutes" name="responseTimeMinutes" type="number" min="1" defaultValue={editingPriority?.responseTimeMinutes ?? 60} required />
                            </div>
                            
                            <div className={`${styles.formFullWidth} space-y-2`}>
                                <Label htmlFor="color">Color Code (Hex)</Label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <Input 
                                        id="color" 
                                        name="color" 
                                        type="color" 
                                        value={selectedColor} 
                                        onChange={(e) => setSelectedColor(e.target.value)}
                                        style={{ width: 60, padding: 2, height: 40 }} 
                                    />
                                    <Input 
                                        id="colorText" 
                                        value={selectedColor} 
                                        onChange={(e) => setSelectedColor(e.target.value)}
                                        placeholder="#000000" 
                                    />
                                </div>
                            </div>

                            <div className={`${styles.formFullWidth} space-y-2`}>
                                <Label htmlFor="description">Description</Label>
                                <Input id="description" name="description" defaultValue={editingPriority?.description} />
                            </div>

                            <div className={styles.formFullWidth} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                                <input 
                                    type="checkbox" 
                                    id="isActive" 
                                    name="isActive" 
                                    value="true"
                                    defaultChecked={editingPriority ? editingPriority.isActive : true}
                                />
                                <Label htmlFor="isActive">Active</Label>
                            </div>
                        </div>
                    </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                            <Button type="submit">{editingPriority ? 'Save Changes' : 'Create'}</Button>
                        </DialogFooter>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
