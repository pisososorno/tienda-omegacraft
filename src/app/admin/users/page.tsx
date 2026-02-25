"use client";

import { useEffect, useState } from "react";
import {
  UserPlus,
  Shield,
  ShieldOff,
  Key,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  disabledAt: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createName, setCreateName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [creating, setCreating] = useState(false);

  // Change password modal
  const [changePwUser, setChangePwUser] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  async function fetchUsers() {
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data);
    } catch {
      setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: createEmail,
          name: createName,
          password: createPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create user");

      setSuccess(`User ${data.email} created successfully`);
      setShowCreate(false);
      setCreateEmail("");
      setCreateName("");
      setCreatePassword("");
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(user: AdminUser) {
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/admin/users/${user.id}/toggle`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to toggle user");

      const action = user.disabledAt ? "enabled" : "disabled";
      setSuccess(`${user.email} ${action} successfully`);
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Operation failed");
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!changePwUser) return;
    setChangingPw(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/admin/users/${changePwUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to change password");

      setSuccess(`Password changed for ${changePwUser.email}`);
      setChangePwUser(null);
      setNewPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setChangingPw(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Users</h1>
          <p className="text-muted-foreground text-sm">
            Manage administrator accounts
          </p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          New Admin
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-md text-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create New Admin</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Name</label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="John Doe"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Email</label>
                <input
                  type="email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="admin@example.com"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Password</label>
                <input
                  type="password"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Min 8 chars, A-Z, a-z, 0-9"
                  required
                  minLength={8}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" disabled={creating} className="gap-2">
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
            <p className="text-xs text-muted-foreground mt-2">
              Password requirements: 8+ characters, at least one uppercase, one lowercase, one number.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Change password modal */}
      {changePwUser && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-base">
              Change Password — {changePwUser.email}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium mb-1 block">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Min 8 chars, A-Z, a-z, 0-9"
                  required
                  minLength={8}
                />
              </div>
              <Button type="submit" disabled={changingPw} className="gap-2">
                {changingPw && <Loader2 className="h-4 w-4 animate-spin" />}
                Update
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setChangePwUser(null);
                  setNewPassword("");
                }}
              >
                Cancel
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Users list */}
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Name</th>
              <th className="text-left p-3 font-medium">Email</th>
              <th className="text-left p-3 font-medium">Role</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">Last Login</th>
              <th className="text-left p-3 font-medium">Created</th>
              <th className="text-right p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b last:border-0">
                <td className="p-3 font-medium">{user.name}</td>
                <td className="p-3 text-muted-foreground">{user.email}</td>
                <td className="p-3">
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      user.role === "SUPER_ADMIN"
                        ? "border-violet-300 text-violet-700 bg-violet-50"
                        : user.role === "STORE_ADMIN"
                        ? "border-blue-300 text-blue-700 bg-blue-50"
                        : "border-amber-300 text-amber-700 bg-amber-50"
                    }`}
                  >
                    {user.role.replace("_", " ")}
                  </Badge>
                </td>
                <td className="p-3">
                  {user.disabledAt ? (
                    <Badge variant="destructive" className="text-xs">
                      Disabled
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                      Active
                    </Badge>
                  )}
                </td>
                <td className="p-3 text-muted-foreground text-xs">
                  {user.lastLoginAt
                    ? new Date(user.lastLoginAt).toLocaleString()
                    : "Never"}
                </td>
                <td className="p-3 text-muted-foreground text-xs">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 text-xs"
                      onClick={() => setChangePwUser(user)}
                    >
                      <Key className="h-3 w-3" />
                      Password
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-8 gap-1 text-xs ${
                        user.disabledAt
                          ? "text-emerald-600 hover:text-emerald-700"
                          : "text-destructive hover:text-destructive"
                      }`}
                      onClick={() => handleToggle(user)}
                    >
                      {user.disabledAt ? (
                        <>
                          <Shield className="h-3 w-3" />
                          Enable
                        </>
                      ) : (
                        <>
                          <ShieldOff className="h-3 w-3" />
                          Disable
                        </>
                      )}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
