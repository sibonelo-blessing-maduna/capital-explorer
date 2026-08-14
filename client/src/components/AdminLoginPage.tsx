import { useState } from "react";
import { api } from "../api";

/**
 * AdminLoginPage — email/password login, reachable only via /admin when
 * not already signed in as an admin. This is the *only* account that can
 * authenticate with a password at all; every regular visitor uses Google
 * (see ARCHITECTURE.md "Two authentication paths, one users table").
 */
export function AdminLoginPage({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.adminLogin(email, password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <div className="card">
        <h2>Admin sign-in</h2>
        <p className="muted small">
          This is a separate credential from the Google sign-in every other visitor uses. If you're not an
          administrator, use "Continue with Google" from the home page instead.
        </p>
        <form onSubmit={submit}>
          <div className="slider-row">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: "100%" }} />
          </div>
          <div className="slider-row">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: "100%" }}
            />
          </div>
          {error && (
            <p className="small" style={{ color: "var(--critical)" }}>
              {error}
            </p>
          )}
          <button className="btn" type="submit" disabled={busy}>
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="muted small" style={{ marginTop: 14 }}>
          <a href="/">&larr; Back to the explorer</a>
        </p>
      </div>
    </div>
  );
}
