"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { tickets } from "@/db/schema/tickets";
import { requireAdmin, requireFacultyOrAdmin, requireUser } from "@/lib/auth-access";

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createTicket(data: {
  title: string;
  description: string;
}) {
  try {
    const session = await requireFacultyOrAdmin();

    const [ticket] = await db
      .insert(tickets)
      .values({
        title: data.title.trim(),
        description: data.description.trim(),
        createdBy: session.user.id,
        status: "open",
      })
      .returning();

    revalidatePath("/faculty/requests");
    revalidatePath("/admin/requests");
    return { success: true, ticket };
  } catch (error) {
    console.error("[createTicket]", error);
    return { success: false, error: "Failed to create request" };
  }
}

// ─── Read — Faculty (own tickets) ─────────────────────────────────────────────

export async function getMyTickets() {
  try {
    const session = await requireUser();

    return await db.query.tickets.findMany({
      where: eq(tickets.createdBy, session.user.id),
      orderBy: [desc(tickets.createdAt)],
      with: {
        resolver: {
          columns: { id: true, name: true, email: true },
        },
      },
    });
  } catch (error) {
    console.error("[getMyTickets]", error);
    return [];
  }
}

// ─── Read — Admin (all tickets) ───────────────────────────────────────────────

export async function getAllTickets() {
  try {
    await requireAdmin();

    return await db.query.tickets.findMany({
      orderBy: [desc(tickets.createdAt)],
      with: {
        creator: {
          columns: { id: true, name: true, email: true },
        },
        resolver: {
          columns: { id: true, name: true, email: true },
        },
      },
    });
  } catch (error) {
    console.error("[getAllTickets]", error);
    return [];
  }
}

// ─── Open ticket count ────────────────────────────────────────────────────────

export async function getOpenTicketCount() {
  try {
    const session = await requireUser();

    if (session.user.role === "admin") {
      const rows = await db.query.tickets.findMany({
        where: eq(tickets.status, "open"),
        columns: { id: true },
      });
      return rows.length;
    }

    const rows = await db.query.tickets.findMany({
      where: and(
        eq(tickets.createdBy, session.user.id),
        eq(tickets.status, "open")
      ),
      columns: { id: true },
    });
    return rows.length;
  } catch {
    return 0;
  }
}

// ─── Resolve / Reject — Admin ─────────────────────────────────────────────────

export async function resolveTicket(
  id: string,
  status: "resolved" | "rejected"
) {
  try {
    const session = await requireAdmin();

    const [updated] = await db
      .update(tickets)
      .set({ status, resolvedBy: session.user.id })
      .where(eq(tickets.id, id))
      .returning();

    if (!updated) return { success: false, error: "Ticket not found" };

    revalidatePath("/admin/requests");
    revalidatePath("/faculty/requests");
    return { success: true, ticket: updated };
  } catch (error) {
    console.error("[resolveTicket]", error);
    return { success: false, error: "Failed to update ticket" };
  }
}

// ─── Delete — Faculty (own open tickets only) ─────────────────────────────────

export async function deleteTicket(id: string) {
  try {
    const session = await requireUser();

    // Find ticket first to verify ownership and status
    const ticket = await db.query.tickets.findFirst({
      where: eq(tickets.id, id),
      columns: { id: true, createdBy: true, status: true },
    });

    if (!ticket) return { success: false, error: "Ticket not found" };

    if (ticket.createdBy !== session.user.id) {
      return { success: false, error: "You can only cancel your own requests" };
    }

    if (ticket.status !== "open") {
      return {
        success: false,
        error: "Only open requests can be cancelled",
      };
    }

    await db.delete(tickets).where(eq(tickets.id, id));

    revalidatePath("/faculty/requests");
    revalidatePath("/admin/requests");
    return { success: true };
  } catch (error) {
    console.error("[deleteTicket]", error);
    return { success: false, error: "Failed to cancel request" };
  }
}
