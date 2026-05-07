import { useState } from "react";
import { Form, useLoaderData, useActionData } from "react-router";
import type { Route } from "./+types/route";
import { Button } from "~/components/ui/button/button";
import { Input } from "~/components/ui/input/input";
import { Label } from "~/components/ui/label/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "~/components/ui/dialog/dialog";
import { Alert, AlertDescription } from "~/components/ui/alert/alert";
import { Plus, Pencil, Trash2, ClipboardList, Check, Circle } from "lucide-react";
import { settingsApi } from "~/services/settings.service";
import styles from "../style.module.css";
import type { Status } from "~/services/settings.service";

export async function loader({ request }: Route.LoaderArgs) {
    const response = await settingsApi.getStatuses();
    return { statuses: response.data?.data || [] };
}

export async function action({ request }: Route.ActionArgs) {
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "create") {
        const name = formData.get("name") as string;
        const color = formData.get("color") as string;
        const order = parseInt(formData.get("order") as string) || 0;
        const isDefault = formData.get("isDefault") === "true";

        if (!name) return { error: "Status name is required" };

        const response = await settingsApi.createStatus({ name, color, order, isDefault });
        if (!response.success) return { error: response.error };
        return { success: true };
    }

    if (intent === "update") {
        const id = formData.get("id") as string;
        const name = formData.get("name") as string;
        const color = formData.get("color") as string;
        const order = parseInt(formData.get("order") as string) || 0;
        const isDefault = formData.get("isDefault") === "true";

        if (!id || !name) return { error: "ID and Name are required" };

        const response = await settingsApi.updateStatus(id, { name, color, order, isDefault });
        if (!response.success) return { error: response.error };
        return { success: true };
    }

    if (intent === "delete") {
        const id = formData.get("id") as string;
        const response = await settingsApi.deleteStatus(id);
        if (!response.success) return { error: response.error };
        return { success: true };
    }

    return null;
}

export default function StatusesSettings() {
    const { statuses } = useLoaderData() as { statuses: Status[] };
    const actionData = useActionData() as { error?: string; success?: boolean } | undefined;
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingStatus, setEditingStatus] = useState<Status | null>(null);

    const openCreateDialog = () => {
        setEditingStatus(null);
        setIsDialogOpen(true);
    };

    const openEditDialog = (status: Status) => {
        setEditingStatus(status);
        setIsDialogOpen(true);
    };

    return (
        <div>
            <div className={styles.pageHeader}>
                <div className={styles.actionHeader}>
                    <div>
                        <h1 className={styles.pageTitle}>Ticket Statuses</h1>
                        <p className={styles.pageDescription}>Manage the workflow statuses for support tickets.</p>
                    </div>
                    <Button onClick={openCreateDialog}>
                        <Plus size={16} style={{ marginRight: 8 }} />
                        Add Status
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
                    {statuses.length === 0 ? (
                        <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-neutral-10)' }}>
                            No statuses found. Create one to get started.
                        </div>
                    ) : (
                        <div className={styles.tableContainer}>
                            <table className={styles.dataTable}>
                                <thead>
                                    <tr>
                                        <th>Order</th>
                                        <th>Status Name</th>
                                        <th>Color</th>
                                        <th>Default</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {statuses.map((status) => (
                                        <tr key={status.id}>
                                            <td style={{ width: 60 }}>{status.order}</td>
                                            <td style={{ fontWeight: 500 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <Circle size={12} fill={status.color} stroke={status.color} />
                                                    {status.name}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <div 
                                                        style={{ 
                                                            width: 20, 
                                                            height: 20, 
                                                            borderRadius: '50%', 
                                                            backgroundColor: status.color,
                                                            border: '1px solid var(--color-neutral-4)' 
                                                        }} 
                                                    />
                                                    <code style={{ fontSize: '0.8rem' }}>{status.color}</code>
                                                </div>
                                            </td>
                                            <td>
                                                {status.isDefault ? (
                                                    <span style={{ color: 'var(--color-primary-9)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                        <Check size={14} /> Yes
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <Button variant="outline" size="sm" onClick={() => openEditDialog(status)}>
                                                        <Pencil size={14} />
                                                    </Button>
                                                    <Form method="post" onSubmit={(e) => {
                                                        if (!confirm('Are you sure you want to delete this status?')) {
                                                            e.preventDefault();
                                                        }
                                                    }}>
                                                        <input type="hidden" name="intent" value="delete" />
                                                        <input type="hidden" name="id" value={status.id} />
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
                    )}
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingStatus ? 'Edit Status' : 'Create Status'}</DialogTitle>
                    </DialogHeader>
                    <Form method="post" onSubmit={() => setIsDialogOpen(false)}>
                        <input type="hidden" name="intent" value={editingStatus ? "update" : "create"} />
                        {editingStatus && <input type="hidden" name="id" value={editingStatus.id} />}

                    <div className={styles.modalContent}>
                        <div className={styles.formGrid}>
                            <div className={`${styles.formFullWidth} space-y-2`}>
                                <Label htmlFor="name">Status Name</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    defaultValue={editingStatus?.name}
                                    placeholder="e.g. In Progress"
                                    required
                                />
                            </div>
                            
                            <div className="space-y-2">
                                <Label htmlFor="color">Color</Label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <Input
                                        id="color"
                                        name="color"
                                        type="color"
                                        defaultValue={editingStatus?.color || "#6B7280"}
                                        style={{ width: 44, padding: 2, height: 40 }}
                                    />
                                    <Input
                                        type="text"
                                        defaultValue={editingStatus?.color || "#6B7280"}
                                        onChange={(e) => {
                                            const colorInput = document.getElementById('color') as HTMLInputElement;
                                            if (colorInput) colorInput.value = e.target.value;
                                        }}
                                        placeholder="#HEXCODE"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="order">Display Order</Label>
                                <Input
                                    id="order"
                                    name="order"
                                    type="number"
                                    defaultValue={editingStatus?.order || 0}
                                    required
                                />
                            </div>

                            <div className={styles.formFullWidth} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                                <input 
                                    type="checkbox" 
                                    id="isDefault" 
                                    name="isDefault" 
                                    value="true"
                                    defaultChecked={editingStatus?.isDefault}
                                />
                                <Label htmlFor="isDefault">Set as default for new tickets</Label>
                            </div>
                        </div>
                    </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                            <Button type="submit">{editingStatus ? 'Save Changes' : 'Create'}</Button>
                        </DialogFooter>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
