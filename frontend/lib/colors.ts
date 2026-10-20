'use client';

import { useEffect, useState } from 'react';

/**
 * Chart palette.
 *
 * Recharts writes colors as SVG presentation attributes, which do not resolve
 * `var(--token)` — so the values live here in TS and are mirrored as CSS
 * custom properties in `app/globals.css`. Change both together.
 *
 * The palette is warm paper and ink plus three signal hues: teal (allowed,
 * healthy, the one accent), vermilion (blocked, critical) and ochre (warning).
 * Checked against both card surfaces (#f7f4ec light, #1a1913 dark): every
 * series and status hue is ≥ 3.8:1 in light and ≥ 5.7:1 in dark, muted text is
 * ≥ 5:1, and teal vs vermilion stays at ΔE ≥ 43 under simulated protanopia,
 * deuteranopia and tritanopia.
 *
 * `blocked` is the "critical" step and always ships with a label, never color
 * alone.
 */
export const PALETTE = {
  light: {
    surface: '#f7f4ec',
    plane: '#efebe1',
    grid: '#ddd6c4',
    axis: '#a9a18c',
    muted: '#6b675a',
    textPrimary: '#17160f',
    textSecondary: '#4b483e',
    allowed: '#0b6b6b',
    blocked: '#d23f17',
    accent: '#0b6b6b',
    warning: '#a8700c',
    good: '#0b6b6b',
    serious: '#c25a12',
  },
  dark: {
    surface: '#1a1913',
    plane: '#11100c',
    grid: '#2a2820',
    axis: '#4a473b',
    muted: '#8f8a79',
    textPrimary: '#ede8db',
    textSecondary: '#bdb7a6',
    allowed: '#3db8ae',
    blocked: '#f2693f',
    accent: '#3db8ae',
    warning: '#e2a630',
    good: '#3db8ae',
    serious: '#e8833a',
  },
} as const;

export type Mode = keyof typeof PALETTE;
/** Widened from the `as const` literals so both modes share one type. */
export type ChartColors = Record<keyof (typeof PALETTE)['light'], string>;

const readMode = (): Mode => {
  if (typeof document === 'undefined') return 'light';
  const stamped = document.documentElement.dataset.theme;
  if (stamped === 'dark' || stamped === 'light') return stamped;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

/**
 * Resolved light/dark mode, tracking both the OS setting and the in-app toggle
 * (which stamps `data-theme` on <html> and must win in either direction).
 */
export const useMode = (): Mode => {
  const [mode, setMode] = useState<Mode>('light');

  useEffect(() => {
    const sync = () => setMode(readMode());
    sync();

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', sync);

    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      media.removeEventListener('change', sync);
      observer.disconnect();
    };
  }, []);

  return mode;
};

export const useChartColors = (): ChartColors => PALETTE[useMode()];

/**
 * Meter fill by severity — the fill carries state, and every meter also prints
 * its numeric value, so severity is never color-alone.
 */
export const utilizationColor = (ratio: number, colors: ChartColors): string => {
  if (ratio >= 0.9) return colors.blocked;
  if (ratio >= 0.7) return colors.warning;
  return colors.accent;
};

export const utilizationLabel = (ratio: number): string => {
  if (ratio >= 0.9) return 'Critical';
  if (ratio >= 0.7) return 'Elevated';
  if (ratio >= 0.3) return 'Nominal';
  return 'Idle';
};
