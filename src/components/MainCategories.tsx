'use client';

import { useEffect, useState } from 'react';
import { fhirGet, type ActivityDefinition, type ActivityDefinitionSearchBundle } from '@/lib/fhir';

function isActivityDefinition(x: unknown): x is ActivityDefinition {
  return (
    typeof x === 'object' &&
    x !== null &&
    'resourceType' in x &&
    (x as { resourceType?: unknown }).resourceType === 'ActivityDefinition'
  );
}

function extractTopicDisplay(ad: ActivityDefinition): string {
  const t = ad.topic;
  const cc = Array.isArray(t) ? t[0] : t;
  const disp = cc?.coding?.[0]?.display;
  return disp || 'Unknown';
}

export default function MainCategories() {
  const [items, setItems] = useState<Array<{ id: string; label: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const json = (await fhirGet('/ActivityDefinition?topic=MIBI')) as ActivityDefinitionSearchBundle;
        const entries = Array.isArray(json.entry) ? json.entry : [];
        const list: Array<{ id: string; label: string }> = [];
        for (const e of entries) {
          const r = e?.resource;
          if (!isActivityDefinition(r)) continue;
          const id = r.id || Math.random().toString(36).slice(2);
          const label = extractTopicDisplay(r);
          list.push({ id, label });
        }
        if (!cancelled) setItems(list);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="w-full">
      <h2 className="text-lg font-semibold mb-3">Main categories (topic=MIBI)</h2>
      {loading && <div className="text-sm text-gray-500">Loading…</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      {!loading && !error && (
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
          {items.map((it) => (
            <button
              key={it.id}
              className="rounded border px-3 py-2 text-left hover:bg-gray-50"
              title={it.label}
            >
              {it.label}
            </button>
          ))}
          {items.length === 0 && (
            <div className="text-sm text-gray-500">No items</div>
          )}
        </div>
      )}
    </div>
  );
}
