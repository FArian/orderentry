import AllergyMenu from "@/components/AllergyMenu";
import PatientBreadcrumb from "../../patient/[id]/PatientBreadcrumb";

export default async function AuftragPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="p-4 flex">
      <div className="w-64 mr-4">
        <AllergyMenu />
      </div>
      <div className="flex-1">
        <PatientBreadcrumb id={id} />

        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">AUFTRAG</h1>
        </div>

        <div className="rounded border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-600 mb-2">
            Auftrag für Patient-ID: <span className="text-gray-900">{id}</span>
          </p>
          <p className="text-sm text-gray-500">
            Formular folgt – hier können Sie die Details für den Auftrag erfassen.
          </p>
        </div>
      </div>
    </div>
  );
}

