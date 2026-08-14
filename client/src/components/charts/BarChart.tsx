/**
 * BarChart — minimal hand-rolled SVG bar chart with a 2px surface gap
 * between bars (dataviz skill mark spec) and a single sequential-blue hue
 * by default (magnitude encoding).
 */
export function BarChart({
  values,
  labels,
  width = 520,
  height = 220,
  color = "var(--series-blue)",
  yLabel,
}: {
  values: number[];
  labels: string[];
  width?: number;
  height?: number;
  color?: string;
  yLabel?: string;
}) {
  const margin = { top: 14, right: 12, bottom: 44, left: 56 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const maxV = Math.max(...values, 0.0001);
  const barGap = 2;
  const barW = Math.max(2, innerW / values.length - barGap);

  return (
    <svg width={width} height={height} role="img" aria-label={yLabel}>
      <line x1={margin.left} x2={width - margin.right} y1={margin.top + innerH} y2={margin.top + innerH} stroke="var(--border)" />
      {values.map((v, i) => {
        const h = (v / maxV) * innerH;
        const x = margin.left + i * (barW + barGap);
        const y = margin.top + innerH - h;
        return <rect key={i} x={x} y={y} width={barW} height={h} fill={color} rx={2} />;
      })}
      {labels.map((l, i) => {
        if (values.length > 16 && i % Math.ceil(values.length / 16) !== 0) return null;
        const x = margin.left + i * (barW + barGap) + barW / 2;
        return (
          <text key={i} x={x} y={height - 10} textAnchor="middle" fontSize={9} fill="var(--text-muted)">
            {l}
          </text>
        );
      })}
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
    </svg>
  );
}

export function GroupedBarChart({
  groups,
  seriesLabels,
  seriesColors,
  labels,
  width = 640,
  height = 260,
  yLabel,
}: {
  /** groups[i] = array of values (one per series) for category i */
  groups: number[][];
  seriesLabels: string[];
  seriesColors: string[];
  labels: string[];
  width?: number;
  height?: number;
  yLabel?: string;
}) {
  const margin = { top: 20, right: 16, bottom: 40, left: 60 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const maxV = Math.max(...groups.flat(), 0.0001);
  const groupGap = 10;
  const groupW = innerW / groups.length - groupGap;
  const barGap = 1;
  const nSeries = seriesLabels.length;
  const barW = Math.max(1, (groupW - barGap * (nSeries - 1)) / nSeries);

  return (
    <svg width={width} height={height} role="img" aria-label={yLabel}>
      <line x1={margin.left} x2={width - margin.right} y1={margin.top + innerH} y2={margin.top + innerH} stroke="var(--border)" />
      {groups.map((vals, gi) => {
        const gx = margin.left + gi * (groupW + groupGap);
        return (
          <g key={gi}>
            {vals.map((v, si) => {
              const h = (v / maxV) * innerH;
              const x = gx + si * (barW + barGap);
              const y = margin.top + innerH - h;
              return <rect key={si} x={x} y={y} width={barW} height={h} fill={seriesColors[si]} rx={1.5} />;
            })}
            <text x={gx + groupW / 2} y={height - 12} textAnchor="middle" fontSize={9} fill="var(--text-muted)">
              {labels[gi]}
            </text>
          </g>
        );
      })}
      <g transform={`translate(${margin.left},4)`}>
        {seriesLabels.map((l, i) => (
          <g key={l} transform={`translate(${i * 90},0)`}>
            <rect x={0} y={0} width={9} height={9} fill={seriesColors[i]} rx={2} />
            <text x={13} y={8} fontSize={10} fill="var(--text-secondary)">
              {l}
            </text>
          </g>
        ))}
      </g>
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
    </svg>
  );
}
