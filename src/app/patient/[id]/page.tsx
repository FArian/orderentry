import Link from "next/link";
import PatientDetailClient from "./PatientDetailClient";

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="p-4">
      <nav className="mb-2 text-sm text-gray-600" aria-label="Brotkrumen">
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/" className="text-blue-600 hover:underline">
              Startseite
            </Link>
          </li>
          <li className="text-gray-400">/</li>
          <li>
            <Link href="/patient" className="text-blue-600 hover:underline">
              Patienten
            </Link>
          </li>
          <li className="text-gray-400">/</li>
          <li className="text-gray-700">{id}</li>
        </ol>
      </nav>

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Patientenakte</h1>
        <Link
          href="/patient"
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          neue Anfrage
        </Link>
      </div>

      <PatientDetailClient id={id} />
    </div>
  );
}
