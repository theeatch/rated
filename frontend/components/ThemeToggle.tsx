'use client';

import { useEffect, useState } from 'react';

type Choice = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'rateflow-theme';

/**
 * Stamps `data-theme` on <html>. Dark mode is a selected set of tokens, not an
 * inverted light theme — see app/globals.css.
 */
export function ThemeToggle() {
  const [choice, setChoice] = useState<Choice>('system');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') setChoice(stored);
  }, []);

  const apply = (next: Choice) => {
    setChoice(next);
    if (next === 'system') {
      delete document.documentElement.dataset.theme;
      localStorage.removeItem(STORAGE_KEY);
    } else {
      document.documentElement.dataset.theme = next;
      localStorage.setItem(STORAGE_KEY, next);
    }
  };

  return (
    <div
      role="group"
      aria-label="Color theme"
      className="flex items-center gap-0.5 rounded-lg p-0.5"
      style={{ border: '1px solid var(--border)' }}
    >
      {(['light', 'system', 'dark'] as Choice[]).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => apply(option)}
          aria-pressed={choice === option}
          className="rounded-md px-2 py-0.5 text-[11px] capitalize transition-colors"
          style={{
            color: choice === option ? 'var(--text-primary)' : 'var(--text-muted)',
            background:
              choice === option
                ? 'color-mix(in oklab, var(--text-primary) 8%, transparent)'
                : 'transparent',
          }}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export default ThemeToggle;
