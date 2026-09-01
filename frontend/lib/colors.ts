'use client';

import { useEffect, useState } from 'react';

/**
 * Chart palette.
 *
 * Recharts writes colors as SVG presentation attributes, which do not resolve
 * `var(--token)` — so the values live here in TS and are mirrored as CSS
 * custom properties in `app/globals.css`. Change both together.
 *
 * Validated with the data-viz six checks against both surfaces (#fcfcfb light,
 * #1a1a19 dark): lightness band, chroma floor, CVD separation
 * (worst pair ΔE 23.8 light / 25.7 dark), normal-vision floor, contrast ≥ 3:1.
 *
 * `allowed` is categorical slot 1 (blue). `blocked` is the reserved status
 * "critical" step — identical in both modes — and always ships with a label,
 * never color alone.
 */
export const PALETTE = {
  light: {
    surface: '#fcfcfb',
    plane: '#f9f9f7',
    grid: '#e1e0d9',
    axis: '#c3c2b7',
    muted: '#898781',
    textPrimary: '#0b0b0b',
    textSecondary: '#52514e',
    allowed: '#2a78d6',
    blocked: '#d03b3b',
    accent: '#2a78d6',
    warning: '#fab219',
    good: '#0ca30c',
    serious: '#ec835a',
  },
  dark: {
    surface: '#1a1a19',
    plane: '#0d0d0d',
    grid: '#2c2c2a',
    axis: '#383835',
    muted: '#898781',
    textPrimary: '#ffffff',
    textSecondary: '#c3c2b7',
    allowed: '#3987e5',
    blocked: '#d03b3b',
    accent: '#3987e5',
    warning: '#fab219',
    good: '#0ca30c',
    serious: '#ec835a',
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
