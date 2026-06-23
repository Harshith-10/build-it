// src/app/(student)/code365/[problemId]/page.tsx
import { notFound, redirect } from 'next/navigation';
import { getDailyProblemWithTestCases } from '@/actions/student/exams/code365-actions';
import WorkspaceClient from './workspace-client';
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

interface PageProps {
  params: Promise<{
    problemId: string;
  }>;
}

export default async function ProblemWorkspacePage({ params }: PageProps) {
  const { problemId } = await params;

  // 1. Fetch the user session
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const userId = session.user.id;

  // 2. Fetch the specific problem details with test cases
  const problem = await getDailyProblemWithTestCases(problemId);

  // 3. If the user typed an invalid URL ID, show a 404 page
  if (!problem) {
    notFound();
  }

  // 4. Render the interactive client component
  return (
    <WorkspaceClient 
      problem={problem} 
      userId={userId} 
    />
  );
}