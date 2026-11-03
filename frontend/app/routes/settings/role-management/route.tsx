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

import { UserPlus, UserCheck, Users, Layers, ShieldCheck, Lock, Pencil, Trash2, AlertTriangle, Power } from "lucide-react";
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
import { settingsApi, type Team } from "~/services/settings.service";
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

  const [response, teamsRes] = await Promise.all([
    usersApi.getAll(),
    settingsApi.getTeams(),
  ]);
  const users = response.success && response.data ? response.data.users : [];

  return {
    session,
    teams: (teamsRes.data?.data || []) as Team[],
    users: users.map((u) => ({
      id: String(u.id),
      email: u.email,
      username: u.username,
      name: u.full_name,
      role: u.role as UserRole,
      isActive: u.is_active !== false,
      teamIds: ((u as unknown as { teamIds?: (string | number)[] }).teamIds ?? []).map(String),
    })) as ManagedUser[],
  };
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function RoleManagementSettings({
  loaderData,
}: Route.ComponentProps) {
  const { session, users: initialUsers, teams } = loaderData;

  const currentUser = {
    id: session.userId,
    name: session.userName,
    role: session.userRole,
  };

  const rm = useRoleManagement(initialUsers, currentUser.id);

  /** Aksen warna select role sesuai role user. */
  const getRoleAccentClass = (role: UserRole) => {
    switch (role) {
      case "Administrator": return styles.roleSelectAdmin;
      case "Management": return styles.roleSelectManagement;
      case "Staff": return styles.roleSelectStaff;
      default: return "";
    }
  };

  /** Inisial dua huruf untuk avatar user. */
  const getInitials = (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?";

  const activeCount = rm.userList.filter((user) => user.isActive).length;
  const adminCount = rm.userList.filter((user) => user.role === "Administrator").length;

  const getTeamNames = (user: ManagedUser) =>
    (user.teamIds || [])
      .map((id) => teams.find((team) => String(team.id) === id)?.name)
      .filter((name): name is string => Boolean(name));

  const renderRoleControl = (user: ManagedUser) => {
    if (user.id === currentUser.id) {
      return (
        <span className={styles.selfLock} title="You cannot change your own role">
          <Lock size={12} aria-hidden="true" />
          {user.role} · you
        </span>
      );
    }

    return (
      <Select
        value={user.role}
        onValueChange={(value) => rm.handleRoleChange(user.id, value as UserRole)}
      >
        <SelectTrigger
          className={`${styles.roleSelect} ${getRoleAccentClass(user.role)}`}
          aria-label={`Change role for ${user.name}`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Administrator">Administrator</SelectItem>
          <SelectItem value="Management">Management</SelectItem>
          <SelectItem value="Staff">Staff</SelectItem>
        </SelectContent>
      </Select>
    );
  };

  const renderActions = (user: ManagedUser) => (
    <>
      {user.id !== currentUser.id && (
        <button
          type="button"
          className={`${styles.iconButton} ${user.isActive ? styles.iconButtonDanger : styles.iconButtonSuccess}`}
          onClick={() => rm.handleToggleActive(user.id)}
          disabled={rm.togglingActiveId === user.id}
          title={user.isActive ? "Deactivate user" : "Activate user"}
          aria-label={user.isActive ? `Deactivate ${user.name}` : `Activate ${user.name}`}
        >
          <Power size={14} aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        className={styles.iconButton}
        onClick={() => rm.openEditDialog(user)}
        title="Edit user"
        aria-label={`Edit ${user.name}`}
      >
        <Pencil size={14} aria-hidden="true" />
      </button>
      {user.id !== currentUser.id && (
        <button
          type="button"
          className={`${styles.iconButton} ${styles.iconButtonDanger}`}
          onClick={() => rm.openDeleteDialog(user)}
          title="Delete user"
          aria-label={`Delete ${user.name}`}
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      )}
    </>
  );

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>
            <ShieldCheck size={14} aria-hidden="true" />
            Settings · Access control
          </span>
          <h1 className={styles.title}>Role Management</h1>
          <p className={styles.subtitle}>
            Atur siapa yang bisa masuk, role apa yang mereka pegang, dan tim mana yang mereka kelola.
          </p>
        </div>
        <Button type="button" className={styles.createButton} onClick={() => rm.setShowCreateDialog(true)}>
          <UserPlus size={16} aria-hidden="true" />
          Create user
        </Button>
      </header>

      <section className={styles.statsGrid} aria-label="Ringkasan user">
        <div className={styles.statCard}>
          <span className={`${styles.statIcon} ${styles.statIconBlue}`}><Users size={18} aria-hidden="true" /></span>
          <div>
            <div className={styles.statValue}>{rm.userList.length}</div>
            <div className={styles.statLabel}>Total users</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <span className={`${styles.statIcon} ${styles.statIconGreen}`}><UserCheck size={18} aria-hidden="true" /></span>
          <div>
            <div className={styles.statValue}>{activeCount}</div>
            <div className={styles.statLabel}>Active</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <span className={`${styles.statIcon} ${styles.statIconAmber}`}><ShieldCheck size={18} aria-hidden="true" /></span>
          <div>
            <div className={styles.statValue}>{adminCount}</div>
            <div className={styles.statLabel}>Administrators</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <span className={`${styles.statIcon} ${styles.statIconSlate}`}><Layers size={18} aria-hidden="true" /></span>
          <div>
            <div className={styles.statValue}>{teams.length}</div>
            <div className={styles.statLabel}>Teams</div>
          </div>
        </div>
      </section>

      <section className={styles.directory} aria-label="Daftar user">
        <div className={styles.directoryHeader}>
          <div>
            <h2 className={styles.directoryTitle}>Team directory</h2>
            <p className={styles.directoryMeta}>
              {rm.userList.length} user terdaftar
            </p>
          </div>
        </div>

        {rm.userList.length === 0 ? (
          <div className={styles.emptyState} role="status">
            <span className={styles.emptyIcon}><Users size={22} aria-hidden="true" /></span>
            <h3 className={styles.emptyTitle}>Belum ada user</h3>
            <p className={styles.emptyText}>
              Tambahkan user pertama untuk mulai mengelola akses dan role tim.
            </p>
            <Button type="button" onClick={() => rm.setShowCreateDialog(true)}>
              <UserPlus size={16} aria-hidden="true" />
              Create user
            </Button>
          </div>
        ) : (
          <>
            <div className={styles.tableScroll}>
              <table className={styles.userTable}>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Teams</th>
                    <th>Status</th>
                    <th>Role</th>
                    <th className={styles.actionsHeader}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rm.userList.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className={styles.identity}>
                          <div className={styles.avatar} aria-hidden="true">{getInitials(user.name)}</div>
                          <div className={styles.identityText}>
                            <div className={styles.identityName}>
                              <span className={styles.nameText}>{user.name}</span>
                              {user.id === currentUser.id && <span className={styles.youTag}>You</span>}
                            </div>
                            <span className={styles.identityHandle}>@{user.username}</span>
                          </div>
                        </div>
                      </td>
                      <td><span className={styles.email}>{user.email || "—"}</span></td>
                      <td>
                        <div className={styles.teamChips}>
                          {getTeamNames(user).length > 0
                            ? getTeamNames(user).map((name) => <span key={name} className={styles.teamChip}>{name}</span>)
                            : <span className={styles.muted}>No team</span>}
                        </div>
                      </td>
                      <td>
                        <span className={user.isActive ? styles.statusActive : styles.statusInactive}>
                          <span className={styles.statusDot} aria-hidden="true" />
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>{renderRoleControl(user)}</td>
                      <td>
                        <div className={styles.actions}>{renderActions(user)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.mobileCards}>
              {rm.userList.map((user) => (
                <article key={`mobile-${user.id}`} className={styles.userCard}>
                  <div className={styles.userCardTop}>
                    <div className={styles.identity}>
                      <div className={styles.avatar} aria-hidden="true">{getInitials(user.name)}</div>
                      <div className={styles.identityText}>
                        <div className={styles.identityName}>
                          <span className={styles.nameText}>{user.name}</span>
                          {user.id === currentUser.id && <span className={styles.youTag}>You</span>}
                        </div>
                        <span className={styles.identityHandle}>@{user.username}</span>
                      </div>
                    </div>
                    <span className={user.isActive ? styles.statusActive : styles.statusInactive}>
                      <span className={styles.statusDot} aria-hidden="true" />
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className={styles.userCardMeta}>
                    <span className={styles.email}>{user.email || "No email"}</span>
                    <div className={styles.teamChips}>
                      {getTeamNames(user).length > 0
                        ? getTeamNames(user).map((name) => <span key={name} className={styles.teamChip}>{name}</span>)
                        : <span className={styles.muted}>No team</span>}
                    </div>
                  </div>
                  <div className={styles.userCardRole}>
                    <span className={styles.fieldLabel}>Role</span>
                    {renderRoleControl(user)}
                  </div>
                  <div className={styles.userCardActions}>{renderActions(user)}</div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <section className={styles.permissionsSection} aria-label="Role permissions">
        <div className={styles.permissionsHeader}>
          <div>
            <h3 className={styles.permissionsTitle}>Role permissions</h3>
            <p className={styles.permissionsHint}>Referensi cepat sebelum mengubah role user.</p>
          </div>
        </div>
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
      </section>

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
                  <SelectTrigger id="role" style={{ width: "100%" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Administrator">Administrator</SelectItem>
                    <SelectItem value="Management">Management</SelectItem>
                    <SelectItem value="Staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Team membership (multi-select) */}
              <div className="space-y-2" style={{ gridColumn: "1 / -1" }}>
                <Label htmlFor="teams">Teams</Label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {teams.map((t) => {
                    const checked = rm.newUserForm.teamIds.includes(String(t.id));
                    return (
                      <label
                        key={t.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 12px",
                          borderRadius: "8px",
                          border: "1px solid rgba(255,255,255,0.2)",
                          background: checked ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.05)",
                          cursor: "pointer",
                          fontSize: "0.85rem",
                          color: "white",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const id = String(t.id);
                            rm.setNewUserForm((p) => ({
                              ...p,
                              teamIds: e.target.checked
                                ? [...p.teamIds, id]
                                : p.teamIds.filter((x) => x !== id),
                            }));
                          }}
                          style={{ width: "14px", height: "14px", cursor: "pointer" }}
                        />
                        {t.name}
                      </label>
                    );
                  })}
                </div>
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
              {/* Team membership (multi-select) */}
              <div className="space-y-2" style={{ gridColumn: "1 / -1" }}>
                <Label htmlFor="editTeams">Teams</Label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {teams.map((t) => {
                    const checked = rm.editUserForm.teamIds.includes(String(t.id));
                    return (
                      <label
                        key={t.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 12px",
                          borderRadius: "8px",
                          border: "1px solid rgba(255,255,255,0.2)",
                          background: checked ? "rgba(59,130,246,0.25)" : "rgba(255,255,255,0.05)",
                          cursor: "pointer",
                          fontSize: "0.85rem",
                          color: "white",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const id = String(t.id);
                            rm.setEditUserForm((p) => ({
                              ...p,
                              teamIds: e.target.checked
                                ? [...p.teamIds, id]
                                : p.teamIds.filter((x) => x !== id),
                            }));
                          }}
                          style={{ width: "14px", height: "14px", cursor: "pointer" }}
                        />
                        {t.name}
                      </label>
                    );
                  })}
                </div>
              </div>
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
