import { redirect } from "next/navigation";
import { requireFacultyOrAdmin } from "@/lib/auth-access";

export default async function FacultyProblemsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireFacultyOrAdmin();

  if (session.user.role === "faculty") {
    redirect("/faculty");
  }

  return <>{children}</>;
}
