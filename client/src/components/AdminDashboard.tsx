import { useEffect, useState } from "react";
import { api, type AdminUser, type AuditEntry, type DailyVisitCount, type PageView, type PublicUser, type VisitSummary } from "../api";
import { LineChart } from "./charts/LineChart";

/**
 * AdminDashboard — the "make any account admin or block them or change the
 * internal code or database at will" requirement, scoped to a *safe*
 * surface: user roles/blocking, and a key-value site-config editor (the
 * `explain.*` text, defaults, limits) — not a live code or raw-SQL editor.
 * See ARCHITECTURE.md "Admin panel: what it can and can't do" for why a
 * literal code/DB editor was deliberately not built (it would be a
 * public-facing remote-code-execution surface).
 */
export function AdminDashboard({ user }: { user: PublicUser }) {
  const [tab, setTab] = useState<"users" | "config" | "audit" | "visitors">("users");

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <h1>Admin dashboard</h1>
        <a href="/" className="small">
          &larr; Back to the explorer
        </a>
      </div>
      <p className="muted small">
        Signed in as {user.email} {user.isSuperAdmin && <span className="badge admin">Super-admin</span>}
      </p>
      <nav className="tabs">
        <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>
          Users
        </button>
        <button className={tab === "config" ? "active" : ""} onClick={() => setTab("config")}>
          Site config
        </button>
        <button className={tab === "audit" ? "active" : ""} onClick={() => setTab("audit")}>
          Audit log
        </button>
        <button className={tab === "visitors" ? "active" : ""} onClick={() => setTab("visitors")}>
          Visitors
        </button>
      </nav>
      {tab === "users" && <UsersTab currentUser={user} />}
      {tab === "config" && <ConfigTab />}
      {tab === "audit" && <AuditTab />}
      {tab === "visitors" && <VisitorsTab />}
    </div>
  );
}

function UsersTab({ currentUser }: { currentUser: PublicUser }) {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await api.adminUsers();
      setUsers(res.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleBlock(u: AdminUser) {
    try {
      await api.adminBlockUser(u.id, !u.blocked);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update user.");
    }
  }

  async function toggleRole(u: AdminUser) {
    try {
      await api.adminSetRole(u.id, u.role === "admin" ? "user" : "admin");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update role.");
    }
  }

  return (
    <div className="card">
      <h2>Users</h2>
      {error && (
        <p className="small" style={{ color: "var(--critical)" }}>
          {error}
        </p>
      )}
      {!users ? (
        <p className="muted small">Loading...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Auth</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last login</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.name || "—"}</td>
                <td>{u.authMethod}</td>
                <td>
                  {u.isSuperAdmin ? (
                    <span className="badge admin">Super-admin</span>
                  ) : u.role === "admin" ? (
                    <span className="badge admin">Admin</span>
                  ) : (
                    "User"
                  )}
                </td>
                <td>{u.blocked ? <span className="badge blocked">Blocked</span> : "Active"}</td>
                <td className="small muted">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "never"}</td>
                <td>
                  {!u.isSuperAdmin && (
                    <div className="row" style={{ gap: 6 }}>
                      {currentUser.isSuperAdmin && (
                        <button className="btn secondary small" onClick={() => toggleRole(u)}>
                          {u.role === "admin" ? "Revoke admin" : "Make admin"}
                        </button>
                      )}
                      {u.id !== currentUser.id && (
                        <button className={`btn small ${u.blocked ? "secondary" : "danger"}`} onClick={() => toggleBlock(u)}>
                          {u.blocked ? "Unblock" : "Block"}
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ConfigTab() {
  const [config, setConfig] = useState<Record<string, string> | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  async function load() {
    const res = await api.adminConfig();
    setConfig(res.config);
    setDrafts(res.config);
  }

  useEffect(() => {
    load();
  }, []);

  async function save(key: string) {
    try {
      await api.adminSetConfig(key, drafts[key] ?? "");
      setStatus(`Saved "${key}".`);
      load();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to save.");
    }
  }

  async function addNew() {
    if (!newKey.trim()) return;
    try {
      await api.adminSetConfig(newKey.trim(), newValue);
      setNewKey("");
      setNewValue("");
      setStatus(`Added "${newKey.trim()}".`);
      load();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to add.");
    }
  }

  return (
    <div className="card">
      <h2>Site config</h2>
      <p className="muted small">
        Free-form key/value text — this is what drives every "Why this works this way" explanation card and the
        default parameters, editable here without a code deploy. There is intentionally no code or raw-database
        editor on this page; see ARCHITECTURE.md if you need to go further than this.
      </p>
      {status && <p className="small" style={{ color: "var(--series-blue)" }}>{status}</p>}
      {!config ? (
        <p className="muted small">Loading...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th style={{ width: 220 }}>Key</th>
              <th>Value</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(config)
              .sort()
              .map((key) => (
                <tr key={key}>
                  <td className="small" style={{ whiteSpace: "normal" }}>
                    <code>{key}</code>
                  </td>
                  <td>
                    <textarea
                      value={drafts[key] ?? ""}
                      onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                      rows={key.startsWith("explain.") ? 3 : 1}
                      style={{ width: "100%" }}
                    />
                  </td>
                  <td>
                    <button className="btn secondary small" onClick={() => save(key)} disabled={drafts[key] === config[key]}>
                      Save
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      )}

      <h3 style={{ marginTop: 16 }}>Add a new key</h3>
      <div className="row">
        <input placeholder="key, e.g. explain.custom" value={newKey} onChange={(e) => setNewKey(e.target.value)} style={{ width: 240 }} />
        <input placeholder="value" value={newValue} onChange={(e) => setNewValue(e.target.value)} style={{ flex: 1, minWidth: 240 }} />
        <button className="btn small" onClick={addNew}>
          Add
        </button>
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="card col" style={{ marginBottom: 0, textAlign: "center" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "1.8rem", fontWeight: 600, color: "var(--series-blue)" }}>
        {value.toLocaleString()}
      </div>
      <div className="muted small">{label}</div>
    </div>
  );
}

function VisitorsTab() {
  const [summary, setSummary] = useState<VisitSummary | null>(null);
  const [daily, setDaily] = useState<DailyVisitCount[] | null>(null);
  const [visits, setVisits] = useState<PageView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .adminVisitsSummary()
      .then((res) => {
        setSummary(res.summary);
        setDaily(res.daily);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load visitor stats."));
    api.adminVisitsRecent().then((res) => setVisits(res.visits));
  }, []);

  return (
    <>
      <div className="row" style={{ marginBottom: 20 }}>
        <StatTile label="Total page views" value={summary?.totalViews ?? 0} />
        <StatTile label="Unique visitors" value={summary?.uniqueVisitors ?? 0} />
        <StatTile label="Views today" value={summary?.viewsToday ?? 0} />
        <StatTile label="Views, last 7 days" value={summary?.views7d ?? 0} />
        <StatTile label="Views, last 30 days" value={summary?.views30d ?? 0} />
      </div>

      <div className="card">
        <h2>Traffic, last 30 days</h2>
        {error && (
          <p className="small" style={{ color: "var(--critical)" }}>
            {error}
          </p>
        )}
        {!daily ? (
          <p className="muted small">Loading...</p>
        ) : daily.length < 2 ? (
          <p className="muted small">Not enough days of traffic yet to plot a trend.</p>
        ) : (
          <LineChart
            series={[
              {
                label: "Views",
                color: "var(--series-blue)",
                points: daily.map((d, i) => ({ x: i, y: d.views })),
              },
              {
                label: "Unique visitors",
                color: "var(--series-orange)",
                points: daily.map((d, i) => ({ x: i, y: d.uniqueVisitors })),
              },
            ]}
            xLabel={`${daily[0].day} to ${daily[daily.length - 1].day}`}
            yLabel="Count"
          />
        )}
      </div>

      <div className="card">
        <h2>Recent visits</h2>
        <p className="muted small">
          One row per real page load (this app has no client-side router, so a full navigation is the only way a page
          load happens — see App.tsx). Anonymous visitors are identified by a first-party cookie, not by account.
        </p>
        {!visits ? (
          <p className="muted small">Loading...</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Path</th>
                  <th>Visitor</th>
                  <th>User</th>
                  <th>Referrer</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((v) => (
                  <tr key={v.id}>
                    <td className="small muted">{new Date(v.created_at).toLocaleString()}</td>
                    <td className="small">{v.path}</td>
                    <td className="small muted">{v.visitor_id.slice(0, 8)}</td>
                    <td className="small">{v.user_email ?? "—"}</td>
                    <td className="small muted">{v.referrer || "—"}</td>
                    <td className="small muted">{v.ip ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function AuditTab() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);

  useEffect(() => {
    api.adminAuditLog().then((res) => setEntries(res.entries));
  }, []);

  return (
    <div className="card">
      <h2>Audit log</h2>
      <p className="muted small">Every admin mutation (block/unblock, role changes, config edits) is recorded here.</p>
      {!entries ? (
        <p className="muted small">Loading...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="small muted">{new Date(e.created_at).toLocaleString()}</td>
                <td className="small">{e.actor_user_id ?? "—"}</td>
                <td className="small">{e.action}</td>
                <td className="small">{e.target ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
