// components/UserManagementDialog.tsx — Manajemen Akun & Hak Akses Pengguna (Khusus Admin).

import { useState, useEffect } from "react";
import {
  listUsers,
  createUser,
  updateUser,
  resetUserPassword,
  deleteUser,
} from "../lib/api";
import type { UserItem, CreateUserDto, UpdateUserDto } from "../lib/api";
import {
  Users,
  UserPlus,
  X,
  Shield,
  User,
  KeyRound,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
} from "lucide-react";

interface UserManagementDialogProps {
  open: boolean;
  onClose: () => void;
}

export function UserManagementDialog({ open, onClose }: UserManagementDialogProps) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // State Form Modal Tambah / Edit
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editId, setEditId] = useState<string | null>(null);
  const [formUsername, setFormUsername] = useState("");
  const [formFullName, setFormFullName] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState<"ADMIN" | "OPERATOR" | "USER">("USER");
  const [formIsActive, setFormIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // State Modal Reset Password
  const [resetOpen, setResetOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserItem | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (open) {
      loadUserList();
    }
  }, [open]);

  // Shortcut Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (formOpen) setFormOpen(false);
        else if (resetOpen) setResetOpen(false);
        else onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, formOpen, resetOpen, onClose]);

  const loadUserList = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (err) {
      setErrorMsg(typeof err === "string" ? err : "Gagal memuat daftar pengguna.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const handleOpenCreate = () => {
    setFormMode("create");
    setEditId(null);
    setFormUsername("");
    setFormFullName("");
    setFormPassword("");
    setFormRole("USER");
    setFormIsActive(true);
    setErrorMsg(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (user: UserItem) => {
    setFormMode("edit");
    setEditId(user.id);
    setFormUsername(user.username);
    setFormFullName(user.full_name);
    setFormPassword("");
    setFormRole(user.role);
    setFormIsActive(user.is_active);
    setErrorMsg(null);
    setFormOpen(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      if (formMode === "create") {
        const payload: CreateUserDto = {
          username: formUsername.trim(),
          password: formPassword,
          full_name: formFullName.trim(),
          role: formRole,
        };
        await createUser(payload);
        setSuccessMsg(`Akun '${formUsername}' berhasil dibuat.`);
      } else if (editId) {
        const payload: UpdateUserDto = {
          id: editId,
          full_name: formFullName.trim(),
          role: formRole,
          is_active: formIsActive,
        };
        await updateUser(payload);
        setSuccessMsg(`Data akun '${formUsername}' berhasil diperbarui.`);
      }
      setFormOpen(false);
      await loadUserList();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setErrorMsg(typeof err === "string" ? err : "Gagal menyimpan data pengguna.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenReset = (user: UserItem) => {
    setResetTarget(user);
    setNewPassword("");
    setErrorMsg(null);
    setResetOpen(true);
  };

  const handleSaveReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget || !newPassword.trim()) return;

    setResetting(true);
    setErrorMsg(null);
    try {
      await resetUserPassword(resetTarget.id, newPassword.trim());
      setSuccessMsg(`Kata sandi akun '${resetTarget.username}' berhasil direset.`);
      setResetOpen(false);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setErrorMsg(typeof err === "string" ? err : "Gagal mereset kata sandi.");
    } finally {
      setResetting(false);
    }
  };

  const handleDelete = async (user: UserItem) => {
    if (
      !window.confirm(
        `Apakah Anda yakin ingin menghapus akun '${user.username}' (${user.full_name})? Tindakan ini tidak dapat dibatalkan.`
      )
    ) {
      return;
    }

    try {
      await deleteUser(user.id);
      setSuccessMsg(`Akun '${user.username}' berhasil dihapus.`);
      await loadUserList();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setErrorMsg(typeof err === "string" ? err : "Gagal menghapus pengguna.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] transition-colors">
        {/* Header Dialog */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-100 dark:border-indigo-800/80 text-indigo-600 dark:text-indigo-400 shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Manajemen Akun Pengguna & Hak Akses
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold border border-indigo-100 dark:border-indigo-800">
                  {users.length} Akun
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Kelola hak akses Administrator dan Operator untuk SIMBASI BMD
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-all"
            >
              <UserPlus className="h-4 w-4" />
              Tambah Akun Baru
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Notifikasi / Alert */}
        <div className="px-6 pt-4 space-y-2">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-rose-800 dark:text-rose-300 text-xs flex items-start gap-2.5 shadow-sm">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-2.5 shadow-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* Body Table */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500 dark:text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
              <p className="text-xs font-medium">Memuat data pengguna…</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-16 text-slate-500 dark:text-slate-400 space-y-2">
              <Users className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-700" />
              <p className="text-sm font-medium">Belum ada akun terdaftar.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Nama & Username</th>
                    <th className="px-4 py-3">Peran (Role)</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Terakhir Masuk</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300">
                            {u.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-slate-100">
                              {u.full_name}
                            </div>
                            <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                              @{u.username}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {u.role === "ADMIN" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 font-bold text-[10px]">
                            <Shield className="h-3 w-3" />
                            Administrator
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold text-[10px]">
                            <User className="h-3 w-3" />
                            Operator
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {u.is_active ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                            Nonaktif
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400 text-[11px]">
                        {u.last_login_at ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            {new Date(u.last_login_at).toLocaleString("id-ID", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </div>
                        ) : (
                          <span className="italic text-slate-400 dark:text-slate-600">Belum pernah</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenReset(u)}
                            title="Reset Kata Sandi"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(u)}
                            title="Ubah Data Pengguna"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400 transition-colors"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(u)}
                            title="Hapus Akun"
                            className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-600 dark:text-rose-400 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Dialog */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* Modal Form Tambah / Edit */}
      {formOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {formMode === "create" ? "Tambah Akun Pengguna Baru" : `Ubah Akun @${formUsername}`}
              </h3>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="space-y-3.5 text-xs">
              {/* Username (Hanya saat create) */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Nama Pengguna (Username)
                </label>
                <input
                  type="text"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  disabled={formMode === "edit" || submitting}
                  placeholder="contoh: operator_aset"
                  required
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-slate-100 font-mono disabled:opacity-60"
                />
              </div>

              {/* Nama Lengkap */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  disabled={submitting}
                  placeholder="contoh: Budi Santoso"
                  required
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Password (Hanya saat create) */}
              {formMode === "create" && (
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Kata Sandi Awal (Password)
                  </label>
                  <input
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    disabled={submitting}
                    placeholder="Minimal 5 karakter"
                    required
                    minLength={5}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
              )}

              {/* Role Selection */}
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Peran & Hak Akses
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormRole("USER")}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                      formRole === "USER"
                        ? "border-emerald-600 bg-emerald-50/70 dark:border-emerald-500 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold"
                        : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <User className="h-4 w-4 text-emerald-600 shrink-0" />
                    <div>
                      <div>Operator</div>
                      <div className="text-[10px] font-normal opacity-80">Operasional BMD</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormRole("ADMIN")}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                      formRole === "ADMIN"
                        ? "border-indigo-600 bg-indigo-50/70 dark:border-indigo-500 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-bold"
                        : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <Shield className="h-4 w-4 text-indigo-600 shrink-0" />
                    <div>
                      <div>Administrator</div>
                      <div className="text-[10px] font-normal opacity-80">Akses Penuh</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Status Aktif (Hanya saat edit) */}
              {formMode === "edit" && (
                <div className="flex items-center justify-between pt-2">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Status Akun Aktif
                  </label>
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold inline-flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Simpan Akun
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Reset Password */}
      {resetOpen && resetTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Reset Password @{resetTarget.username}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setResetOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveReset} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Kata Sandi Baru
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 5 karakter"
                  required
                  minLength={5}
                  autoFocus
                  disabled={resetting}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setResetOpen(false)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={resetting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold inline-flex items-center gap-1.5"
                >
                  {resetting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Terapkan Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
