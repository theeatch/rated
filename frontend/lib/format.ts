/** Compact display value: 1,284 · 12.9K · 4.2M */
export const compact = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString(undefined, { maximumFractionDigits: abs < 10 ? 1 : 0 });
};

export const percent = (ratio: number | null | undefined, digits = 0): string =>
  ratio === null || ratio === undefined || Number.isNaN(ratio)
    ? '—'
    : `${(ratio * 100).toFixed(digits)}%`;

export const bytes = (value: number | null | undefined): string => {
  if (!value && value !== 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
};

export const duration = (seconds: number | null | undefined): string => {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86_400)}d ${Math.floor((seconds % 86_400) / 3600)}h`;
};

export const clockTime = (timestamp: number): string =>
  new Date(timestamp).toLocaleTimeString(undefined, {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

/** Axis ticks: whole numbers, thousands-comma'd. */
export const axisTick = (value: number): string =>
  value >= 1000 ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k` : String(Math.round(value));

export const shortIdentity = (identity: string, max = 24): string =>
  identity.length <= max ? identity : `${identity.slice(0, max - 1)}…`;
