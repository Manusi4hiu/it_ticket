/**
 * use-role-management.ts
 *
 * Custom hook yang mengenkapsulasi semua state dan handlers
 * untuk halaman Role Management Settings.
 *
 * Memisahkan logika dari presentasi sehingga route.tsx hanya
 * fokus pada rendering table + dialogs.
 */

import { useState } from "react";
import { useToast } from "~/hooks/use-toast";
import { usersApi } from "~/services/api.service";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type UserRole = "Administrator" | "Management" | "Staff";

export interface ManagedUser {
  id: string;
  email: string;
  username: string;
  name: string;
  role: UserRole;
}

interface NewUserForm {
  full_name: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
}

interface EditUserForm {
  full_name: string;
  username: string;
  email: string;
  phone: string;
  password: string;
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

/**
 * useRoleManagement
 *
 * Manages state dan API calls untuk Create/Edit/Delete user
 * dan ubah role. Tidak mengubah logika bisnis — hanya reorganisasi
 * agar route.tsx lebih bersih.
 *
 * @param initialUsers - User list dari loader
 * @param currentUserId - ID user yang sedang login (untuk guard self-action)
 */
export function useRoleManagement(
  initialUsers: ManagedUser[],
  currentUserId: string
) {
  const { toast } = useToast();

  // ── User List ──
  const [userList, setUserList] = useState<ManagedUser[]>(initialUsers);

  // ── Create Dialog ──
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newUserForm, setNewUserForm] = useState<NewUserForm>({
    full_name: "",
    username: "",
    email: "",
    phone: "",
    password: "",
    role: "Staff",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ── Edit Dialog ──
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [editUserForm, setEditUserForm] = useState<EditUserForm>({
    full_name: "",
    username: "",
    email: "",
    phone: "",
    password: "",
  });
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({});

  // ── Delete Dialog ──
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [userToDelete, setUserToDelete] = useState<ManagedUser | null>(null);

  // ─────────────────────────────────────────────
  // Role Change
  // ─────────────────────────────────────────────

  /**
   * Ubah role user via API.
   * Mencegah user mengubah role dirinya sendiri.
   *
   * @param userId - ID user target
   * @param newRole - Role baru
   */
  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (userId === currentUserId) {
      toast({
        title: "Action Not Allowed",
        description: "You cannot change your own role.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await usersApi.update(userId, { role: newRole });
      if (response.success) {
        setUserList((prev) =>
          prev.map((user) => {
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
    } catch {
      toast({ title: "Error", description: "Failed to update role", variant: "destructive" });
    }
  };

  // ─────────────────────────────────────────────
  // Create User
  // ─────────────────────────────────────────────

  /** Validasi form create user. Return true jika valid. */
  const validateNewUserForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!newUserForm.full_name.trim()) errors.full_name = "Full name is required";
    if (!newUserForm.username.trim()) errors.username = "Username is required";
    if (
      newUserForm.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUserForm.email)
    ) {
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

  /**
   * Buat user baru via API dan tambahkan ke list lokal.
   */
  const handleCreateUser = async () => {
    if (!validateNewUserForm()) return;

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
        const newUser = (
          response.data as {
            user: {
              id: string;
              email: string;
              username: string;
              full_name: string;
              role: string;
            };
          }
        ).user;

        setUserList((prev) => [
          ...prev,
          {
            id: newUser.id,
            email: newUser.email,
            username: newUser.username,
            name: newUser.full_name,
            role: newUser.role as UserRole,
          },
        ]);
        toast({
          title: "User Created",
          description: `${newUser.full_name} has been added as ${newUser.role}.`,
        });
        setShowCreateDialog(false);
        setNewUserForm({
          full_name: "",
          username: "",
          email: "",
          phone: "",
          password: "",
          role: "Staff",
        });
        setFormErrors({});
      } else {
        toast({
          title: "Error",
          description: response.error || "Failed to create user",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Error", description: "Failed to create user", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  // ─────────────────────────────────────────────
  // Edit User
  // ─────────────────────────────────────────────

  /**
   * Buka dialog edit dan pre-fill form dengan data user saat ini.
   *
   * @param user - User yang akan diedit
   */
  const openEditDialog = (user: ManagedUser) => {
    setEditingUser(user);
    setEditUserForm({
      full_name: user.name,
      username: user.username,
      email: user.email || "",
      phone: (user as ManagedUser & { phone?: string }).phone || "",
      password: "",
    });
    setEditFormErrors({});
    setShowEditDialog(true);
  };

  /** Validasi form edit user. Return true jika valid. */
  const validateEditForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!editUserForm.full_name.trim()) errors.full_name = "Full name is required";
    if (!editUserForm.username.trim()) errors.username = "Username is required";
    if (
      editUserForm.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editUserForm.email)
    ) {
      errors.email = "Invalid email format";
    }
    if (editUserForm.password && editUserForm.password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }
    setEditFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Update data user via API.
   */
  const handleUpdateUser = async () => {
    if (!editingUser || !validateEditForm()) return;

    setIsUpdating(true);
    try {
      const updateData: {
        full_name: string;
        username: string;
        email?: string | null;
        phone?: string | null;
        password?: string;
      } = {
        full_name: editUserForm.full_name,
        username: editUserForm.username,
        email: editUserForm.email || null,
        phone: editUserForm.phone || null,
      };

      // Password hanya disertakan jika diisi
      if (editUserForm.password) updateData.password = editUserForm.password;

      const response = await usersApi.update(editingUser.id, updateData);

      if (response.success) {
        setUserList((prev) =>
          prev.map((user) => {
            if (user.id === editingUser.id) {
              return {
                ...user,
                name: editUserForm.full_name,
                username: editUserForm.username,
                email: editUserForm.email,
              };
            }
            return user;
          })
        );
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
    } catch {
      toast({ title: "Error", description: "Failed to update user", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  // ─────────────────────────────────────────────
  // Delete User
  // ─────────────────────────────────────────────

  /**
   * Buka dialog konfirmasi hapus user.
   *
   * @param user - User yang akan dihapus
   */
  const openDeleteDialog = (user: ManagedUser) => {
    setUserToDelete(user);
    setShowDeleteDialog(true);
  };

  /**
   * Hapus user via API setelah konfirmasi.
   */
  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setIsDeleting(true);
    try {
      const response = await usersApi.delete(userToDelete.id);
      if (response.success) {
        setUserList((prev) => prev.filter((u) => u.id !== userToDelete.id));
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
    } catch {
      toast({ title: "Error", description: "Failed to delete user", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    // State
    userList,
    // Create
    showCreateDialog, setShowCreateDialog,
    isCreating,
    newUserForm, setNewUserForm,
    formErrors,
    // Edit
    showEditDialog, setShowEditDialog,
    isUpdating,
    editingUser,
    editUserForm, setEditUserForm,
    editFormErrors,
    // Delete
    showDeleteDialog, setShowDeleteDialog,
    isDeleting,
    userToDelete,
    // Handlers
    handleRoleChange,
    handleCreateUser,
    openEditDialog,
    handleUpdateUser,
    openDeleteDialog,
    handleDeleteUser,
  };
}
