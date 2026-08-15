/**
 * App.tsx — top-level wiring. Routing is deliberately not react-router:
 * there are exactly two real destinations (the explorer, and /admin), so a
 * single `window.location.pathname` check plus plain <a href> links (see
 * Header.tsx and AdminLoginPage.tsx) does the whole job with a full-page
 * navigation on the rare admin/back transitions — see ARCHITECTURE.md
 * "Why there's no client-side router".
 */
import { useEffect, useState } from "react";
import { api } from "./api";
import { Header } from "./components/Header";
import { UniverseEditor } from "./components/UniverseEditor";
import { ParameterPanel } from "./components/ParameterPanel";
import { WeightingPanel } from "./components/panels/WeightingPanel";
import { MeanVariancePanel } from "./components/panels/MeanVariancePanel";
import { PrincipalProtectionPanel } from "./components/panels/PrincipalProtectionPanel";
import { BarbellPanel } from "./components/panels/BarbellPanel";
import { MaxEntropyPanel } from "./components/panels/MaxEntropyPanel";
import { AdminLoginPage } from "./components/AdminLoginPage";
import { AdminDashboard } from "./components/AdminDashboard";
import { useParams } from "./state/useParams";
import { useSnapshot } from "./state/useSnapshot";
import { useAuth } from "./state/useAuth";
import { useConfig } from "./state/useConfig";
import { limits } from "./engine";
import type { PublicUser } from "./api";

type Tab = "weighting" | "meanVariance" | "principalProtection" | "barbell" | "maxEntropy";

const TABS: { key: Tab; label: string }[] = [
  { key: "weighting", label: "Weighting B(C)" },
  { key: "meanVariance", label: "Mean-variance" },
  { key: "principalProtection", label: "Principal protection" },
  { key: "barbell", label: "Barbell" },
  { key: "maxEntropy", label: "Max entropy" },
];

export function App() {
  const isAdminRoute = window.location.pathname.startsWith("/admin");
  const { user, googleConfigured, loading, refresh, logout } = useAuth();

  useEffect(() => {
    api.trackVisit(window.location.pathname, document.referrer).catch(() => {});
  }, []);

  if (isAdminRoute) {
    if (loading) {
      return (
        <div className="container">
          <p className="muted small">Loading...</p>
        </div>
      );
    }
    if (!user || user.role !== "admin") {
      return <AdminLoginPage onSuccess={refresh} />;
    }
    return <AdminDashboard user={user} />;
  }

  return <ExplorerHome user={user} googleConfigured={googleConfigured} onLogout={logout} />;
}

function ExplorerHome({
  user,
  googleConfigured,
  onLogout,
}: {
  user: PublicUser | null;
  googleConfigured: boolean;
  onLogout: () => void;
}) {
  const { params, setParams, reset, dirty } = useParams();
  const snapshot = useSnapshot(params);
  const { config } = useConfig();
  const [tab, setTab] = useState<Tab>("weighting");

  // The admin dashboard's "Site config" tab exposes limits.maxN and
  // limits.maxKFullDetail as editable text — this is what makes editing
  // them there actually take effect, by clamping to whichever is smaller
  // between that admin value and the engine's own performance-verified
  // ceiling (see ARCHITECTURE.md "Performance envelope"). An admin can
  // only ever tighten the cap, never loosen it past what's been verified.
  const effectiveMaxN = clampedConfigLimit(config["limits.maxN"], limits.MAX_N);
  const effectiveMaxK = clampedConfigLimit(config["limits.maxKFullDetail"], limits.MAX_K_FULL_DETAIL);

  return (
    <>
      <Header user={user} googleConfigured={googleConfigured} onLogout={onLogout} />
      <div className="container">
        <div className="card">
          <h1 style={{ marginTop: 0, marginBottom: 4 }}>Optimal Capital Partitioning Across Binary-Outcome Combinatorial Subsets</h1>
          <p className="muted small" style={{ marginTop: 0 }}>
            An interactive companion to the paper by Sibonelo Blessing Maduna. Every number below recomputes live in
            your browser as you move a slider — nothing round-trips to a server (see "Reset to defaults" if you want
            to get back to the paper's own worked example). <a href="/paper.pdf" target="_blank" rel="noreferrer">
              Read the full paper (PDF)
            </a>
            .
          </p>
        </div>

        <UniverseEditor params={params} setParams={setParams} maxN={effectiveMaxN} />
        <ParameterPanel
          params={params}
          setParams={setParams}
          reset={reset}
          dirty={dirty}
          snapshot={snapshot}
          user={user}
          maxKFullDetail={effectiveMaxK}
        />

        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t.key} className={tab === t.key ? "active" : ""} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </nav>

        {tab === "weighting" && <WeightingPanel snapshot={snapshot} config={config} />}
        {tab === "meanVariance" && <MeanVariancePanel snapshot={snapshot} lambda={params.lambda} config={config} />}
        {tab === "principalProtection" && (
          <PrincipalProtectionPanel snapshot={snapshot} params={params} setParams={setParams} config={config} />
        )}
        {tab === "barbell" && <BarbellPanel params={params} config={config} maxK={effectiveMaxK} />}
        {tab === "maxEntropy" && <MaxEntropyPanel snapshot={snapshot} config={config} />}

        <p className="muted small" style={{ marginTop: 30 }}>
          Built from the mathematical framework in the paper above. See <code>ARCHITECTURE.md</code> and{" "}
          <code>MATH.md</code> in the project repository for full implementation and derivation details.
        </p>
      </div>
    </>
  );
}

/**
 * Reads a site-config numeric override and clamps it to (0, engineCeiling].
 * Any parse failure, missing key, or admin-entered value above the
 * engine's own verified ceiling silently falls back to that ceiling — an
 * admin can tighten the interactive limits from the dashboard, but can
 * never loosen them past what's actually been performance-verified (see
 * ARCHITECTURE.md "Performance envelope").
 */
function clampedConfigLimit(raw: string | undefined, engineCeiling: number): number {
  const parsed = Number(raw);
  if (!raw || !Number.isFinite(parsed) || parsed <= 0) return engineCeiling;
  return Math.min(Math.floor(parsed), engineCeiling);
}
