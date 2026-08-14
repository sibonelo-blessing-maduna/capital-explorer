/**
 * LineChart — minimal hand-rolled SVG line chart. One axis, thin marks,
 * recessive gridlines, a single categorical hue per series (dataviz
 * skill: "assign categorical hues in fixed order", "one axis").
 */
export interface Series {
  label: string;
  color: string;
  points: { x: number; y: number }[];
}

export function LineChart({
  series,
  width = 520,
  height = 260,
  xLabel,
  yLabel,
  markerX, // optional vertical reference line (e.g. current parameter value)
}: {
  series: Series[];
  width?: number;
  height?: number;
  xLabel?: string;
  yLabel?: string;
  markerX?: number;
}) {
  const margin = { top: 16, right: 16, bottom: 36, left: 56 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const allPoints = series.flatMap((s) => s.points);
  if (allPoints.length === 0) return null;
  const xMin = Math.min(...allPoints.map((p) => p.x));
  const xMax = Math.max(...allPoints.map((p) => p.x));
  const yMin = Math.min(0, ...allPoints.map((p) => p.y));
  const yMax = Math.max(...allPoints.map((p) => p.y));
  const yPad = (yMax - yMin) * 0.08 || 1;

  const sx = (x: number) => margin.left + ((x - xMin) / (xMax - xMin || 1)) * innerW;
  const sy = (y: number) =>
    margin.top + innerH - ((y - (yMin - yPad)) / (yMax + yPad - (yMin - yPad) || 1)) * innerH;

  const gridYs = 5;

  return (
    <svg width={width} height={height} role="img" aria-label={yLabel}>
      {Array.from({ length: gridYs + 1 }, (_, i) => {
        const y = margin.top + (innerH * i) / gridYs;
        return <line key={i} x1={margin.left} x2={width - margin.right} y1={y} y2={y} stroke="var(--grid-line)" strokeWidth={1} />;
      })}
      <line x1={margin.left} x2={margin.left} y1={margin.top} y2={margin.top + innerH} stroke="var(--border)" />
      <line x1={margin.left} x2={width - margin.right} y1={margin.top + innerH} y2={margin.top + innerH} stroke="var(--border)" />

      {markerX !== undefined && (
        <line
          x1={sx(markerX)}
          x2={sx(markerX)}
          y1={margin.top}
          y2={margin.top + innerH}
          stroke="var(--text-muted)"
          strokeDasharray="4 3"
          strokeWidth={1}
        />
      )}

      {series.map((s) => (
        <polyline
          key={s.label}
          fill="none"
          stroke={s.color}
          strokeWidth={2}
          points={s.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(" ")}
        />
      ))}

      {xLabel && (
        <text x={margin.left + innerW / 2} y={height - 6} textAnchor="middle" fill="var(--text-muted)" fontSize={11}>
          {xLabel}
        </text>
      )}
      {yLabel && (
        <text
          x={14}
          y={margin.top + innerH / 2}
          textAnchor="middle"
          fill="var(--text-muted)"
          fontSize={11}
          transform={`rotate(-90 14 ${margin.top + innerH / 2})`}
        >
          {yLabel}
        </text>
      )}

      {series.length > 1 && (
        <g transform={`translate(${width - margin.right - 8},${margin.top + 4})`}>
          {series.map((s, i) => (
            <g key={s.label} transform={`translate(0, ${i * 16})`}>
              <rect x={-90} y={-8} width={10} height={10} fill={s.color} rx={2} />
              <text x={-76} y={0} fontSize={10} fill="var(--text-secondary)">
                {s.label}
              </text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}
