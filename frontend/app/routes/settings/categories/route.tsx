/**
 * route.tsx — Categories Settings
 *
 * Halaman pengaturan kategori ticket.
 * Mendukung operasi CRUD untuk master data category.
 * 
 * @module settings/categories
 */

import { useState } from "react";
import { Form, useLoaderData, useActionData } from "react-router";
import type { Route } from "./+types/route";
import { Button } from "~/components/ui/button/button";
import { Input } from "~/components/ui/input/input";
import { Label } from "~/components/ui/label/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "~/components/ui/dialog/dialog";
import { Alert, AlertDescription } from "~/components/ui/alert/alert";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { settingsApi } from "~/services/settings.service";
import styles from "../style.module.css";
import type { Category } from "~/services/settings.service";

export async function loader({ request }: Route.LoaderArgs) {
    const response = await settingsApi.getCategories();
    return Response.json({ categories: response.data?.data || [] });
}

export async function action({ request }: Route.ActionArgs) {
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "create") {
        const name = formData.get("name") as string;
        const description = formData.get("description") as string;
        const isActive = formData.get("isActive") === "true";

        if (!name) return Response.json({ error: "Category name is required" }, { status: 400 });

        const response = await settingsApi.createCategory({ name, description, isActive });
        if (!response.success) return { error: response.error };
        return { success: true };
    }

    if (intent === "update") {
        const id = formData.get("id") as string;
        const name = formData.get("name") as string;
        const description = formData.get("description") as string;
        const isActive = formData.get("isActive") === "true";

        if (!id || !name) return Response.json({ error: "ID and Name are required" }, { status: 400 });

        const response = await settingsApi.updateCategory(id, { name, description, isActive });
        if (!response.success) return Response.json({ error: response.error }, { status: 400 });
        return Response.json({ success: true }, { status: 200 });
    }

    if (intent === "delete") {
        const id = formData.get("id") as string;
        const response = await settingsApi.deleteCategory(id);
        if (!response.success) return Response.json({ error: response.error }, { status: 400 });
        return Response.json({ success: true }, { status: 200 });
    }

    return null;
}

export default function CategoriesSettings() {
    const { categories } = useLoaderData() as { categories: Category[] };
    const actionData = useActionData() as { error?: string; success?: boolean } | undefined;
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);

    const openCreateDialog = () => {
        setEditingCategory(null);
        setIsDialogOpen(true);
    };

    const openEditDialog = (category: Category) => {
        setEditingCategory(category);
        setIsDialogOpen(true);
    };

    return (
        <div>
            <div className={styles.pageHeader}>
                <div className={styles.actionHeader}>
                    <div>
                        <h1 className={styles.pageTitle}>Ticket Categories</h1>
                        <p className={styles.pageDescription}>Manage the categories available for support tickets.</p>
                    </div>
                    <Button onClick={openCreateDialog}>
                        <Plus size={16} style={{ marginRight: 8 }} />
                        Add Category
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
                    {categories.length === 0 ? (
                        <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-neutral-10)' }}>
                            No categories found. Create one to get started.
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
                                                    <th>Name</th>
                                                    <th>Description</th>
                                                    <th>Status</th>
                                                    <th>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {categories.map((category) => (
                                                    <tr key={category.id}>
                                                        <td style={{ fontWeight: 500 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                <Tag size={14} />
                                                                {category.name}
                                                            </div>
                                                        </td>
                                                        <td>{category.description || '-'}</td>
                                                        <td>
                                                            <span className={category.isActive !== false ? styles.statusActive : styles.statusInactive}>
                                                                {category.isActive !== false ? 'Active' : 'Inactive'}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <div style={{ display: 'flex', gap: 8 }}>
                                                                <Button variant="outline" size="sm" onClick={() => openEditDialog(category)}>
                                                                    <Pencil size={14} />
                                                                </Button>
                                                                <Form method="post" onSubmit={(e) => {
                                                                    if (!confirm('Are you sure you want to delete this category?')) {
                                                                        e.preventDefault();
                                                                    }
                                                                }}>
                                                                    <input type="hidden" name="intent" value="delete" />
                                                                    <input type="hidden" name="id" value={category.id} />
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
                                {categories.map((category) => (
                                    <div key={category.id} className={styles.settingCard}>
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
                                                    <Tag size={15} style={{ color: "#60a5fa" }} />
                                                </div>
                                                <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                                                    <span className={styles.settingCardTitle}>{category.name}</span>
                                                    <span className={category.isActive !== false ? styles.statusActive : styles.statusInactive} style={{ fontSize: "0.72rem" }}>
                                                        ● {category.isActive !== false ? 'Active' : 'Inactive'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className={styles.settingCardActions}>
                                                <button
                                                    type="button"
                                                    className={styles.settingCardActionBtn}
                                                    onClick={() => openEditDialog(category)}
                                                    title="Edit category"
                                                >
                                                    <Pencil size={13} />
                                                </button>
                                                <Form method="post" onSubmit={(e) => {
                                                    if (!confirm('Are you sure you want to delete this category?')) {
                                                        e.preventDefault();
                                                    }
                                                }}>
                                                    <input type="hidden" name="intent" value="delete" />
                                                    <input type="hidden" name="id" value={category.id} />
                                                    <button
                                                        type="submit"
                                                        className={styles.settingCardActionBtnDanger}
                                                        title="Delete category"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </Form>
                                            </div>
                                        </div>

                                        {category.description && (
                                            <div className={styles.settingCardBody} style={{ paddingTop: 2 }}>
                                                <p className={styles.settingCardDesc}>
                                                    {category.description}
                                                </p>
                                            </div>
                                        )}
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
                        <DialogTitle>{editingCategory ? 'Edit Category' : 'Create Category'}</DialogTitle>
                    </DialogHeader>
                    <Form method="post" onSubmit={() => setIsDialogOpen(false)}>
                        <input type="hidden" name="intent" value={editingCategory ? "update" : "create"} />
                        {editingCategory && <input type="hidden" name="id" value={editingCategory.id} />}

                    <div className={styles.modalContent}>
                        <div className={styles.formGrid}>
                            <div className={`${styles.formFullWidth} space-y-2`}>
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    defaultValue={editingCategory?.name}
                                    required
                                />
                            </div>
                            <div className={`${styles.formFullWidth} space-y-2`}>
                                <Label htmlFor="description">Description (Optional)</Label>
                                <Input
                                    id="description"
                                    name="description"
                                    defaultValue={editingCategory?.description}
                                />
                            </div>
                            <div className={`${styles.formFullWidth}`} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    name="isActive"
                                    value="true"
                                    defaultChecked={editingCategory ? editingCategory.isActive !== false : true}
                                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                                />
                                <Label htmlFor="isActive" style={{ cursor: 'pointer', margin: 0, fontWeight: 500 }}>
                                    Active Status
                                </Label>
                            </div>
                        </div>
                    </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                            <Button type="submit">{editingCategory ? 'Save Changes' : 'Create'}</Button>
                        </DialogFooter>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
