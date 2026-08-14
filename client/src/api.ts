/**
 * api.ts — thin fetch wrappers for every server endpoint (routes/*.ts on
 * the server). Every call sends credentials so the session cookie is
 * included; see ARCHITECTURE.md "Request lifecycle".
 */

export interface PublicUser {
  id: number;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: "user" | "admin";
  isSuperAdmin: boolean;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json();
}

export const api = {
  me: () => req<{ user: PublicUser | null; googleConfigured: boolean }>("/api/auth/me"),
  logout: () => req<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  adminLogin: (email: string, password: string) =>
    req<{ user: PublicUser }>("/api/auth/admin-login", { method: "POST", body: JSON.stringify({ email, password }) }),

  config: () => req<{ config: Record<string, string> }>("/api/config"),

  settingsGet: () => req<{ params: unknown | null }>("/api/settings"),
  settingsSave: (params: unknown) => req<{ ok: true }>("/api/settings", { method: "POST", body: JSON.stringify({ params }) }),
  settingsClear: () => req<{ ok: true }>("/api/settings", { method: "DELETE" }),

  adminUsers: () => req<{ users: AdminUser[] }>("/api/admin/users"),
  adminBlockUser: (id: number, blocked: boolean) =>
    req<{ user: AdminUser }>(`/api/admin/users/${id}/block`, { method: "POST", body: JSON.stringify({ blocked }) }),
  adminSetRole: (id: number, role: "user" | "admin") =>
    req<{ user: AdminUser }>(`/api/admin/users/${id}/role`, { method: "POST", body: JSON.stringify({ role }) }),
  adminConfig: () => req<{ config: Record<string, string> }>("/api/admin/config"),
  adminSetConfig: (key: string, value: string) =>
    req<{ ok: true }>("/api/admin/config", { method: "POST", body: JSON.stringify({ key, value }) }),
  adminAuditLog: () => req<{ entries: AuditEntry[] }>("/api/admin/audit-log"),
};

export interface AdminUser {
  id: number;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: "user" | "admin";
  isSuperAdmin: boolean;
  blocked: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  authMethod: "google" | "password";
}

export interface AuditEntry {
  id: number;
  actor_user_id: number | null;
  action: string;
  target: string | null;
  details: string | null;
  created_at: string;
}
