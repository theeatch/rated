'use client';

import { useCallback, useEffect, useState } from 'react';

import { PolicyTable } from '@/components/PolicyTable';
import { TokenUtilizationPanel } from '@/components/TokenUtilizationPanel';
import { fetchPolicies, fetchSummary } from '@/lib/api';
import type { MetricsSummary, Policy } from '@/lib/types';

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [policyResponse, summaryResponse] = await Promise.all([
        fetchPolicies(),
        fetchSummary(60),
      ]);
      setPolicies(policyResponse.policies);
      setSummary(summaryResponse);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load policies');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <header className="mb-4">
        <h1 className="text-[18px] font-semibold">Policies</h1>
        <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
          Overrides apply immediately across every API node — they are stored in Redis and picked
          up on the next refresh.
        </p>
      </header>

      {error ? (
        <p className="mb-3 text-[12px]" style={{ color: 'var(--status-critical)' }} role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4">
        <PolicyTable policies={policies} onChange={() => void load()} />
        {summary ? <TokenUtilizationPanel utilization={summary.utilization} /> : null}
      </div>
    </>
  );
}
