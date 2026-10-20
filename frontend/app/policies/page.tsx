'use client';

import { useCallback, useEffect, useState } from 'react';

import { LoadingScreen } from '@/components/LoadingScreen';
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

  // Neither a result nor an error yet: the first request is still in flight.
  if (!summary && !error) return <LoadingScreen />;

  return (
    <>
      <header className="mb-6">
        <h1 className="page-title">Policies</h1>
        <p className="mt-2 max-w-2xl text-[14px]" style={{ color: 'var(--text-secondary)' }}>
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
