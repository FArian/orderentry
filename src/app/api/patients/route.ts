import { NextResponse } from "next/server";
import { patientsController } from "@/infrastructure/api/controllers/PatientsController";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const result = await patientsController.list({
    q: searchParams.get("q") || undefined,
    page: parseInt(searchParams.get("page") ?? "1", 10),
    pageSize: parseInt(searchParams.get("pageSize") ?? "10", 10),
    showInactive: searchParams.get("showInactive") === "true",
  });

  const { httpStatus, ...body } = result;
  return NextResponse.json(body, { status: httpStatus ?? 200 });
}
