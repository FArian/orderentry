"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";

type HumanName = { text?: string; given?: string[]; family?: string };
type Patient = { resourceType: "Patient"; id?: string; name?: HumanName[] };

function nameToString(names?: HumanName[]): string {
  if (!names || names.length === 0) return "Unbekannt";
  const n = names[0];
  if (n.text && n.text.trim()) return n.text.trim();
  const parts = [...(n.given || []), n.family || ""].filter(Boolean);
  return parts.join(" ") || "Unbekannt";
}

export default function PatientBreadcrumb({ id }: { id: string }) {
  const { t } = useTranslation();
  const [label, setLabel] = useState<string>("…");

  useEffect(() => {
    let active = true;
    setLabel("…");
    fetch(`/api/patients/${encodeURIComponent(id)}`)
      .then(async (res) => {
        if (!active) return;
        if (!res.ok) throw new Error("Fetch error");
        const json = (await res.json()) as Patient;
        const name = nameToString(json.name);
        setLabel(name || id);
      })
      .catch(() => {
        if (active) setLabel(id);
      });
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <div className="mb-2 flex items-center justify-between">
      <nav className="text-sm text-gray-600" aria-label="Brotkrumen">
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/" className="inline-flex items-center gap-1 text-blue-600 hover:underline" title={t("nav.home")}>
              🏠 {t("nav.home")}
            </Link>
          </li>
          <li className="text-gray-400">/</li>
          <li>
            <Link href="/patient" className="text-blue-600 hover:underline">
              {t("patient.title")}
            </Link>
          </li>
          <li className="text-gray-400">/</li>
          <li>
            <Link
              href={`/patient/${encodeURIComponent(id)}`}
              className="text-blue-600 hover:underline"
              aria-label={`Patientendetails öffnen: ${label}`}
            >
              {label}
            </Link>
          </li>
        </ol>
      </nav>
      <div className="flex items-center gap-2">
        <Link
          href={`/patient/${encodeURIComponent(id)}/befunde`}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
        >
          🔬 {t("befunde.title")}
        </Link>
        <Link
          href="/orders"
          className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          📋 {t("orders.title")}
        </Link>
      </div>
    </div>
  );
}
