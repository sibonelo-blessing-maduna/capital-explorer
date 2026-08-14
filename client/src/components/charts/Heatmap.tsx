/**
 * Heatmap — diverging blue<->red matrix view for Sigma (dataviz skill:
 * "diverging = two hues + a neutral gray midpoint", used here for a
 * signed quantity — covariance — around zero).
 */
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(hexA: string, hexB: string, t: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const c = a.map((v, i) => Math.round(lerp(v, b[i], t)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

const BLUE = "#3987e5";
const GRAY = "#383835";
const RED = "#e66767";

function colorFor(value: number, maxAbs: number): string {
  const t = maxAbs === 0 ? 0 : value / maxAbs; // in [-1, 1]
  return t < 0 ? mix(GRAY, BLUE, Math.min(1, -t)) : mix(GRAY, RED, Math.min(1, t));
}

export function Heatmap({ matrix, labels, cellSize = 34 }: { matrix: number[][]; labels: string[]; cellSize?: number }) {
  const n = matrix.length;
  const maxAbs = Math.max(...matrix.flat().map((v) => Math.abs(v)), 1e-9);
  const margin = { left: 34, top: 34 };
  const size = n * cellSize;

  return (
    <svg width={margin.left + size + 90} height={margin.top + size} role="img" aria-label="Covariance matrix heatmap">
      {labels.map((l, i) => (
        <text key={`col-${i}`} x={margin.left + i * cellSize + cellSize / 2} y={margin.top - 8} textAnchor="middle" fontSize={9} fill="var(--text-muted)">
          {l}
        </text>
      ))}
      {labels.map((l, i) => (
        <text key={`row-${i}`} x={margin.left - 6} y={margin.top + i * cellSize + cellSize / 2 + 3} textAnchor="end" fontSize={9} fill="var(--text-muted)">
          {l}
        </text>
      ))}
      {matrix.map((row, i) =>
        row.map((v, j) => (
          <rect
            key={`${i}-${j}`}
            x={margin.left + j * cellSize}
            y={margin.top + i * cellSize}
            width={cellSize - 1}
            height={cellSize - 1}
            fill={colorFor(v, maxAbs)}
            rx={1}
          >
            <title>{`Cov(C${i + 1}, C${j + 1}) = ${v.toFixed(4)}`}</title>
          </rect>
        ))
      )}
      {/* legend */}
      <g transform={`translate(${margin.left + size + 16}, ${margin.top})`}>
        {Array.from({ length: 10 }, (_, i) => {
          const t = 1 - i / 9;
          const val = maxAbs * (2 * t - 1);
          return <rect key={i} x={0} y={i * 12} width={14} height={12} fill={colorFor(val, maxAbs)} />;
        })}
        <text x={20} y={8} fontSize={9} fill="var(--text-muted)">
          +{maxAbs.toFixed(2)}
        </text>
        <text x={20} y={112} fontSize={9} fill="var(--text-muted)">
          -{maxAbs.toFixed(2)}
        </text>
      </g>
    </svg>
  );
}
