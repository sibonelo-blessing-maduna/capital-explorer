import type { PublicUser } from "../api";

export function Header({
  user,
  googleConfigured,
  onLogout,
}: {
  user: PublicUser | null;
  googleConfigured: boolean;
  onLogout: () => void;
}) {
  return (
    <header className="app-header">
      <div>
        <strong>Optimal Capital Partitioning</strong>
        <span className="muted small" style={{ marginLeft: 10 }}>
          Interactive explorer — S. B. Maduna
        </span>
      </div>
      <div className="row" style={{ alignItems: "center", gap: 12 }}>
        {user ? (
          <>
            {user.avatarUrl && (
              <img src={user.avatarUrl} alt="" width={24} height={24} style={{ borderRadius: "50%" }} />
            )}
            <span className="small">{user.name || user.email}</span>
            {user.role === "admin" && <span className="badge admin">Admin</span>}
            {user.role === "admin" && (
              <a href="/admin" className="small">
                Admin panel
              </a>
            )}
            <button className="btn secondary small" onClick={onLogout}>
              Sign out
            </button>
          </>
        ) : (
          <a href="/api/auth/google" className="btn small" style={{ pointerEvents: googleConfigured ? "auto" : "none", opacity: googleConfigured ? 1 : 0.5 }}>
            Continue with Google
          </a>
        )}
      </div>
    </header>
  );
}
