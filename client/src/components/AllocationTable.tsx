import { useMemo, useState } from "react";
import { comboLabel, type Combination } from "../engine";

/**
 * AllocationTable — renders combination -> stake. At k=14 there are 16,384
 * rows; rendering all of them as DOM nodes on every keystroke would itself
 * become the bottleneck the math engine's performance work was trying to
 * avoid (see ARCHITECTURE.md "Performance envelope"). Default view is the
 * top N by stake, which is also the more useful view in practice; a toggle
 * reveals everything for subsets small enough that it's still legible.
 */
export function AllocationTable({
  combos,
  stakes,
  defaultTopN = 15,
  fullListWarnThreshold = 256,
}: {
  combos: Combination[];
  stakes: number[];
  defaultTopN?: number;
  fullListWarnThreshold?: number;
}) {
  const [showAll, setShowAll] = useState(false);

  const rows = useMemo(() => {
    const indexed = combos.map((c, i) => ({ combo: c, stake: stakes[i] ?? 0, i }));
    indexed.sort((a, b) => b.stake - a.stake);
    return showAll ? indexed : indexed.slice(0, defaultTopN);
  }, [combos, stakes, showAll, defaultTopN]);

  const total = stakes.reduce((a, b) => a + b, 0);

  return (
    <div>
      <table>
        <thead>
          <tr>
            <th>Combination</th>
            <th>Odds O(C)</th>
            <th>Implied Pr</th>
            <th>Stake</th>
            <th>% of capital</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ combo, stake, i }) => (
            <tr key={i}>
              <td>{comboLabel(combo)}</td>
              <td>{combo.odds.toFixed(3)}</td>
              <td>{(combo.impliedProbability * 100).toFixed(2)}%</td>
              <td>{stake.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
              <td>{total > 0 ? ((stake / total) * 100).toFixed(2) : "0.00"}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      {combos.length > defaultTopN && (
        <div style={{ marginTop: 8 }}>
          <button className="btn secondary small" onClick={() => setShowAll((s) => !s)}>
            {showAll ? `Show top ${defaultTopN} only` : `Show all ${combos.length} combinations`}
          </button>
          {!showAll && (
            <span className="muted small" style={{ marginLeft: 8 }}>
              Showing top {Math.min(defaultTopN, combos.length)} of {combos.length} by stake.
            </span>
          )}
          {showAll && combos.length > fullListWarnThreshold && (
            <span className="muted small" style={{ marginLeft: 8 }}>
              {combos.length} rows — this is a lot of DOM, consider reducing k.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
