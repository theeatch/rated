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
      className="flex items-center"
      style={{ border: '1px solid var(--rule)' }}
    >
      {(['light', 'system', 'dark'] as Choice[]).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => apply(option)}
          aria-pressed={choice === option}
          className="label px-2.5 py-1"
          style={{
            color: choice === option ? 'var(--on-ink)' : 'var(--text-muted)',
            background: choice === option ? 'var(--text-primary)' : 'transparent',
          }}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export default ThemeToggle;
