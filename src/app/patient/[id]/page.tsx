"use client";

import { use } from "react";
import PatientDetailClient from "./PatientDetailClient";

export default function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <PatientDetailClient id={id} />;
}
