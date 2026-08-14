/**
 * useParams.ts — the single source of truth for every tweakable parameter
 * (universe, k, alpha, lambda, tau, capital), plus "reset to defaults".
 *
 * Design note (see ARCHITECTURE.md "Reset to defaults vs. saved presets"):
 * resetting is pure client-side state assignment — it never touches the
 * server, so it is instant and available whether or not you're signed in.
 * Saving/loading a preset (separate buttons in ParameterPanel) is the only
 * path that talks to /api/settings, and only for signed-in users.
 */
import { useCallback, useEffect, useState } from "react";
import type { EventDef, Params } from "../engine";

export const DEFAULT_UNIVERSE: EventDef[] = [
  { name: "Team A vs B", oddsA: 1.85, oddsB: 2.05, trueProbA: 0.53 },
  { name: "Team C vs D", oddsA: 1.55, oddsB: 2.55, trueProbA: 0.6 },
  { name: "Team E vs F", oddsA: 2.2, oddsB: 1.75, trueProbA: 0.44 },
  { name: "Team G vs H", oddsA: 1.4, oddsB: 3.1, trueProbA: 0.68 },
  { name: "Team I vs J", oddsA: 2.6, oddsB: 1.55, trueProbA: 0.37 },
  { name: "Team K vs L", oddsA: 1.95, oddsB: 1.95, trueProbA: 0.5 },
];

export const DEFAULT_PARAMS: Params = {
  universe: DEFAULT_UNIVERSE,
  k: 3,
  alpha: 1.0,
  lambda: 2.0,
  tau: -0.076,
  capital: 10000,
};

function cloneDefaults(): Params {
  return { ...DEFAULT_PARAMS, universe: DEFAULT_UNIVERSE.map((e) => ({ ...e })) };
}

const STORAGE_EVENT = "capital-explorer:params-changed";

export function useParams() {
  const [params, setParamsState] = useState<Params>(() => cloneDefaults());
  const [dirty, setDirty] = useState(false); // true once the user has touched anything, for the "Reset" button's affordance

  const setParams = useCallback((updater: Params | ((prev: Params) => Params)) => {
    setParamsState((prev) => {
      const next = typeof updater === "function" ? (updater as (p: Params) => Params)(prev) : updater;
      return next;
    });
    setDirty(true);
  }, []);

  const reset = useCallback(() => {
    setParamsState(cloneDefaults());
    setDirty(false);
  }, []);

  const applyPreset = useCallback((preset: Params) => {
    setParamsState(preset);
    setDirty(true);
  }, []);

  return { params, setParams, reset, applyPreset, dirty };
}
