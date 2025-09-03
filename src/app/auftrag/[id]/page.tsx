import AllergyMenu from "@/components/AllergyMenu";
import PatientBreadcrumb from "../../patient/[id]/PatientBreadcrumb";
import AuftragClient from "./AuftragClient";

export default async function AuftragPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="min-h-screen flex flex-col">
      <div className="p-4">
        <PatientBreadcrumb id={id} />
        <h1 className="text-2xl font-bold">AUFTRAG</h1>
      </div>
      <AuftragClient id={id} />
    </div>
  );
}
