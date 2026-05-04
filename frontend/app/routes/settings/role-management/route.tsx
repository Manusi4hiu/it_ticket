import { useState } from "react";
import { User, UserPlus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select/select";
import { Button } from "~/components/ui/button/button";
import { Input } from "~/components/ui/input/input";
import { Label } from "~/components/ui/label/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "~/components/ui/dialog/dialog";
import { Card, CardContent } from "~/components/ui/card/card";
import { usersApi } from "~/services/api.service";
import type { Route } from "./+types/route";
import { useToast } from "~/hooks/use-toast";
import styles from "./style.module.css";
console.log(styles); // Prevent unused var error if I don't use all
import settingsStyles from "../style.module.css";
import { requireRole } from "~/services/session.service";

type UserRole = "Administrator" | "Management" | "Staff";

export async function loader({ request }: Route.LoaderArgs) {
    const session = await requireRole(request, ["Administrator"]);

    // Fetch users from API
    const response = await usersApi.getAll();
    const users = response.success && response.data ? response.data.users : [];

    return {
        session,
        users: users.map(u => ({
            id: u.id,
            email: u.email,
            username: u.username,
            name: u.full_name,
            role: u.role as UserRole,
        })),
    };
}

export default function RoleManagementSettings({ loaderData }: Route.ComponentProps) {
    const { toast } = useToast();
    const { session, users: initialUsers } = loaderData;

    const currentUser = {
        id: session.userId,
        name: session.userName,
        role: session.userRole,
    };

    const [userList, setUserList] = useState(initialUsers);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newUserForm, setNewUserForm] = useState({
        full_name: "",
        username: "",
        email: "",
        phone: "",
        password: "",
        role: "Staff" as UserRole,
    });
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    // Edit User State
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [editingUser, setEditingUser] = useState<typeof initialUsers[0] | null>(null);
    const [editUserForm, setEditUserForm] = useState({
        full_name: "",
        username: "",
        email: "",
        phone: "",
        password: "", // Optional for edit
    });
    const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({});

    // Delete User State
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [userToDelete, setUserToDelete] = useState<typeof initialUsers[0] | null>(null);

    const handleRoleChange = async (userId: string, newRole: UserRole) => {
        // Prevent changing own role
        if (userId === currentUser.id) {
            toast({
                title: "Action Not Allowed",
                description: "You cannot change your own role.",
                variant: "destructive",
            });
            return;
        }

        try {
            // Update via API
            const response = await usersApi.update(userId, { role: newRole });

            if (response.success) {
                setUserList((prevUsers) =>
                    prevUsers.map((user) => {
                        if (user.id === userId) {
                            toast({
                                title: "Role Updated",
                                description: `${user.name}'s role has been changed to ${newRole}.`,
                            });
                            return { ...user, role: newRole };
                        }
                        return user;
                    })
                );
            } else {
                toast({
                    title: "Error",
                    description: response.error || "Failed to update role",
                    variant: "destructive",
                });
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to update role",
                variant: "destructive",
            });
        }
    };

    const validateForm = () => {
        const errors: Record<string, string> = {};
        if (!newUserForm.full_name.trim()) {
            errors.full_name = "Full name is required";
        }
        if (!newUserForm.username.trim()) {
            errors.username = "Username is required";
        }
        if (newUserForm.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUserForm.email)) {
            errors.email = "Invalid email format";
        }
        if (!newUserForm.password) {
            errors.password = "Password is required";
        } else if (newUserForm.password.length < 6) {
            errors.password = "Password must be at least 6 characters";
        }
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleCreateUser = async () => {
        if (!validateForm()) return;

        setIsCreating(true);
        try {
            const response = await usersApi.create({
                full_name: newUserForm.full_name,
                username: newUserForm.username,
                email: newUserForm.email || null,
                phone: newUserForm.phone || null,
                password: newUserForm.password,
                role: newUserForm.role,
            });

            if (response.success && response.data) {
                const newUser = (response.data as { user: { id: string; email: string; username: string; full_name: string; role: string } }).user;
                setUserList(prev => [...prev, {
                    id: newUser.id,
                    email: newUser.email,
                    username: newUser.username,
                    name: newUser.full_name,
                    role: newUser.role as UserRole,
                }]);
                toast({
                    title: "User Created",
                    description: `${newUser.full_name} has been added as ${newUser.role}.`,
                });
                setShowCreateDialog(false);
                setNewUserForm({ full_name: "", username: "", email: "", phone: "", password: "", role: "Staff" });
                setFormErrors({});
            } else {
                toast({
                    title: "Error",
                    description: response.error || "Failed to create user",
                    variant: "destructive",
                });
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to create user",
                variant: "destructive",
            });
        } finally {
            setIsCreating(false);
        }
    };

    const openEditDialog = (user: typeof initialUsers[0]) => {
        setEditingUser(user);
        setEditUserForm({
            full_name: user.name,
            username: user.username,
            email: user.email || "",
            phone: (user as any).phone || "",
            password: "",
        });
        setEditFormErrors({});
        setShowEditDialog(true);
    };

    const validateEditForm = () => {
        const errors: Record<string, string> = {};
        if (!editUserForm.full_name.trim()) {
            errors.full_name = "Full name is required";
        }
        if (!editUserForm.username.trim()) {
            errors.username = "Username is required";
        }
        if (editUserForm.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editUserForm.email)) {
            errors.email = "Invalid email format";
        }
        if (editUserForm.password && editUserForm.password.length < 6) {
            errors.password = "Password must be at least 6 characters";
        }
        setEditFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleUpdateUser = async () => {
        if (!editingUser || !validateEditForm()) return;

        setIsUpdating(true);
        try {
            const updateData: { full_name: string; username: string; email?: string | null; phone?: string | null; password?: string } = {
                full_name: editUserForm.full_name,
                username: editUserForm.username,
                email: editUserForm.email || null,
                phone: editUserForm.phone || null,
            };

            // Only include password if it was provided
            if (editUserForm.password) {
                updateData.password = editUserForm.password;
            }

            const response = await usersApi.update(editingUser.id, updateData);

            if (response.success) {
                setUserList(prev => prev.map(user => {
                    if (user.id === editingUser.id) {
                        return {
                            ...user,
                            name: editUserForm.full_name,
                            username: editUserForm.username,
                            email: editUserForm.email,
                        };
                    }
                    return user;
                }));
                toast({
                    title: "User Updated",
                    description: `${editUserForm.full_name}'s information has been updated.`,
                });
                setShowEditDialog(false);
                setEditingUser(null);
            } else {
                toast({
                    title: "Error",
                    description: response.error || "Failed to update user",
                    variant: "destructive",
                });
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to update user",
                variant: "destructive",
            });
        } finally {
            setIsUpdating(false);
        }
    };

    const openDeleteDialog = (user: typeof initialUsers[0]) => {
        setUserToDelete(user);
        setShowDeleteDialog(true);
    };

    const handleDeleteUser = async () => {
        if (!userToDelete) return;

        setIsDeleting(true);
        try {
            const response = await usersApi.delete(userToDelete.id);

            if (response.success) {
                setUserList(prev => prev.filter(user => user.id !== userToDelete.id));
                toast({
                    title: "User Deleted",
                    description: `${userToDelete.name} has been removed from the system.`,
                });
                setShowDeleteDialog(false);
                setUserToDelete(null);
            } else {
                toast({
                    title: "Error",
                    description: response.error || "Failed to delete user",
                    variant: "destructive",
                });
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to delete user",
                variant: "destructive",
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const getRoleBadgeClass = (role: UserRole) => {
        switch (role) {
            case "Administrator":
                return styles.roleAdmin;
            case "Management":
                return styles.roleManagement;
            case "Staff":
                return styles.roleStaff;
            default:
                return "";
        }
    };

    return (
        <div>
            <div className={settingsStyles.actionHeader} style={{ marginBottom: "var(--space-6)" }}>
                <div>
                    <h1 className={settingsStyles.pageTitle}>Role Management</h1>
                    <p className={settingsStyles.pageDescription}>Manage user roles and permissions.</p>
                </div>
                <Button className={settingsStyles.headerButton} onClick={() => setShowCreateDialog(true)}>
                    <UserPlus style={{ width: "16px", height: "16px" }} />
                    Create User
                </Button>
            </div>

            <div className={styles.section}>
                <div className={styles.tableWrapper}>
                    <table className={styles.customTable}>
                        <thead>
                            <tr>
                                <th style={{ width: "20%" }}>User Information</th>
                                <th style={{ width: "12%" }}>Username</th>
                                <th style={{ width: "25%" }}>Email</th>
                                <th style={{ width: "13%" }}>Current Role</th>
                                <th style={{ width: "18%" }}>Change Role</th>
                                <th style={{ width: "12%" }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {userList.map((user) => (
                                <tr key={user.id}>
                                    <td>
                                        <div className={styles.userCell}>
                                            <div className={styles.userAvatar}>
                                                <User size={18} />
                                            </div>
                                            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                                                <span className={styles.userName}>
                                                    {user.name}
                                                </span>
                                                {user.id === currentUser.id && (
                                                    <span style={{ fontSize: "0.65rem", color: "#a5b4fc", fontWeight: 800, textTransform: "uppercase", marginTop: "2px" }}>
                                                        Logged In
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`${settingsStyles.code} ${styles.usernameBadge}`}>{user.username}</span>
                                    </td>
                                    <td>
                                        <span className={styles.userEmail}>{user.email}</span>
                                    </td>
                                    <td>
                                        <div className={`${styles.roleBadge} ${getRoleBadgeClass(user.role)}`}>
                                            {user.role}
                                        </div>
                                    </td>
                                    <td>
                                        {user.id === currentUser.id ? (
                                            <span style={{ opacity: 0.5, fontStyle: "italic", fontSize: "0.8rem", color: "rgba(255,255,255,0.6)" }}>Self transformation disabled</span>
                                        ) : (
                                            <Select
                                                value={user.role}
                                                onValueChange={(value) => handleRoleChange(user.id, value as UserRole)}
                                            >
                                                <SelectTrigger style={{ width: "130px", background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.1)", color: "white", height: "32px", borderRadius: "8px", fontSize: "0.8rem" }}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent style={{ background: '#1e1b4b', border: '1px solid rgba(255, 255, 255, 0.2)', color: 'white' }}>
                                                    <SelectItem value="Administrator">Administrator</SelectItem>
                                                    <SelectItem value="Management">Management</SelectItem>
                                                    <SelectItem value="Staff">Staff</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    </td>
                                    <td>
                                        <div style={{ display: "flex", gap: "8px" }}>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => openEditDialog(user)}
                                                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white", width: "32px", height: "32px", padding: 0 }}
                                            >
                                                <Pencil size={14} />
                                            </Button>
                                            {user.id !== currentUser.id && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => openDeleteDialog(user)}
                                                    style={{ color: "#f87171", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", width: "32px", height: "32px", padding: 0 }}
                                                >
                                                    <Trash2 size={14} />
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className={styles.infoSection}>
                <h3 className={styles.infoTitle}>Role Permissions</h3>
                <div className={styles.roleDescriptions}>
                    <div className={styles.roleDescription}>
                        <div className={`${styles.roleLabel} ${styles.roleAdmin}`}>Administrator</div>
                        <ul className={styles.permissionList}>
                            <li>Full access to all features</li>
                            <li>Can manage user roles</li>
                            <li>Can assign and take tickets</li>
                            <li>Can view all reports and analytics</li>
                        </ul>
                    </div>

                    <div className={styles.roleDescription}>
                        <div className={`${styles.roleLabel} ${styles.roleManagement}`}>Management</div>
                        <ul className={styles.permissionList}>
                            <li>View-only access to dashboard and tickets</li>
                            <li>Cannot assign or take tickets</li>
                            <li>Cannot change ticket status</li>
                            <li>Full access to reports and analytics</li>
                        </ul>
                    </div>

                    <div className={styles.roleDescription}>
                        <div className={`${styles.roleLabel} ${styles.roleStaff}`}>Staff</div>
                        <ul className={styles.permissionList}>
                            <li>Can view and manage tickets</li>
                            <li>Can take and be assigned tickets</li>
                            <li>Can change ticket status</li>
                            <li>Can view reports and analytics</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Create User Dialog */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent style={{ maxWidth: "600px" }}>
                    <DialogHeader>
                        <DialogTitle style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <UserPlus style={{ width: "20px", height: "20px" }} />
                            Create New User
                        </DialogTitle>
                        <DialogDescription>
                            Add a new user to the system and assign their role.
                        </DialogDescription>
                    </DialogHeader>

                    <div className={styles.modalContent}>
                        <div className={styles.formGrid}>
                            <div className={`${styles.formFullWidth} space-y-2`}>
                                <Label htmlFor="fullName">Full Name *</Label>
                                <Input
                                    id="fullName"
                                    placeholder="John Doe"
                                    value={newUserForm.full_name}
                                    onChange={(e) => setNewUserForm(prev => ({ ...prev, full_name: e.target.value }))}
                                    style={formErrors.full_name ? { borderColor: "var(--color-error-8)" } : {}}
                                />
                                {formErrors.full_name && (
                                    <span style={{ color: "var(--color-error-11)", fontSize: "var(--font-size-0)" }}>
                                        {formErrors.full_name}
                                    </span>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="username">Username *</Label>
                                <Input
                                    id="username"
                                    placeholder="johndoe"
                                    value={newUserForm.username}
                                    onChange={(e) => setNewUserForm(prev => ({ ...prev, username: e.target.value }))}
                                    style={formErrors.username ? { borderColor: "var(--color-error-8)" } : {}}
                                />
                                {formErrors.username && (
                                    <span style={{ color: "var(--color-error-11)", fontSize: "var(--font-size-0)" }}>
                                        {formErrors.username}
                                    </span>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="role">Role *</Label>
                                <Select
                                    value={newUserForm.role}
                                    onValueChange={(value) => setNewUserForm(prev => ({ ...prev, role: value as UserRole }))}
                                >
                                    <SelectTrigger id="role">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Administrator">Administrator</SelectItem>
                                        <SelectItem value="Management">Management</SelectItem>
                                        <SelectItem value="Staff">Staff</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">Email (Optional)</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="john@company.com"
                                    value={newUserForm.email}
                                    onChange={(e) => setNewUserForm(prev => ({ ...prev, email: e.target.value }))}
                                    style={formErrors.email ? { borderColor: "var(--color-error-8)" } : {}}
                                />
                                {formErrors.email && (
                                    <span style={{ color: "var(--color-error-11)", fontSize: "var(--font-size-0)" }}>
                                        {formErrors.email}
                                    </span>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone Number (Optional)</Label>
                                <Input
                                    id="phone"
                                    placeholder="+62..."
                                    value={newUserForm.phone}
                                    onChange={(e) => setNewUserForm(prev => ({ ...prev, phone: e.target.value }))}
                                />
                            </div>

                            <div className={`${styles.formFullWidth} space-y-2`}>
                                <Label htmlFor="password">Password *</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="Minimum 6 characters"
                                    value={newUserForm.password}
                                    onChange={(e) => setNewUserForm(prev => ({ ...prev, password: e.target.value }))}
                                    style={formErrors.password ? { borderColor: "var(--color-error-8)" } : {}}
                                />
                                {formErrors.password && (
                                    <span style={{ color: "var(--color-error-11)", fontSize: "var(--font-size-0)" }}>
                                        {formErrors.password}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={isCreating}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreateUser} disabled={isCreating}>
                            {isCreating ? "Creating..." : "Create User"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit User Dialog */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent style={{ maxWidth: "600px" }}>
                    <DialogHeader>
                        <DialogTitle style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <Pencil style={{ width: "20px", height: "20px" }} />
                            Edit User
                        </DialogTitle>
                        <DialogDescription>
                            Update user information. Leave password blank to keep the current password.
                        </DialogDescription>
                    </DialogHeader>

                    <div className={styles.modalContent}>
                        <div className={styles.formGrid}>
                            <div className={`${styles.formFullWidth} space-y-2`}>
                                <Label htmlFor="editFullName">Full Name *</Label>
                                <Input
                                    id="editFullName"
                                    placeholder="John Doe"
                                    value={editUserForm.full_name}
                                    onChange={(e) => setEditUserForm(prev => ({ ...prev, full_name: e.target.value }))}
                                    style={editFormErrors.full_name ? { borderColor: "var(--color-error-8)" } : {}}
                                />
                                {editFormErrors.full_name && (
                                    <span style={{ color: "var(--color-error-11)", fontSize: "var(--font-size-0)" }}>
                                        {editFormErrors.full_name}
                                    </span>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="editUsername">Username *</Label>
                                <Input
                                    id="editUsername"
                                    placeholder="johndoe"
                                    value={editUserForm.username}
                                    onChange={(e) => setEditUserForm(prev => ({ ...prev, username: e.target.value }))}
                                    style={editFormErrors.username ? { borderColor: "var(--color-error-8)" } : {}}
                                />
                                {editFormErrors.username && (
                                    <span style={{ color: "var(--color-error-11)", fontSize: "var(--font-size-0)" }}>
                                        {editFormErrors.username}
                                    </span>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="editEmail">Email (Optional)</Label>
                                <Input
                                    id="editEmail"
                                    type="email"
                                    placeholder="john@company.com"
                                    value={editUserForm.email}
                                    onChange={(e) => setEditUserForm(prev => ({ ...prev, email: e.target.value }))}
                                    style={editFormErrors.email ? { borderColor: "var(--color-error-8)" } : {}}
                                />
                                {editFormErrors.email && (
                                    <span style={{ color: "var(--color-error-11)", fontSize: "var(--font-size-0)" }}>
                                        {editFormErrors.email}
                                    </span>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="editPhone">Phone Number (Optional)</Label>
                                <Input
                                    id="editPhone"
                                    placeholder="+62..."
                                    value={editUserForm.phone}
                                    onChange={(e) => setEditUserForm(prev => ({ ...prev, phone: e.target.value }))}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="editPassword">New Password (Optional)</Label>
                                <Input
                                    id="editPassword"
                                    type="password"
                                    placeholder="Leave blank to keep current password"
                                    value={editUserForm.password}
                                    onChange={(e) => setEditUserForm(prev => ({ ...prev, password: e.target.value }))}
                                    style={editFormErrors.password ? { borderColor: "var(--color-error-8)" } : {}}
                                />
                                {editFormErrors.password && (
                                    <span style={{ color: "var(--color-error-11)", fontSize: "var(--font-size-0)" }}>
                                        {editFormErrors.password}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={isUpdating}>
                            Cancel
                        </Button>
                        <Button onClick={handleUpdateUser} disabled={isUpdating}>
                            {isUpdating ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete User Confirmation Dialog */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent style={{ maxWidth: "450px" }}>
                    <DialogHeader>
                        <DialogTitle style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--color-error-11)" }}>
                            <AlertTriangle style={{ width: "20px", height: "20px" }} />
                            Delete User
                        </DialogTitle>
                        <DialogDescription>
                            This action cannot be undone. The user will be permanently removed from the system.
                        </DialogDescription>
                    </DialogHeader>

                    {userToDelete && (
                        <div style={{
                            padding: "var(--space-4)",
                            backgroundColor: "var(--color-error-2)",
                            borderRadius: "var(--radius-2)",
                            border: "1px solid var(--color-error-6)"
                        }}>
                            <p style={{ margin: 0, fontWeight: 500 }}>
                                Are you sure you want to delete <strong>{userToDelete.name}</strong>?
                            </p>
                            <p style={{ margin: "var(--space-2) 0 0 0", color: "var(--color-gray-11)", fontSize: "var(--font-size-1)" }}>
                                Email: {userToDelete.email}
                            </p>
                            <p style={{ margin: "var(--space-1) 0 0 0", color: "var(--color-gray-11)", fontSize: "var(--font-size-1)" }}>
                                Role: {userToDelete.role}
                            </p>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteUser}
                            disabled={isDeleting}
                        >
                            {isDeleting ? "Deleting..." : "Delete User"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
