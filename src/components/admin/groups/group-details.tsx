"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import {
  addGroupMember,
  removeGroupMember,
  upsertGroup,
} from "@/actions/admin/groups";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const groupSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2),
  description: z.string().optional(),
});

type GroupFormValues = z.infer<typeof groupSchema>;

export function GroupDetails({ group }: { group: any }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      id: group.id,
      name: group.name,
      description: group.description || "",
    },
  });

  const onSubmit = async (data: GroupFormValues) => {
    setIsSubmitting(true);
    try {
      const res = await upsertGroup(data);
      if (res.success) {
        toast.success("Group updated");
      } else {
        toast.error("Failed");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddMember = async () => {
    if (!newMemberEmail) return;
    setIsAdding(true);
    try {
      const res = await addGroupMember(group.id, newMemberEmail);
      if (res.success) {
        toast.success("Member added");
        setNewMemberEmail("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm("Remove this user?")) return;
    await removeGroupMember(group.id, userId);
    toast.success("Removed");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Group Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Group Name</Label>
                <Input {...form.register("name")} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input {...form.register("description")} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="animate-spin mr-2" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Update Details
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Members</CardTitle>
            <CardDescription>
              {group.members.length} users in this group
            </CardDescription>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <UserPlus className="mr-2 h-4 w-4" /> Add Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Member</DialogTitle>
                <DialogDescription>
                  Enter the email of the user to add to this group.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-4">
                <Label>User Email</Label>
                <Input
                  placeholder="student@example.com"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button onClick={handleAddMember} disabled={isAdding}>
                  {isAdding ? "Adding..." : "Add User"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.members.map((m: any) => (
                  <TableRow key={m.userId}>
                    <TableCell>{m.user.name}</TableCell>
                    <TableCell>{m.user.email}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveMember(m.userId)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {group.members.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground h-24"
                    >
                      No members yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
