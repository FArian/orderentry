"use client";

import PatientDetailClient from "./PatientDetailClient";

export default function PatientDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return <PatientDetailClient id={params.id} />;
}
