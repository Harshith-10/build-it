import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import OnboardingClient from "@/components/exam/onboarding-client";
import { db } from "@/db";
import { exams } from "@/db/schema";

interface PageProps {
  params: Promise<{
    examId: string;
  }>;
}

export default async function OnboardingPage({ params }: PageProps) {
  const { examId } = await params;

  const exam = await db.query.exams.findFirst({
    where: eq(exams.id, examId),
  });

  if (!exam) {
    notFound();
  }

  return <OnboardingClient exam={exam} />;
}
