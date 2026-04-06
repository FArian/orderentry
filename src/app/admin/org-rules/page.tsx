import { redirect } from "next/navigation";

export default function AdminOrgRulesRoute() {
  redirect("/admin/order-numbers?tab=org-rules");
}
