import { NextResponse } from "next/server";
import { ordersController } from "@/infrastructure/api/controllers/OrdersController";

export async function GET() {
  const result = await ordersController.list();
  const { httpStatus, ...body } = result;
  return NextResponse.json(body, { status: httpStatus ?? 200 });
}
