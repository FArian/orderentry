import { redirect } from "next/navigation";

export default function AdminNumberPoolRoute() {
  redirect("/admin/order-numbers?tab=number-pool");
}
