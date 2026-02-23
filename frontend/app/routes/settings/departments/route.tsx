import { useState } from "react";
import { Form, useLoaderData, useActionData } from "react-router";
import type { Route } from "./+types/route";
import { Button } from "~/components/ui/button/button";
import { Input } from "~/components/ui/input/input";
import { Label } from "~/components/ui/label/label";
import { Card, CardContent } from "~/components/ui/card/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "~/components/ui/dialog/dialog";
import { Alert, AlertDescription } from "~/components/ui/alert/alert";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { settingsApi } from "~/services/settings.service";
import styles from "../style.module.css";
import type { Department } from "~/services/settings.service";

export async function loader({ request }: Route.LoaderArgs) {
    const response = await settingsApi.getDepartments();
    return { departments: response.data?.data || [] };
}

export async function action({ request }: Route.ActionArgs) {
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "create") {
        const name = formData.get("name") as string;
        const code = formData.get("code") as string;
        const description = formData.get("description") as string;

        if (!name) return { error: "Department name is required" };

        const response = await settingsApi.createDepartment({ name, code, description, isActive: true });
        if (!response.success) return { error: response.error };
        return { success: true };
    }

    if (intent === "update") {
        const id = formData.get("id") as string;
        const name = formData.get("name") as string;
        const code = formData.get("code") as string;
        const description = formData.get("description") as string;
        const isActive = formData.get("isActive") === "true";

        if (!id || !name) return { error: "ID and Name are required" };

        const response = await settingsApi.updateDepartment(id, { name, code, description, isActive });
        if (!response.success) return { error: response.error };
        return { success: true };
    }

    if (intent === "delete") {
        const id = formData.get("id") as string;
        const response = await settingsApi.deleteDepartment(id);
        if (!response.success) return { error: response.error };
        return { success: true };
    }

    return null;
}

export default function DepartmentsSettings() {
    const { departments } = useLoaderData() as { departments: Department[] };
    const actionData = useActionData() as { error?: string; success?: boolean } | undefined;
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);

    const openCreateDialog = () => {
        setEditingDepartment(null);
        setIsDialogOpen(true);
    };

    const openEditDialog = (department: Department) => {
        setEditingDepartment(department);
        setIsDialogOpen(true);
    };

    return (
        <div>
            <div className={styles.pageHeader}>
                <div className={styles.actionHeader}>
                    <div>
                        <h1 className={styles.pageTitle}>Departments</h1>
                        <p className={styles.pageDescription}>Manage the departments for ticket submission.</p>
                    </div>
                    <Button onClick={openCreateDialog}>
                        <Plus size={16} style={{ marginRight: 8 }} />
                        Add Department
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
                    {departments.length === 0 ? (
                        <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-neutral-10)' }}>
                            No departments found. Create one to get started.
                        </div>
                    ) : (
                        <table className={styles.dataTable}>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Code (ID Prefix)</th>
                                    <th>Description</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {departments.map((department) => (
                                    <tr key={department.id}>
                                        <td style={{ fontWeight: 500 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <Building2 size={14} />
                                                {department.name}
                                            </div>
                                        </td>
                                        <td>
                                            <code style={{
                                                backgroundColor: 'var(--color-primary-2)',
                                                color: 'var(--color-primary-9)',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                fontSize: '0.85rem'
                                            }}>
                                                {department.code || '-'}
                                            </code>
                                        </td>
                                        <td>{department.description || '-'}</td>
                                        <td>
                                            <span className={department.isActive ? styles.statusActive : styles.statusInactive}>
                                                {department.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <Button variant="outline" size="sm" onClick={() => openEditDialog(department)}>
                                                    <Pencil size={14} />
                                                </Button>
                                                <Form method="post" onSubmit={(e) => {
                                                    if (!confirm('Are you sure you want to delete this department?')) {
                                                        e.preventDefault();
                                                    }
                                                }}>
                                                    <input type="hidden" name="intent" value="delete" />
                                                    <input type="hidden" name="id" value={department.id} />
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
                    )}
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingDepartment ? 'Edit Department' : 'Create Department'}</DialogTitle>
                    </DialogHeader>
                    <Form method="post" onSubmit={() => setIsDialogOpen(false)}>
                        <input type="hidden" name="intent" value={editingDepartment ? "update" : "create"} />
                        {editingDepartment && <input type="hidden" name="id" value={editingDepartment.id} />}
                        {editingDepartment && <input type="hidden" name="isActive" value={String(editingDepartment.isActive)} />}

                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    defaultValue={editingDepartment?.name}
                                    placeholder="e.g. Information Technology"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="code">Code (ID Prefix)</Label>
                                <Input
                                    id="code"
                                    name="code"
                                    defaultValue={editingDepartment?.code}
                                    placeholder="e.g. IT"
                                    maxLength={10}
                                />
                                <p style={{ fontSize: '0.75rem', color: 'var(--color-neutral-9)' }}>
                                    This code will be used as a prefix for ticket IDs (e.g., IT-001).
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Description (Optional)</Label>
                                <Input
                                    id="description"
                                    name="description"
                                    defaultValue={editingDepartment?.description}
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                            <Button type="submit">{editingDepartment ? 'Save Changes' : 'Create'}</Button>
                        </DialogFooter>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
