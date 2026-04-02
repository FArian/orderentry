import { NextResponse } from "next/server";
import { resultsController } from "@/infrastructure/api/controllers/ResultsController";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const result = await resultsController.list({
    q: searchParams.get("q") || undefined,
    status: searchParams.get("status") || undefined,
    patientId: searchParams.get("patientId") || undefined,
    patientName: searchParams.get("patientName") || undefined,
    orderNumber: searchParams.get("orderNumber") || undefined,
    page: parseInt(searchParams.get("page") ?? "1", 10),
    pageSize: parseInt(searchParams.get("pageSize") ?? "20", 10),
  });

  const { httpStatus, ...body } = result;
  return NextResponse.json(body, { status: httpStatus ?? 200 });
}
