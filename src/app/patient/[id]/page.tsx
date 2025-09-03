import Link from "next/link";
import PatientDetailClient from "./PatientDetailClient";
import PatientBreadcrumb from "./PatientBreadcrumb";

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="p-4">
      <PatientBreadcrumb id={id} />

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Patientenakte</h1>
        <Link
          href={`/order/${id}`}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Neuer Auftrag
        </Link>
      </div>

      <PatientDetailClient id={id} />
    </div>
  );
}
