/**
 * route.tsx — Role Management Settings
 *
 * Halaman pengaturan role dan user management.
 * Hanya Administrator yang dapat mengakses halaman ini.
 *
 * Logika CRUD ada di: hooks/use-role-management.ts
 * Komponen: UserTable (inline), Create/Edit/Delete Dialog (inline)
 *
 * NOTE: `console.log(styles)` dipertahankan karena CSS Modules
 * tidak akan tree-shake jika tidak ada referensi ke class-nya —
 * ini workaround agar styles ter-load dengan benar.
 */

import { useState } from "react";
import { User, UserPlus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select/select";
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
console.log(styles); // Workaround: pastikan CSS Modules ter-load
import settingsStyles from "../style.module.css";
import { requireRole } from "~/services/session.service";
import { useRoleManagement, type UserRole, type ManagedUser } from "./hooks/use-role-management";

// ─────────────────────────────────────────────
// Loader
// ─────────────────────────────────────────────

export async function loader({ request }: Route.LoaderArgs) {
  const session = await requireRole(request, ["Administrator"]);

  const response = await usersApi.getAll();
  const users = response.success && response.data ? response.data.users : [];

  return {
    session,
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      username: u.username,
      name: u.full_name,
      role: u.role as UserRole,
    })) as ManagedUser[],
  };
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function RoleManagementSettings({
  loaderData,
}: Route.ComponentProps) {
  const { session, users: initialUsers } = loaderData;

  const currentUser = {
    id: session.userId,
    name: session.userName,
    role: session.userRole,
  };

  const rm = useRoleManagement(initialUsers, currentUser.id);

  /** Return CSS class badge berdasarkan role */
  const getRoleBadgeClass = (role: UserRole) => {
    switch (role) {
      case "Administrator": return styles.roleAdmin;
      case "Management": return styles.roleManagement;
      case "Staff": return styles.roleStaff;
      default: return "";
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div
        className={settingsStyles.actionHeader}
        style={{ marginBottom: "var(--space-6)" }}
      >
        <div>
          <h1 className={settingsStyles.pageTitle}>Role Management</h1>
          <p className={settingsStyles.pageDescription}>
            Manage user roles and permissions.
          </p>
        </div>
        <Button
          className={settingsStyles.headerButton}
          onClick={() => rm.setShowCreateDialog(true)}
        >
          <UserPlus style={{ width: "16px", height: "16px" }} />
          Create User
        </Button>
      </div>

      {/* User Table */}
      <div className={settingsStyles.tableContainer} style={{ marginBottom: "var(--space-8)" }}>
        <div className={settingsStyles.scrollableArea}>
          <table className={styles.customTable}>
            <thead>
              <tr>
                <th style={{ width: "25%", minWidth: "200px" }}>User Information</th>
                <th style={{ width: "15%", minWidth: "120px" }}>Username</th>
                <th style={{ width: "20%", minWidth: "180px" }}>Email</th>
                <th style={{ width: "15%", minWidth: "150px" }}>Current Role</th>
                <th style={{ width: "15%", minWidth: "160px" }}>Change Role</th>
                <th style={{ width: "10%", minWidth: "100px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rm.userList.map((user) => (
                <tr key={user.id}>
                  {/* Name + "Logged In" indicator */}
                  <td>
                    <div className={styles.userCell}>
                      <div className={styles.userAvatar}>
                        <User size={18} />
                      </div>
                      <div
                        style={{ display: "flex", flexDirection: "column", minWidth: 0 }}
                      >
                        <span className={styles.userName}>{user.name}</span>
                        {user.id === currentUser.id && (
                          <span
                            style={{
                              fontSize: "0.65rem",
                              color: "#93c5fd",
                              fontWeight: 800,
                              textTransform: "uppercase",
                              marginTop: "2px",
                            }}
                          >
                            Logged In
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Username */}
                  <td>
                    <span className={`${settingsStyles.code} ${styles.usernameBadge}`}>
                      {user.username}
                    </span>
                  </td>

                  {/* Email */}
                  <td>
                    <span className={styles.userEmail}>{user.email}</span>
                  </td>

                  {/* Current Role badge */}
                  <td>
                    <div className={`${styles.roleBadge} ${getRoleBadgeClass(user.role)}`}>
                      {user.role}
                    </div>
                  </td>

                  {/* Change Role dropdown */}
                  <td>
                    {user.id === currentUser.id ? (
                      <span
                        style={{
                          opacity: 0.5,
                          fontStyle: "italic",
                          fontSize: "0.8rem",
                          color: "rgba(255,255,255,0.6)",
                        }}
                      >
                        Self transformation disabled
                      </span>
                    ) : (
                      <Select
                        value={user.role}
                        onValueChange={(value) =>
                          rm.handleRoleChange(user.id, value as UserRole)
                        }
                      >
                        <SelectTrigger
                          style={{
                            width: "130px",
                            background: "rgba(255, 255, 255, 0.05)",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                            color: "white",
                            height: "32px",
                            borderRadius: "8px",
                            fontSize: "0.8rem",
                          }}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent
                          style={{
                            background: "#1e1b4b",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            color: "white",
                          }}
                        >
                          <SelectItem value="Administrator">Administrator</SelectItem>
                          <SelectItem value="Management">Management</SelectItem>
                          <SelectItem value="Staff">Staff</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </td>

                  {/* Actions: Edit + Delete */}
                  <td>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => rm.openEditDialog(user)}
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: "white",
                          width: "32px",
                          height: "32px",
                          padding: 0,
                        }}
                      >
                        <Pencil size={14} />
                      </Button>
                      {user.id !== currentUser.id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => rm.openDeleteDialog(user)}
                          style={{
                            color: "#f87171",
                            background: "rgba(239, 68, 68, 0.1)",
                            border: "1px solid rgba(239, 68, 68, 0.2)",
                            width: "32px",
                            height: "32px",
                            padding: 0,
                          }}
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

      {/* Role Permissions Info */}
      <div className={styles.infoSection}>
        <h3 className={styles.infoTitle}>Role Permissions</h3>
        <div className={styles.roleDescriptions}>
          <RolePermissionCard
            role="Administrator"
            badgeClass={`${styles.roleLabel} ${styles.roleAdmin}`}
            permissions={[
              "Full access to all features",
              "Can manage user roles",
              "Can assign and take tickets",
              "Can view all reports and analytics",
            ]}
          />
          <RolePermissionCard
            role="Management"
            badgeClass={`${styles.roleLabel} ${styles.roleManagement}`}
            permissions={[
              "View-only access to dashboard and tickets",
              "Cannot assign or take tickets",
              "Cannot change ticket status",
              "Full access to reports and analytics",
            ]}
          />
          <RolePermissionCard
            role="Staff"
            badgeClass={`${styles.roleLabel} ${styles.roleStaff}`}
            permissions={[
              "Can view and manage tickets",
              "Can take and be assigned tickets",
              "Can change ticket status",
              "Can view reports and analytics",
            ]}
          />
        </div>
      </div>

      {/* ── Create User Dialog ── */}
      <Dialog open={rm.showCreateDialog} onOpenChange={rm.setShowCreateDialog}>
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
              <FormField
                id="fullName"
                label="Full Name *"
                value={rm.newUserForm.full_name}
                onChange={(v) => rm.setNewUserForm((p) => ({ ...p, full_name: v }))}
                error={rm.formErrors.full_name}
                placeholder="John Doe"
                fullWidth
              />
              <FormField
                id="username"
                label="Username *"
                value={rm.newUserForm.username}
                onChange={(v) => rm.setNewUserForm((p) => ({ ...p, username: v }))}
                error={rm.formErrors.username}
                placeholder="johndoe"
              />
              {/* Role select */}
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select
                  value={rm.newUserForm.role}
                  onValueChange={(v) =>
                    rm.setNewUserForm((p) => ({ ...p, role: v as UserRole }))
                  }
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
              <FormField
                id="email"
                label="Email (Optional)"
                type="email"
                value={rm.newUserForm.email}
                onChange={(v) => rm.setNewUserForm((p) => ({ ...p, email: v }))}
                error={rm.formErrors.email}
                placeholder="john@company.com"
              />
              <FormField
                id="phone"
                label="Phone Number (Optional)"
                value={rm.newUserForm.phone}
                onChange={(v) => rm.setNewUserForm((p) => ({ ...p, phone: v }))}
                placeholder="+62..."
              />
              <FormField
                id="password"
                label="Password *"
                type="password"
                value={rm.newUserForm.password}
                onChange={(v) => rm.setNewUserForm((p) => ({ ...p, password: v }))}
                error={rm.formErrors.password}
                placeholder="Minimum 6 characters"
                fullWidth
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => rm.setShowCreateDialog(false)}
              disabled={rm.isCreating}
            >
              Cancel
            </Button>
            <Button onClick={rm.handleCreateUser} disabled={rm.isCreating}>
              {rm.isCreating ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit User Dialog ── */}
      <Dialog open={rm.showEditDialog} onOpenChange={rm.setShowEditDialog}>
        <DialogContent style={{ maxWidth: "600px" }}>
          <DialogHeader>
            <DialogTitle style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Pencil style={{ width: "20px", height: "20px" }} />
              Edit User
            </DialogTitle>
            <DialogDescription>
              Update user information. Leave password blank to keep the current
              password.
            </DialogDescription>
          </DialogHeader>

          <div className={styles.modalContent}>
            <div className={styles.formGrid}>
              <FormField
                id="editFullName"
                label="Full Name *"
                value={rm.editUserForm.full_name}
                onChange={(v) => rm.setEditUserForm((p) => ({ ...p, full_name: v }))}
                error={rm.editFormErrors.full_name}
                placeholder="John Doe"
                fullWidth
              />
              <FormField
                id="editUsername"
                label="Username *"
                value={rm.editUserForm.username}
                onChange={(v) => rm.setEditUserForm((p) => ({ ...p, username: v }))}
                error={rm.editFormErrors.username}
                placeholder="johndoe"
              />
              <FormField
                id="editEmail"
                label="Email (Optional)"
                type="email"
                value={rm.editUserForm.email}
                onChange={(v) => rm.setEditUserForm((p) => ({ ...p, email: v }))}
                error={rm.editFormErrors.email}
                placeholder="john@company.com"
              />
              <FormField
                id="editPhone"
                label="Phone Number (Optional)"
                value={rm.editUserForm.phone}
                onChange={(v) => rm.setEditUserForm((p) => ({ ...p, phone: v }))}
                placeholder="+62..."
              />
              <FormField
                id="editPassword"
                label="New Password (Optional)"
                type="password"
                value={rm.editUserForm.password}
                onChange={(v) => rm.setEditUserForm((p) => ({ ...p, password: v }))}
                error={rm.editFormErrors.password}
                placeholder="Leave blank to keep current password"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => rm.setShowEditDialog(false)}
              disabled={rm.isUpdating}
            >
              Cancel
            </Button>
            <Button onClick={rm.handleUpdateUser} disabled={rm.isUpdating}>
              {rm.isUpdating ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={rm.showDeleteDialog} onOpenChange={rm.setShowDeleteDialog}>
        <DialogContent style={{ maxWidth: "450px" }}>
          <DialogHeader>
            <DialogTitle
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "var(--color-error-11)",
              }}
            >
              <AlertTriangle style={{ width: "20px", height: "20px" }} />
              Delete User
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. The user will be permanently removed
              from the system.
            </DialogDescription>
          </DialogHeader>

          {rm.userToDelete && (
            <div
              style={{
                padding: "var(--space-4)",
                backgroundColor: "var(--color-error-2)",
                borderRadius: "var(--radius-2)",
                border: "1px solid var(--color-error-6)",
              }}
            >
              <p style={{ margin: 0, fontWeight: 500 }}>
                Are you sure you want to delete{" "}
                <strong>{rm.userToDelete.name}</strong>?
              </p>
              <p
                style={{
                  margin: "var(--space-2) 0 0 0",
                  color: "var(--color-gray-11)",
                  fontSize: "var(--font-size-1)",
                }}
              >
                Email: {rm.userToDelete.email}
              </p>
              <p
                style={{
                  margin: "var(--space-1) 0 0 0",
                  color: "var(--color-gray-11)",
                  fontSize: "var(--font-size-1)",
                }}
              >
                Role: {rm.userToDelete.role}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => rm.setShowDeleteDialog(false)}
              disabled={rm.isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={rm.handleDeleteUser}
              disabled={rm.isDeleting}
            >
              {rm.isDeleting ? "Deleting..." : "Delete User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────
// Internal Sub-components
// ─────────────────────────────────────────────

/**
 * FormField
 *
 * Reusable field untuk form create/edit user.
 * Menampilkan label, input, dan pesan error opsional.
 */
function FormField({
  id,
  label,
  value,
  onChange,
  error,
  placeholder,
  type = "text",
  fullWidth = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  type?: string;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "space-y-2 col-span-2" : "space-y-2"}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={error ? { borderColor: "var(--color-error-8)" } : {}}
      />
      {error && (
        <span style={{ color: "var(--color-error-11)", fontSize: "var(--font-size-0)" }}>
          {error}
        </span>
      )}
    </div>
  );
}

/**
 * RolePermissionCard
 *
 * Card deskripsi permission untuk satu role.
 */
function RolePermissionCard({
  role,
  badgeClass,
  permissions,
}: {
  role: string;
  badgeClass: string;
  permissions: string[];
}) {
  const stylesModule = styles as Record<string, string>;
  return (
    <div className={stylesModule.roleDescription}>
      <div className={badgeClass}>{role}</div>
      <ul className={stylesModule.permissionList}>
        {permissions.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </div>
  );
}
