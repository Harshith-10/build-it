"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Save, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import {
  addGroupMember,
  removeGroupMember,
  upsertGroup,
} from "@/actions/admin/groups";
import { getUsers } from "@/actions/admin/users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

const groupSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
});

type GroupFormValues = z.infer<typeof groupSchema>;

type User = {
  id: string;
  name: string | null;
  email: string;
  role: string | null;
};

interface GroupFormProps {
  group?: {
    id: string;
    name: string;
    description: string | null;
    members: { user: User }[];
  } | null;
}

export function GroupForm({ group }: GroupFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Member management state
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<User[]>(
    group?.members.map((m) => m.user) || [],
  );
  // Keep track of initial members to calculate diffs
  const [initialMembers] = useState<User[]>(
    group?.members.map((m) => m.user) || [],
  );

  const [search, setSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      id: group?.id,
      name: group?.name || "",
      description: group?.description || "",
    },
  });

  // Initial load of users
  useEffect(() => {
    getUsers({ limit: 50 }).then((res) => {
      setAvailableUsers(res.users as User[]);
    });
  }, []);

  // Debounced search
  const handleSearch = useCallback((query: string) => {
    setSearch(query);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await getUsers({
          limit: 50,
          search: query,
        });
        setAvailableUsers(res.users as User[]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  const toggleUser = (user: User) => {
    const isSelected = selectedMembers.some((m) => m.id === user.id);
    if (isSelected) {
      setSelectedMembers((prev) => prev.filter((m) => m.id !== user.id));
    } else {
      setSelectedMembers((prev) => [...prev, user]);
    }
  };

  const removeMember = (userId: string) => {
    setSelectedMembers((prev) => prev.filter((m) => m.id !== userId));
  };

  const onSubmit = async (data: GroupFormValues) => {
    setIsSubmitting(true);
    try {
      // 1. Create or Update Group
      const result = await upsertGroup(data);
      if (!result.success || !result.id) {
        throw new Error(result.error || "Failed to save group");
      }

      const groupId = result.id;

      // 2. Calculate Diffs
      const initialIds = new Set(initialMembers.map((m) => m.id));
      const currentIds = new Set(selectedMembers.map((m) => m.id));

      const toAdd = selectedMembers.filter((m) => !initialIds.has(m.id));
      const toRemove = initialMembers.filter((m) => !currentIds.has(m.id));

      // 3. Apply Changes
      // Note: We're doing this sequentially for now, but could be parallelized
      // Ideally backend should support bulk update

      for (const user of toAdd) {
        await addGroupMember(groupId, user.email);
      }

      for (const user of toRemove) {
        await removeGroupMember(groupId, user.id);
      }

      toast.success(
        group ? "Group updated successfully" : "Group created successfully",
      );

      if (!group) {
        router.push("/admin/groups");
      } else {
        router.refresh();
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save group",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter available to exclude already-selected
  const filteredAvailable = availableUsers.filter(
    (u) => !selectedMembers.some((m) => m.id === u.id),
  );

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-1 flex-col min-h-0 gap-4"
      >
        <div className="grid gap-4 md:grid-cols-2 shrink-0">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Group Name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g. CSE Section A" />
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
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Brief description of this group"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Users Picker */}
        <div className="flex-1 min-h-0 border rounded-lg flex flex-col overflow-hidden">
          {/* Search bar */}
          <div className="px-4 py-3 border-b bg-muted/10 shrink-0">
            <div className="relative max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users by name or email..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-8"
              />
              {isSearching && (
                <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>

          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* Available Users */}
            <div className="flex-1 flex flex-col min-h-0 border-r">
              <div className="px-3 py-2 bg-muted/20 text-xs font-semibold uppercase tracking-wider shrink-0 border-b">
                Available Users
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="p-2 space-y-0.5">
                  {filteredAvailable.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 rounded-md cursor-pointer hover:bg-muted transition-colors group"
                      onClick={() => toggleUser(user)}
                    >
                      <Plus className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                      <div className="flex-1 text-left min-w-0">
                        <div className="text-sm font-medium truncate">
                          {user.name || "Unnamed User"}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {user.email}
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className="text-[10px] shrink-0"
                      >
                        {user.role}
                      </Badge>
                    </button>
                  ))}
                  {filteredAvailable.length === 0 && !isSearching && (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      {search
                        ? "No users match your search"
                        : "No users available"}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Selected Members */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-3 py-2 bg-muted/20 text-xs font-semibold uppercase tracking-wider shrink-0 border-b flex justify-between">
                <span>Group Members ({selectedMembers.length})</span>
                {selectedMembers.length > 0 && (
                  <button
                    type="button"
                    className="text-muted-foreground normal-case font-normal tracking-normal cursor-pointer hover:text-destructive transition-colors bg-transparent border-none p-0 text-xs"
                    onClick={() => setSelectedMembers([])}
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                {selectedMembers.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                    No members selected
                  </div>
                ) : (
                  <div className="p-2 space-y-0.5">
                    {selectedMembers
                      .filter(
                        (m) =>
                          !search ||
                          m.name
                            ?.toLowerCase()
                            .includes(search.toLowerCase()) ||
                          m.email.toLowerCase().includes(search.toLowerCase()),
                      )
                      .map((user) => {
                        const isNew = !initialMembers.some(
                          (m) => m.id === user.id,
                        );
                        return (
                          <button
                            key={user.id}
                            type="button"
                            className="flex w-full border my-2 items-center gap-2 px-3 py-2 rounded-md cursor-pointer hover:bg-destructive/10 hover:border-destructive/50 hover:text-destructive group transition-colors"
                            onClick={() => removeMember(user.id)}
                          >
                            <div className="flex-1 text-left min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate">
                                  {user.name || "Unnamed User"}
                                </span>
                                {isNew && group && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] text-green-600 border-green-200 bg-green-50"
                                  >
                                    New
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground truncate group-hover:text-destructive/70">
                                {user.email}
                              </div>
                            </div>
                            <X className="h-4 w-4 shrink-0 hidden group-hover:block" />
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/admin/groups")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="animate-spin mr-2" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {group ? "Save Changes" : "Create Group"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
