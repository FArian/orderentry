import PatientBreadcrumb from "../../patient/[id]/PatientBreadcrumb";
import OrderClient from "./OrderClient";

export default async function OrderPage({
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
      <OrderClient id={id} />
    </div>
  );
}
