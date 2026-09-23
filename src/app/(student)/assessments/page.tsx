import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getStudentAssessments } from "@/actions/student/assessments";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/admin/page-header";
import { StudentAssessmentsManager } from "@/components/student/assessments/student-assessments-manager";

export default async function StudentAssessmentsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const assessments = await getStudentAssessments();
  const serverNowMs = Date.now();

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 max-w-7xl mx-auto w-full">
      <PageHeader
        title="My Assessments"
        description="Take scheduled lab and coding assessments with proctored exam security."
      />
      <StudentAssessmentsManager
        assessments={assessments}
        serverNowMs={serverNowMs}
      />
    </div>
  );
}
