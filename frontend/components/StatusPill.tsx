'use client';

type Tone = 'good' | 'warning' | 'serious' | 'critical' | 'neutral';

const TONE_COLOR: Record<Tone, string> = {
  good: 'var(--status-good)',
  warning: 'var(--status-warning)',
  serious: 'var(--status-serious)',
  critical: 'var(--status-critical)',
  neutral: 'var(--text-muted)',
};

const TONE_GLYPH: Record<Tone, string> = {
  good: '●',
  warning: '▲',
  serious: '▲',
  critical: '■',
  neutral: '○',
};

/**
 * Status is never carried by color alone — every pill ships a glyph and a
 * written label, which is what keeps warning/serious legible on the light
 * surface where they sit below 3:1.
 */
export function StatusPill({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className="chip">
      <span aria-hidden style={{ color: TONE_COLOR[tone], fontSize: '9px', lineHeight: 1 }}>
        {TONE_GLYPH[tone]}
      </span>
      <span>{label}</span>
    </span>
  );
}

export default StatusPill;
