"use client";

import { Loader2, Mail, Sparkles, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { bulkCreateGroupWithMembers } from "@/actions/admin/groups";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

// Regex to extract email addresses from any text
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export function BulkGroupDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rawText, setRawText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const extractedEmails = useMemo(() => {
    const matches = rawText.match(EMAIL_REGEX) || [];
    // Deduplicate (case-insensitive) preserving first occurrence
    const seen = new Set<string>();
    return matches.filter((email) => {
      const lower = email.toLowerCase();
      if (seen.has(lower)) return false;
      seen.add(lower);
      return true;
    });
  }, [rawText]);

  const removeEmail = useCallback((emailToRemove: string) => {
    // Remove the email from rawText
    const regex = new RegExp(
      emailToRemove.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "gi",
    );
    setRawText((prev) => prev.replace(regex, "").trim());
  }, []);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Group name is required");
      return;
    }
    if (extractedEmails.length === 0) {
      toast.error("No email addresses found in the text");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await bulkCreateGroupWithMembers({
        name: name.trim(),
        description: description.trim() || undefined,
        emails: extractedEmails,
      });

      if (result.success) {
        const {
          added = 0,
          notFound = [],
          alreadyMember = [],
          id,
        } = result as {
          success: true;
          id: string;
          totalEmails: number;
          added: number;
          notFound: string[];
          alreadyMember: string[];
        };

        const messages: string[] = [];
        if (added > 0) {
          messages.push(`${added} member${added > 1 ? "s" : ""} added`);
        }
        if (notFound.length > 0) {
          messages.push(
            `${notFound.length} email${notFound.length > 1 ? "s" : ""} not found`,
          );
        }
        if (alreadyMember.length > 0) {
          messages.push(`${alreadyMember.length} already in group`);
        }

        toast.success(`Group "${name}" created`, {
          description: messages.join(" · "),
        });

        // Show not-found emails as a warning if any
        if (notFound.length > 0) {
          toast.warning("Some emails were not found in the system", {
            description: notFound.join(", "),
            duration: 8000,
          });
        }

        setOpen(false);
        resetForm();
        router.push(`/admin/groups/${id}`);
      } else {
        toast.error(result.error || "Failed to create group");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setRawText("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" id="bulk-create-group-btn">
          <Sparkles className="mr-2 h-4 w-4" /> Quick Import
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Quick Group Import
          </DialogTitle>
          <DialogDescription>
            Paste a list of email addresses to quickly create a group. Emails
            will be automatically extracted from the text.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Group Name */}
          <div className="grid gap-2">
            <Label htmlFor="bulk-group-name">Group Name *</Label>
            <Input
              id="bulk-group-name"
              placeholder="e.g. Section A — Batch 2025"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <Label htmlFor="bulk-group-desc">Description</Label>
            <Input
              id="bulk-group-desc"
              placeholder="Optional description for this group"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Email Textarea */}
          <div className="grid gap-2">
            <Label
              htmlFor="bulk-group-emails"
              className="flex items-center gap-2"
            >
              <Mail className="h-4 w-4" />
              Paste Emails
            </Label>
            <Textarea
              id="bulk-group-emails"
              placeholder={`Paste email addresses here — they'll be extracted automatically.\n\nExample:\n24955A0103@iare.ac.in\n24955A0104@iare.ac.in\n23951A04N3@iare.ac.in`}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              disabled={isSubmitting}
              className="min-h-[140px] font-mono text-sm"
            />
          </div>

          {/* Extracted Preview */}
          {extractedEmails.length > 0 && (
            <div className="grid gap-2">
              <Label className="text-muted-foreground">
                {extractedEmails.length} email
                {extractedEmails.length !== 1 ? "s" : ""} detected
              </Label>
              <ScrollArea className="max-h-[140px] rounded-md border p-3">
                <div className="flex flex-wrap gap-1.5">
                  {extractedEmails.map((email) => (
                    <Badge
                      key={email}
                      variant="secondary"
                      className="gap-1 pr-1 font-mono text-xs"
                    >
                      {email}
                      <button
                        type="button"
                        onClick={() => removeEmail(email)}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                        disabled={isSubmitting}
                      >
                        <X className="h-3 w-3" />
                        <span className="sr-only">Remove {email}</span>
                      </button>
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isSubmitting || !name.trim() || extractedEmails.length === 0
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <Users className="mr-2 h-4 w-4" />
                Create Group ({extractedEmails.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
