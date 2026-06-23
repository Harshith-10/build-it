import React from 'react';
import Link from 'next/link';
import { Calendar, Clock, Flame, Tag, CheckCircle2 } from 'lucide-react';
import { getDailyProblem, getUserCode365Stats } from '@/actions/student/exams/code365-actions';
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function Code365StudentDashboard() {
  // 1. Get the current logged-in user's ID
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const userId = session.user.id;

  // 2. Fetch data in parallel to make the page load faster
  const [todayProblem, userStats] = await Promise.all([
    getDailyProblem(),
    getUserCode365Stats(userId)
  ]);

    // 3. Redirect to the problem workspace immediately
    if (todayProblem) {
      redirect(`/code365/${todayProblem.id}`);
    }
  
    // 4. Fallback if no problem exists
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-12 text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Challenge Today</h3>
          <p className="text-gray-500">Take a break! The faculty hasn't assigned a problem for today yet. Your streak is safe.</p>
        </div>
      </div>
    );
  }