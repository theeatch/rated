'use client';

import { useState } from 'react';

import { resetPolicy, updatePolicy } from '@/lib/api';
import type { Policy } from '@/lib/types';

/**
 * Policy inspector with inline overrides.
 *
 * Edits are sent through /api/proxy, which attaches the admin token
 * server-side — the browser never holds a credential.
 */
export function PolicyTable({ policies, onChange }: { policies: Policy[]; onChange?: () => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ capacity: string; refillRate: string }>({
    capacity: '',
    refillRate: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = (policy: Policy) => {
    setError(null);
    setEditing(policy.name);
    setDraft({ capacity: String(policy.capacity), refillRate: String(policy.refillRate) });
  };

  const save = async (name: string) => {
    setBusy(true);
    setError(null);
    try {
      await updatePolicy(name, {
        capacity: Number(draft.capacity),
        refillRate: Number(draft.refillRate),
      });
      setEditing(null);
      onChange?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const revert = async (name: string) => {
    setBusy(true);
    setError(null);
    try {
      await resetPolicy(name);
      onChange?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Reset failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card" aria-label="Rate limit policies">
      <header className="mb-2">
        <h2 className="card-title">Policies</h2>
        <p className="card-subtitle">
          Bucket capacity is the burst allowance; refill rate is the sustained rate
        </p>
      </header>

      {error ? (
        <p className="mb-2 text-[12px]" style={{ color: 'var(--status-critical)' }}>
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="data-table tabular">
          <thead>
            <tr>
              <th scope="col">Policy</th>
              <th scope="col">Scope</th>
              <th scope="col">Capacity</th>
              <th scope="col">Refill / s</th>
              <th scope="col">Cost</th>
              <th scope="col">Sustained</th>
              <th scope="col" />
            </tr>
          </thead>
          <tbody>
            {policies.map((policy) => {
              const isEditing = editing === policy.name;
              return (
                <tr key={policy.name}>
                  <td>
                    <span style={{ color: 'var(--text-primary)' }}>{policy.name}</span>
                    {policy.overridden ? (
                      <span className="ml-1.5 text-[10px]" style={{ color: 'var(--status-warning)' }}>
                        override
                      </span>
                    ) : null}
                    <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {policy.description}
                    </div>
                  </td>
                  <td>{policy.scope}</td>
                  <td>
                    {isEditing ? (
                      <input
                        className="control w-20"
                        type="number"
                        min={1}
                        value={draft.capacity}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, capacity: event.target.value }))
                        }
                        aria-label={`${policy.name} capacity`}
                      />
                    ) : (
                      policy.capacity
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        className="control w-20"
                        type="number"
                        min={0}
                        step="0.1"
                        value={draft.refillRate}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, refillRate: event.target.value }))
                        }
                        aria-label={`${policy.name} refill rate`}
                      />
                    ) : (
                      policy.refillRate
                    )}
                  </td>
                  <td>{policy.cost}</td>
                  <td>{policy.refillRate * 60} / min</td>
                  <td className="whitespace-nowrap text-right">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary mr-1"
                          disabled={busy}
                          onClick={() => void save(policy.name)}
                        >
                          Save
                        </button>
                        <button type="button" className="btn" onClick={() => setEditing(null)}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn mr-1"
                          onClick={() => startEdit(policy)}
                        >
                          Edit
                        </button>
                        {policy.overridden ? (
                          <button
                            type="button"
                            className="btn"
                            disabled={busy}
                            onClick={() => void revert(policy.name)}
                          >
                            Revert
                          </button>
                        ) : null}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default PolicyTable;
