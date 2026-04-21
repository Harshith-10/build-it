import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const JET_BASE_URL = (
  process.env.JET_SERVER_URL || "http://localhost:4000"
).replace(/\/+$/, "");

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = await fetch(`${JET_BASE_URL}/stats`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        {
          error: `Failed to fetch stats (${response.status})`,
          details: errorText || null,
        },
        { status: response.status },
      );
    }

    const stats = await response.json();
    return NextResponse.json(stats, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Jet stats service is unavailable";

    return NextResponse.json(
      {
        error: "Failed to fetch Jet stats",
        details: message,
      },
      { status: 503 },
    );
  }
}
