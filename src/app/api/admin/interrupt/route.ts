import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildJetAuthHeadersV2 } from "@/lib/jet-headers";

const JET_BASE_URL = (process.env.JET_SERVER_URL || "http://localhost:4000").replace(
  /\/+$/,
  "",
);

const JET_HMAC_SECRET = process.env.JET_HMAC_SECRET;
const JET_HMAC_KEY_ID = process.env.JET_HMAC_KEY_ID;

function verifyAdminAuth(session: unknown): boolean {
  if (!session || typeof session !== "object") {
    return false;
  }
  const s = session as Record<string, unknown>;
  if (!s.user || typeof s.user !== "object") {
    return false;
  }
  const user = s.user as Record<string, unknown>;
  return user.role === "admin";
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!verifyAdminAuth(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!JET_HMAC_SECRET || !JET_HMAC_KEY_ID) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  try {
    const body = await request.text();
    const sessionData = session as Record<string, unknown>;
    const user = sessionData.user as Record<string, unknown>;
    const userId = user.id as string;

    const jetHeaders = buildJetAuthHeadersV2({
      userId,
      keyId: JET_HMAC_KEY_ID,
      secret: JET_HMAC_SECRET,
      method: "POST",
      path: "/admin/interrupt",
      body,
      contentType: "application/json",
    });

    const response = await fetch(`${JET_BASE_URL}/admin/interrupt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...jetHeaders,
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.json(
        {
          error: `Failed to interrupt jobs (${response.status})`,
          details: errorText || null,
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Jet service is unavailable";

    return NextResponse.json(
      {
        error: "Failed to interrupt jobs",
        details: message,
      },
      { status: 503 },
    );
  }
}
