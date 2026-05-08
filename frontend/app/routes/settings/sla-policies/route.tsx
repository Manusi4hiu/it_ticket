import { useState } from "react";
import { Form, useLoaderData, useActionData } from "react-router";
import type { Route } from "./+types/route";
import { Button } from "~/components/ui/button/button";
import { Input } from "~/components/ui/input/input";
import { Label } from "~/components/ui/label/label";
import { Card, CardContent } from "~/components/ui/card/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "~/components/ui/dialog/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select/select";
import { Alert, AlertDescription } from "~/components/ui/alert/alert";
import { Plus, Pencil, Trash2, Clock, ShieldCheck, Tag, Flag } from "lucide-react";
import { settingsApi } from "~/services/settings.service";
import styles from "../style.module.css";
import type { SLAPolicy, Priority, Category } from "~/services/settings.service";

export async function loader({ request }: Route.LoaderArgs) {
    const [policiesRes, prioritiesRes, categoriesRes] = await Promise.all([
        settingsApi.getSLAPolicies(),
        settingsApi.getPriorities(),
        settingsApi.getCategories()
    ]);

    return {
        policies: policiesRes.data?.data || [],
        priorities: prioritiesRes.data?.data || [],
        categories: categoriesRes.data?.data || []
    };
}

export async function action({ request }: Route.ActionArgs) {
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "create") {
        const priorityId = formData.get("priorityId") as string;
        const categoryId = formData.get("categoryId") as string;
        const responseTimeMinutes = parseInt(formData.get("responseTimeMinutes") as string);
        const resolutionTimeHours = parseInt(formData.get("resolutionTimeHours") as string);

        const response = await settingsApi.createSLAPolicy({
            priorityId: priorityId || undefined,
            categoryId: categoryId || undefined,
            responseTimeMinutes,
            resolutionTimeHours
        });
        if (!response.success) return { error: response.error };
        return { success: true };
    }

    if (intent === "update") {
        const id = formData.get("id") as string;
        const priorityId = formData.get("priorityId") as string;
        const categoryId = formData.get("categoryId") as string;
        const responseTimeMinutes = parseInt(formData.get("responseTimeMinutes") as string);
        const resolutionTimeHours = parseInt(formData.get("resolutionTimeHours") as string);

        const response = await settingsApi.updateSLAPolicy(id, {
            priorityId: priorityId || undefined,
            categoryId: categoryId || undefined,
            responseTimeMinutes,
            resolutionTimeHours
        });
        if (!response.success) return { error: response.error };
        return { success: true };
    }

    if (intent === "delete") {
        const id = formData.get("id") as string;
        const response = await settingsApi.deleteSLAPolicy(id);
        if (!response.success) return { error: response.error };
        return { success: true };
    }

    return null;
}

export default function SLAPoliciesSettings() {
    const { policies, priorities, categories } = useLoaderData() as { 
        policies: SLAPolicy[], 
        priorities: Priority[], 
        categories: Category[] 
    };
    const actionData = useActionData() as { error?: string; success?: boolean } | undefined;
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingPolicy, setEditingPolicy] = useState<SLAPolicy | null>(null);

    const openCreateDialog = () => {
        setEditingPolicy(null);
        setIsDialogOpen(true);
    };

    const openEditDialog = (policy: SLAPolicy) => {
        setEditingPolicy(policy);
        setIsDialogOpen(true);
    };

    return (
        <div>
            <div className={styles.pageHeader}>
                <div className={styles.actionHeader}>
                    <div>
                        <h1 className={styles.pageTitle}>SLA Policies</h1>
                        <p className={styles.pageDescription}>Manage granular Service Level Agreements for specific priority and category combinations.</p>
                    </div>
                    <Button onClick={openCreateDialog} className={styles.headerButton}>
                        <Plus size={16} />
                        Add Policy
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
                    {policies.length === 0 ? (
                        <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-neutral-10)' }}>
                            <ShieldCheck size={48} style={{ marginBottom: 16, opacity: 0.2, display: 'block', margin: '0 auto' }} />
                            <p>No custom SLA policies found. The system will use default priority SLAs.</p>
                        </div>
                    ) : (
                        <div className={styles.tableContainer}>
                            <div className={styles.scrollableArea}>
                                <table className={styles.dataTable}>
                                    <thead>
                                        <tr>
                                            <th>Priority</th>
                                            <th>Category</th>
                                            <th>Response Time</th>
                                            <th>Resolution Time</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {policies.map((policy) => (
                                            <tr key={policy.id}>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <Flag size={14} />
                                                        {policy.priorityName || 'All Priorities'}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <Tag size={14} />
                                                        {policy.categoryName || 'All Categories'}
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={styles.badge} style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#93c5fd' }}>
                                                        {policy.responseTimeMinutes}m
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={styles.badge} style={{ background: 'rgba(29, 78, 216, 0.1)', color: '#c4b5fd' }}>
                                                        {policy.resolutionTimeHours}h
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: 10 }}>
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm" 
                                                            onClick={() => openEditDialog(policy)}
                                                            style={{ 
                                                                borderColor: 'rgba(59, 130, 246, 0.3)',
                                                                background: 'rgba(59, 130, 246, 0.05)',
                                                                color: '#93c5fd',
                                                                padding: '8px'
                                                            }}
                                                        >
                                                            <Pencil size={16} />
                                                        </Button>
                                                        <Form method="post" onSubmit={(e) => {
                                                            if (!confirm('Are you sure you want to delete this SLA policy?')) {
                                                                e.preventDefault();
                                                            }
                                                        }}>
                                                            <input type="hidden" name="intent" value="delete" />
                                                            <input type="hidden" name="id" value={policy.id} />
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
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingPolicy ? 'Edit SLA Policy' : 'Create SLA Policy'}</DialogTitle>
                    </DialogHeader>
                    <Form method="post" onSubmit={() => setIsDialogOpen(false)}>
                        <input type="hidden" name="intent" value={editingPolicy ? "update" : "create"} />
                        {editingPolicy && <input type="hidden" name="id" value={editingPolicy.id} />}

                        <div className={styles.modalContent} key={editingPolicy?.id || 'new'}>
                            <div className={styles.formGrid}>
                                <div className="space-y-2">
                                    <Label htmlFor="priorityId">Priority (Optional)</Label>
                                    <Select name="priorityId" defaultValue={editingPolicy?.priorityId || ""}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="All Priorities" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="">All Priorities</SelectItem>
                                            {priorities.map(p => (
                                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="categoryId">Category (Optional)</Label>
                                    <Select name="categoryId" defaultValue={editingPolicy?.categoryId || ""}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="All Categories" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="">All Categories</SelectItem>
                                            {categories.map(c => (
                                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="responseTimeMinutes">SLA Response (Minutes)</Label>
                                    <Input 
                                        id="responseTimeMinutes" 
                                        name="responseTimeMinutes" 
                                        type="number" 
                                        min="1" 
                                        defaultValue={editingPolicy?.responseTimeMinutes ?? 60} 
                                        required 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="resolutionTimeHours">SLA Resolution (Hours)</Label>
                                    <Input 
                                        id="resolutionTimeHours" 
                                        name="resolutionTimeHours" 
                                        type="number" 
                                        min="1" 
                                        defaultValue={editingPolicy?.resolutionTimeHours ?? 24} 
                                        required 
                                    />
                                </div>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                            <Button type="submit">{editingPolicy ? 'Save Changes' : 'Create'}</Button>
                        </DialogFooter>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
