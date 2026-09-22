"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
  MessageSquare,
  Plus,
  Loader2,
  Trash2,
  ClockIcon,
  CheckCircle2,
  XCircle,
  SendHorizonal,
  Inbox,
} from "lucide-react";

import {
  createTicket,
  getMyTickets,
  deleteTicket,
} from "@/actions/tickets";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

// ─── Types ────────────────────────────────────────────────────────────────────

type Ticket = Awaited<ReturnType<typeof getMyTickets>>[number];

// ─── Schema ───────────────────────────────────────────────────────────────────

const ticketSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z
    .string()
    .min(10, "Please provide more detail (at least 10 characters)"),
});

// ─── Status helpers ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "open") {
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1 text-xs">
        <ClockIcon className="h-3 w-3" />
        Open
      </Badge>
    );
  }
  if (status === "resolved") {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1 text-xs">
        <CheckCircle2 className="h-3 w-3" />
        Resolved
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1 text-xs">
      <XCircle className="h-3 w-3" />
      Rejected
    </Badge>
  );
}

// ─── Ticket Card ──────────────────────────────────────────────────────────────

function TicketCard({
  ticket,
  onDeleted,
}: {
  ticket: Ticket;
  onDeleted: () => void;
}) {
  const handleDelete = async () => {
    const res = await deleteTicket(ticket.id);
    if (res.success) {
      toast.success("Request cancelled");
      onDeleted();
    } else {
      toast.error(res.error ?? "Failed to cancel");
    }
  };

  return (
    <div className="border rounded-lg p-4 flex flex-col gap-2 hover:border-border/80 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">{ticket.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap break-words">
              {ticket.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={ticket.status} />
          {ticket.status === "open" && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon-sm" title="Cancel request">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel this request?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete your request{" "}
                    <strong>&quot;{ticket.title}&quot;</strong>. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={handleDelete}
                  >
                    Cancel request
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
        <span>
          Submitted {new Date(ticket.createdAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
        {ticket.resolver && ticket.status !== "open" && (
          <span>
            {ticket.status === "resolved" ? "Resolved" : "Rejected"} by{" "}
            {ticket.resolver.name ?? ticket.resolver.email}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── New Ticket Form ──────────────────────────────────────────────────────────

function NewTicketForm({ onCreated }: { onCreated: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof ticketSchema>>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(ticketSchema) as any,
    defaultValues: { title: "", description: "" },
  });

  const onSubmit = async (data: z.infer<typeof ticketSchema>) => {
    setIsSubmitting(true);
    try {
      const res = await createTicket(data);
      if (res.success) {
        toast.success("Request submitted! The admin will review it shortly.");
        form.reset();
        onCreated();
      } else {
        toast.error(res.error ?? "Failed to submit request");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl">
      <p className="text-sm text-muted-foreground mb-4">
        Describe what you need — creating a lab, editing an exercise, deleting
        content, or anything else. The admin will review and action your request.
      </p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Request Title</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. Create OOPS Lab for Sem 3"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Details</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe exactly what you need — include lab name, semester, exercise numbers, or any other relevant details..."
                    rows={5}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <SendHorizonal className="mr-2 h-4 w-4" />
            )}
            Submit Request
          </Button>
        </form>
      </Form>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FacultyRequestsManager() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("my-requests");

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const data = await getMyTickets();
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

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col gap-4">
      <TabsList className="w-fit">
        <TabsTrigger value="my-requests" id="tab-my-requests">
          My Requests
          {openTickets.length > 0 && (
            <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
              {openTickets.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="new-request" id="tab-new-request">
          <Plus className="mr-1 h-3.5 w-3.5" />
          New Request
        </TabsTrigger>
      </TabsList>

      {/* ── My Requests ── */}
      <TabsContent value="my-requests" className="mt-0">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 border rounded-lg text-center">
            <Inbox className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No requests yet</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setActiveTab("new-request")}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Raise your first request
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {openTickets.length > 0 && (
              <>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Open ({openTickets.length})
                </p>
                {openTickets.map((t) => (
                  <TicketCard key={t.id} ticket={t} onDeleted={fetchTickets} />
                ))}
              </>
            )}
            {closedTickets.length > 0 && (
              <>
                {openTickets.length > 0 && <Separator />}
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  History ({closedTickets.length})
                </p>
                {closedTickets.map((t) => (
                  <TicketCard key={t.id} ticket={t} onDeleted={fetchTickets} />
                ))}
              </>
            )}
          </div>
        )}
      </TabsContent>

      {/* ── New Request ── */}
      <TabsContent value="new-request" className="mt-0">
        <NewTicketForm
          onCreated={() => {
            fetchTickets();
            setActiveTab("my-requests");
          }}
        />
      </TabsContent>
    </Tabs>
  );
}
