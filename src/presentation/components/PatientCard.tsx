"use client";

import Link from "next/link";

interface PatientCardProps {
  id: string;
  display: string;
}

/**
 * Compact patient reference displayed inside table rows.
 * Links to the patient detail page.
 */
export function PatientCard({ id, display }: PatientCardProps) {
  if (!id && !display) return <span className="text-gray-400">—</span>;

  return (
    <Link
      href={`/patient/${encodeURIComponent(id)}`}
      className="inline-flex items-center gap-1 text-blue-600 hover:underline text-sm leading-tight"
      title={`Patient: ${display || id}`}
    >
      <span className="text-xs text-gray-400">👤</span>
      <span>{display || id}</span>
    </Link>
  );
}
