"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  MessageSquare,
  Loader2,
  CheckCircle2,
  XCircle,
  ClockIcon,
  Inbox,
  User,
} from "lucide-react";

import { getAllTickets, resolveTicket } from "@/actions/tickets";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

type Ticket = Awaited<ReturnType<typeof getAllTickets>>[number];

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "open") {
    return (
      <Badge
        variant="outline"
        className="bg-amber-50 text-amber-700 border-amber-200 gap-1 text-xs"
      >
        <ClockIcon className="h-3 w-3" />
        Open
      </Badge>
    );
  }
  if (status === "resolved") {
    return (
      <Badge
        variant="outline"
        className="bg-green-50 text-green-700 border-green-200 gap-1 text-xs"
      >
        <CheckCircle2 className="h-3 w-3" />
        Resolved
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="bg-red-50 text-red-700 border-red-200 gap-1 text-xs"
    >
      <XCircle className="h-3 w-3" />
      Rejected
    </Badge>
  );
}

// ─── Ticket Card ──────────────────────────────────────────────────────────────

function AdminTicketCard({
  ticket,
  onUpdated,
}: {
  ticket: Ticket;
  onUpdated: () => void;
}) {
  const handleResolve = async (status: "resolved" | "rejected") => {
    const res = await resolveTicket(ticket.id, status);
    if (res.success) {
      toast.success(
        status === "resolved" ? "Ticket marked as resolved" : "Ticket rejected"
      );
      onUpdated();
    } else {
      toast.error(res.error ?? "Failed to update ticket");
    }
  };

  const isOpen = ticket.status === "open";

  return (
    <div
      className={`border rounded-lg p-4 flex flex-col gap-3 transition-colors ${
        isOpen ? "hover:border-primary/40" : "opacity-70"
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm">{ticket.title}</p>
            <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-words">
              {ticket.description}
            </p>
          </div>
        </div>
        <StatusBadge status={ticket.status} />
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between pt-2 border-t gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
          <User className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {ticket.creator?.name ?? ticket.creator?.email ?? "Unknown faculty"}
          </span>
          <span className="mx-1 text-muted-foreground/40">·</span>
          <span>
            {new Date(ticket.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>

        {isOpen && (
          <div className="flex gap-2 shrink-0">
            {/* Reject */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                  <XCircle className="mr-1.5 h-3.5 w-3.5" />
                  Reject
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reject this request?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The faculty will see this request as{" "}
                    <strong>Rejected</strong>. No further action will be taken.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => handleResolve("rejected")}
                  >
                    Reject
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Resolve */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  Mark Resolved
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Mark as Resolved?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Confirm you have already made the required change in the
                    system. The faculty will see this as{" "}
                    <strong>Resolved</strong>.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleResolve("resolved")}
                  >
                    Yes, mark resolved
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {!isOpen && ticket.resolver && (
          <span className="text-xs text-muted-foreground shrink-0">
            {ticket.status === "resolved" ? "Resolved" : "Rejected"} by{" "}
            {ticket.resolver.name ?? ticket.resolver.email}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminRequestsManager() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const data = await getAllTickets();
      setTickets(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const openTickets = tickets.filter((t) => t.status === "open");
  const closedTickets = tickets.filter((t) => t.status !== "open");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="open" className="flex flex-col gap-4">
      <TabsList className="w-fit">
        <TabsTrigger value="open" id="tab-open-requests">
          Open
          {openTickets.length > 0 && (
            <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
              {openTickets.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="history" id="tab-closed-requests">
          History
          {closedTickets.length > 0 && (
            <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-muted text-muted-foreground px-1 text-[10px] font-semibold">
              {closedTickets.length}
            </span>
          )}
        </TabsTrigger>
      </TabsList>

      {/* ── Open tickets ── */}
      <TabsContent value="open" className="mt-0">
        {openTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 border rounded-lg text-center">
            <Inbox className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No open requests — you&apos;re all caught up!
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              {openTickets.length} pending request{openTickets.length !== 1 ? "s" : ""}
            </p>
            {openTickets.map((t) => (
              <AdminTicketCard key={t.id} ticket={t} onUpdated={fetchTickets} />
            ))}
          </div>
        )}
      </TabsContent>

      {/* ── History ── */}
      <TabsContent value="history" className="mt-0">
        {closedTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 border rounded-lg text-center">
            <Inbox className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No closed requests yet</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {closedTickets.map((t) => (
              <AdminTicketCard key={t.id} ticket={t} onUpdated={fetchTickets} />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
