'use client';

/**
 * 12-point trend line for stat tiles. Hand-drawn SVG rather than a chart
 * library: no axes, no tooltip, no interaction — the tile's value is the
 * message and the sparkline is context.
 */
export function Sparkline({
  values,
  color,
  width = 96,
  height = 28,
}: {
  values: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  const points = values.slice(-12);
  if (points.length < 2) return <div style={{ width, height }} aria-hidden />;

  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const span = max - min || 1;
  const step = width / (points.length - 1);

  const path = points
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / span) * (height - 4) - 2;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const lastX = (points.length - 1) * step;
  const lastY = height - ((points[points.length - 1] - min) / span) * (height - 4) - 2;

  return (
    <svg width={width} height={height} role="img" aria-hidden focusable="false">
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {/* 2px surface ring keeps the end-dot legible where it crosses the line. */}
      <circle cx={lastX} cy={lastY} r={3.5} fill={color} stroke="var(--surface-1)" strokeWidth={2} />
    </svg>
  );
}

export default Sparkline;
