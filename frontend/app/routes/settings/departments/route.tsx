import { useState, useEffect, useRef } from "react";
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
    const response = await settingsApi.getDepartments(1, 5);
    return { initialDepartments: response.data?.data || [] };
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
    const { initialDepartments } = useLoaderData() as { initialDepartments: Department[] };
    const actionData = useActionData() as { error?: string; success?: boolean } | undefined;
    
    const [displayedDepartments, setDisplayedDepartments] = useState<Department[]>(initialDepartments);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(initialDepartments.length === 5);
    const [loading, setLoading] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const openCreateDialog = () => {
        setEditingDepartment(null);
        setIsDialogOpen(true);
    };

    const openEditDialog = (department: Department) => {
        setEditingDepartment(department);
        setIsDialogOpen(true);
    };

    const loadMore = async () => {
        if (loading || !hasMore) return;
        setLoading(true);
        const nextPage = page + 1;
        const response = await settingsApi.getDepartments(nextPage, 5);
        if (response.success && response.data?.data) {
            const newDeps = response.data.data;
            setDisplayedDepartments(prev => {
                const existingIds = new Set(prev.map(d => d.id));
                const filteredNew = newDeps.filter(d => !existingIds.has(d.id));
                return [...prev, ...filteredNew];
            });
            setPage(nextPage);
            if (newDeps.length < 5) {
                setHasMore(false);
            }
        } else {
            setHasMore(false);
        }
        setLoading(false);
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        if (target.scrollHeight - target.scrollTop <= target.clientHeight + 50) {
            loadMore();
        }
    };

    useEffect(() => {
        if (actionData?.success) {
            const reload = async () => {
                setLoading(true);
                const limitToFetch = page * 5;
                const response = await settingsApi.getDepartments(1, limitToFetch);
                if (response.success && response.data?.data) {
                    setDisplayedDepartments(response.data.data);
                    setHasMore(response.data.data.length >= limitToFetch);
                }
                setLoading(false);
            };
            reload();
        }
    }, [actionData]);

    useEffect(() => {
        const container = containerRef.current;
        if (container) {
            if (container.scrollHeight <= container.clientHeight && hasMore && !loading) {
                loadMore();
            }
        }
    }, [displayedDepartments, hasMore, loading]);

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
                    {displayedDepartments.length === 0 ? (
                        <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-neutral-10)' }}>
                            No departments found. Create one to get started.
                        </div>
                    ) : (
                        <div className={styles.tableContainer}>
                            <div ref={containerRef} className={styles.scrollableArea} onScroll={handleScroll} style={{ maxHeight: '280px' }}>
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
                                        {displayedDepartments.map((department) => (
                                            <tr key={department.id}>
                                                <td style={{ fontWeight: 500 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <Building2 size={14} />
                                                        {department.name}
                                                    </div>
                                                </td>
                                                <td>
                                                    <code className={styles.code}>
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
                                        {loading && (
                                            <tr>
                                                <td colSpan={5} style={{ textAlign: 'center', padding: '16px', color: 'var(--color-neutral-9)' }}>
                                                    Loading more departments...
                                                </td>
                                            </tr>
                                        )}
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
                        <DialogTitle>{editingDepartment ? 'Edit Department' : 'Create Department'}</DialogTitle>
                    </DialogHeader>
                    <Form method="post" onSubmit={() => setIsDialogOpen(false)}>
                        <input type="hidden" name="intent" value={editingDepartment ? "update" : "create"} />
                        {editingDepartment && <input type="hidden" name="id" value={editingDepartment.id} />}
                        {editingDepartment && <input type="hidden" name="isActive" value={String(editingDepartment.isActive)} />}

                    <div className={styles.modalContent}>
                        <div className={styles.formGrid}>
                            <div className={`${styles.formFullWidth} space-y-2`}>
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    defaultValue={editingDepartment?.name}
                                    placeholder="e.g. Information Technology"
                                    required
                                />
                            </div>
                            <div className={`${styles.formFullWidth} space-y-2`}>
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
                            <div className={`${styles.formFullWidth} space-y-2`}>
                                <Label htmlFor="description">Description (Optional)</Label>
                                <Input
                                    id="description"
                                    name="description"
                                    defaultValue={editingDepartment?.description}
                                />
                            </div>
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
