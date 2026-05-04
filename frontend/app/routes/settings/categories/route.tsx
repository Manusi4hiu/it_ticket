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
    return { categories: response.data?.data || [] };
}

export async function action({ request }: Route.ActionArgs) {
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "create") {
        const name = formData.get("name") as string;
        const description = formData.get("description") as string;

        if (!name) return { error: "Category name is required" };

        const response = await settingsApi.createCategory({ name, description, isActive: true });
        if (!response.success) return { error: response.error };
        return { success: true };
    }

    if (intent === "update") {
        const id = formData.get("id") as string;
        const name = formData.get("name") as string;
        const description = formData.get("description") as string;
        const isActive = formData.get("isActive") === "true";

        if (!id || !name) return { error: "ID and Name are required" };

        const response = await settingsApi.updateCategory(id, { name, description, isActive });
        if (!response.success) return { error: response.error };
        return { success: true };
    }

    if (intent === "delete") {
        const id = formData.get("id") as string;
        const response = await settingsApi.deleteCategory(id);
        if (!response.success) return { error: response.error };
        return { success: true };
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

            <Card>
                <CardContent>
                    {categories.length === 0 ? (
                        <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-neutral-10)' }}>
                            No categories found. Create one to get started.
                        </div>
                    ) : (
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
                                            <span className={category.isActive ? styles.statusActive : styles.statusInactive}>
                                                {category.isActive ? 'Active' : 'Inactive'}
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
                        {editingCategory && <input type="hidden" name="isActive" value={String(editingCategory.isActive)} />}

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
