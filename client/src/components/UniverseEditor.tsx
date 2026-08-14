import type { EventDef, Params } from "../engine";
import { limits } from "../engine";

/**
 * UniverseEditor — lets the user change n by adding/removing events and
 * editing each event's odds/true-probability. This is the "change n"
 * half of the "change n or k" requirement; k is a slider in
 * ParameterPanel bounded by the current universe size.
 *
 * `maxN` defaults to the engine's own performance-verified ceiling
 * (limits.MAX_N) but the caller passes down whatever's smaller between
 * that and the admin-editable `limits.maxN` site-config key — see
 * App.tsx's `effectiveMaxN`. This is what makes the admin dashboard's
 * limits editor actually take effect rather than being cosmetic.
 */
export function UniverseEditor({
  params,
  setParams,
  maxN = limits.MAX_N,
}: {
  params: Params;
  setParams: (fn: (p: Params) => Params) => void;
  maxN?: number;
}) {
  const { universe } = params;

  function updateEvent(index: number, patch: Partial<EventDef>) {
    setParams((p) => ({
      ...p,
      universe: p.universe.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    }));
  }

  function addEvent() {
    if (universe.length >= maxN) return;
    setParams((p) => ({
      ...p,
      universe: [...p.universe, { name: `Event ${p.universe.length + 1}`, oddsA: 1.9, oddsB: 1.9, trueProbA: 0.5 }],
    }));
  }

  function removeEvent(index: number) {
    setParams((p) => ({
      ...p,
      universe: p.universe.filter((_, i) => i !== index),
      k: Math.min(p.k, Math.max(1, p.universe.length - 1)),
    }));
  }

  return (
    <div className="card">
      <h2>1. The event universe (n = {universe.length})</h2>
      <p className="muted small">
        Each event has two decimal odds (a small vig — both sides pricing to slightly over 100% implied probability
        — is typical of real markets) and an optional "true" probability from your own model. Omit the true
        probability to assume the market is efficient.
      </p>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>odds(&middot;;1)</th>
            <th>odds(&middot;;2)</th>
            <th>True Pr(outcome 1)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {universe.map((e, i) => (
            <tr key={i}>
              <td>
                <input
                  type="text"
                  value={e.name}
                  onChange={(ev) => updateEvent(i, { name: ev.target.value })}
                  style={{ width: 130 }}
                />
              </td>
              <td>
                <input
                  type="number"
                  step={0.01}
                  min={1.01}
                  value={e.oddsA}
                  onChange={(ev) => updateEvent(i, { oddsA: Number(ev.target.value) })}
                  style={{ width: 70 }}
                />
              </td>
              <td>
                <input
                  type="number"
                  step={0.01}
                  min={1.01}
                  value={e.oddsB}
                  onChange={(ev) => updateEvent(i, { oddsB: Number(ev.target.value) })}
                  style={{ width: 70 }}
                />
              </td>
              <td>
                <input
                  type="number"
                  step={0.01}
                  min={0.01}
                  max={0.99}
                  value={e.trueProbA ?? ""}
                  placeholder={(1 / e.oddsA).toFixed(3)}
                  onChange={(ev) =>
                    updateEvent(i, { trueProbA: ev.target.value === "" ? undefined : Number(ev.target.value) })
                  }
                  style={{ width: 70 }}
                />
              </td>
              <td>
                <button className="btn danger small" onClick={() => removeEvent(i)} disabled={universe.length <= 1}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 10 }}>
        <button className="btn secondary small" onClick={addEvent} disabled={universe.length >= maxN}>
          + Add event
        </button>
        {universe.length >= maxN && (
          <span className="muted small" style={{ marginLeft: 8 }}>
            Capped at n={maxN} to keep every panel responsive.
          </span>
        )}
      </div>
    </div>
  );
}
