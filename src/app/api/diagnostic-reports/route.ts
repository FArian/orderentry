import { NextResponse } from "next/server";
import { resultsController } from "@/infrastructure/api/controllers/ResultsController";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const q           = searchParams.get("q")           || undefined;
  const status      = searchParams.get("status")      || undefined;
  const patientId   = searchParams.get("patientId")   || undefined;
  const patientName = searchParams.get("patientName") || undefined;
  const orderNumber = searchParams.get("orderNumber") || undefined;

  const result = await resultsController.list({
    ...(q           !== undefined && { q }),
    ...(status      !== undefined && { status }),
    ...(patientId   !== undefined && { patientId }),
    ...(patientName !== undefined && { patientName }),
    ...(orderNumber !== undefined && { orderNumber }),
    page:     parseInt(searchParams.get("page")     ?? "1",  10),
    pageSize: parseInt(searchParams.get("pageSize") ?? "20", 10),
  });

  const { httpStatus, ...body } = result;
  return NextResponse.json(body, { status: httpStatus ?? 200 });
}
