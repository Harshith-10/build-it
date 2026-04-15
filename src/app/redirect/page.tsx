import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function RedirectPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) redirect("/auth/sign-in");

  if (session.user.role === "admin") redirect("/admin");
  if (session.user.role === "faculty") redirect("/faculty");
  else redirect("/exams");
}
