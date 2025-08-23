"use client";

import { useEffect, useState } from "react";

type FhirResource = unknown;

export default function PatientDetailClient({ id }: { id: string }) {
  const [data, setData] = useState<FhirResource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetch(`/api/patients/${encodeURIComponent(id)}`)
      .then(async (res) => {
        if (!active) return;
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const json = (await res.json()) as FhirResource;
        setData(json);
      })
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
        setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) return <div className="text-gray-600">Laden…</div>;
  if (error)
    return <div className="text-red-600">Fehler beim Laden: {error}</div>;

  return (
    <pre className="whitespace-pre-wrap break-words rounded border border-gray-200 bg-gray-50 p-4 text-sm overflow-x-auto">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

