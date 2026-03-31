import { redirect } from "next/navigation";

// /patient is now /patients — redirect for backwards compatibility
export default function PatientListRedirect() {
  redirect("/patients");
}
