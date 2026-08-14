import { useState } from "react";
import type { Params, Snapshot } from "../engine";
import { limits } from "../engine";
import { api, type PublicUser } from "../api";

/**
 * ParameterPanel — every global slider (k, alpha, lambda, tau, capital),
 * plus "Reset to defaults" (pure client state, instant, see useParams.ts)
 * and "Save/Load preset" (round-trips to /api/settings, signed-in users
 * only — see ARCHITECTURE.md "Reset to defaults vs. saved presets").
 */
export function ParameterPanel({
  params,
  setParams,
  reset,
  dirty,
  snapshot,
  user,
  maxKFullDetail = limits.MAX_K_FULL_DETAIL,
}: {
  params: Params;
  setParams: (fn: (p: Params) => Params) => void;
  reset: () => void;
  dirty: boolean;
  snapshot: Snapshot;
  user: PublicUser | null;
  /** Smaller of the engine's own ceiling and the admin-editable `limits.maxKFullDetail` site-config key (see App.tsx). */
  maxKFullDetail?: number;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const maxK = Math.min(params.universe.length, maxKFullDetail);
  const [tauLo, tauHi] = snapshot.tauRange;

  async function savePreset() {
    try {
      await api.settingsSave(params);
      setStatus("Preset saved.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to save preset.");
    }
  }

  async function loadPreset() {
    try {
      const res = await api.settingsGet();
      if (res.params) {
        setParams(() => res.params as Params);
        setStatus("Preset loaded.");
      } else {
        setStatus("No saved preset yet.");
      }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Failed to load preset.");
    }
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <h2>2. Parameters</h2>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn secondary small" onClick={reset} disabled={!dirty}>
            Reset to defaults
          </button>
          {user && (
            <>
              <button className="btn secondary small" onClick={savePreset}>
                Save preset
              </button>
              <button className="btn secondary small" onClick={loadPreset}>
                Load preset
              </button>
            </>
          )}
        </div>
      </div>
      {!user && (
        <p className="muted small">Sign in with Google to save a preset and reload it later on any device.</p>
      )}
      {status && <p className="small" style={{ color: "var(--series-blue)" }}>{status}</p>}

      <div className="row">
        <div className="col slider-row">
          <label>
            Subset size k (combinations = 2<sup>k</sup> = {2 ** Math.min(params.k, maxK)}){" "}
            <span className="slider-value">{Math.min(params.k, maxK)}</span>
          </label>
          <input
            type="range"
            min={1}
            max={Math.max(1, maxK)}
            step={1}
            value={Math.min(params.k, maxK)}
            onChange={(e) => setParams((p) => ({ ...p, k: Number(e.target.value) }))}
          />
        </div>
        <div className="col slider-row">
          <label>
            Weighting exponent &alpha; <span className="slider-value">{params.alpha.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min={0}
            max={5}
            step={0.05}
            value={params.alpha}
            onChange={(e) => setParams((p) => ({ ...p, alpha: Number(e.target.value) }))}
          />
        </div>
      </div>

      <div className="row">
        <div className="col slider-row">
          <label>
            Risk aversion &lambda; (mean-variance) <span className="slider-value">{params.lambda.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min={0}
            max={10}
            step={0.1}
            value={params.lambda}
            onChange={(e) => setParams((p) => ({ ...p, lambda: Number(e.target.value) }))}
          />
        </div>
        <div className="col slider-row">
          <label>
            Target return &tau; (max-entropy), feasible [{tauLo.toFixed(3)}, {tauHi.toFixed(3)}]{" "}
            <span className="slider-value">{params.tau.toFixed(3)}</span>
          </label>
          <input
            type="range"
            min={tauLo}
            max={tauHi}
            step={(tauHi - tauLo) / 200 || 0.001}
            value={Math.min(Math.max(params.tau, tauLo), tauHi)}
            onChange={(e) => setParams((p) => ({ ...p, tau: Number(e.target.value) }))}
          />
        </div>
      </div>

      <div className="slider-row" style={{ maxWidth: 260 }}>
        <label>Total capital P</label>
        <input
          type="number"
          min={1}
          step={100}
          value={params.capital}
          onChange={(e) => setParams((p) => ({ ...p, capital: Number(e.target.value) }))}
        />
      </div>
    </div>
  );
}
