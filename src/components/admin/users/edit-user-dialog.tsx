"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, KeyRound, Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { setUserPassword, updateUser } from "@/actions/admin/users";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

const editUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  username: z.string().optional().or(z.literal("")),
  role: z.enum(["admin", "faculty", "student"]).default("student"),
  branch: z.string().optional().or(z.literal("")),
  gender: z.enum(["male", "female", "other", ""]).optional(),
  semester: z.string().optional().or(z.literal("")),
  section: z.string().optional().or(z.literal("")),
  dob: z.string().optional().or(z.literal("")),
  regulation: z.string().optional().or(z.literal("")),
});

type EditUserValues = z.infer<typeof editUserSchema>;

export interface EditableUser {
  id: string;
  name: string;
  email: string;
  username?: string | null;
  displayUsername?: string | null;
  role: string | null;
  branch: string | null;
  gender: string | null;
  semester: string | null;
  section: string | null;
  dob: Date | string | null;
  regulation: string | null;
}

interface EditUserDialogProps {
  user: EditableUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDateForInput(dob: Date | string | null | undefined): string {
  if (!dob) return "";
  const d = typeof dob === "string" ? new Date(dob) : dob;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function EditUserDialog({
  user: editUser,
  open,
  onOpenChange,
}: EditUserDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const router = useRouter();

  const form = useForm<EditUserValues>({
    resolver: zodResolver(editUserSchema) as any,
    defaultValues: {
      name: "",
      username: "",
      role: "student",
      branch: "",
      gender: "",
      semester: "",
      section: "",
      dob: "",
      regulation: "",
    },
  });

  // Reset form when user changes
  useEffect(() => {
    if (editUser && open) {
      form.reset({
        name: editUser.name || "",
        username: editUser.username || editUser.displayUsername || "",
        role: (editUser.role as "admin" | "faculty" | "student") || "student",
        branch: editUser.branch || "",
        gender: (editUser.gender as "male" | "female" | "other" | "") || "",
        semester: editUser.semester || "",
        section: editUser.section || "",
        dob: formatDateForInput(editUser.dob),
        regulation: editUser.regulation || "",
      });
      // Reset password fields
      setNewPassword("");
      setConfirmPassword("");
      setPasswordError("");
      setShowPassword(false);
    }
  }, [editUser, open, form]);

  const onSubmit = async (data: EditUserValues) => {
    if (!editUser) return;
    setIsSubmitting(true);
    try {
      const result = await updateUser(editUser.id, {
        name: data.name,
        role: data.role,
        username: data.username || undefined,
        gender: data.gender || undefined,
        branch: data.branch || undefined,
        semester: data.semester || undefined,
        section: data.section || undefined,
        dob: data.dob || undefined,
        regulation: data.regulation || undefined,
      });

      if (result.success) {
        toast.success("User updated successfully");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to update user");
      }
    } catch {
      toast.error("An error occurred while updating");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async () => {
    if (!editUser) return;

    // Validation
    if (!newPassword) {
      setPasswordError("Password is required");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setPasswordError("");
    setIsChangingPassword(true);
    try {
      const result = await setUserPassword(editUser.id, newPassword);
      if (result.success) {
        toast.success("Password updated successfully");
        setNewPassword("");
        setConfirmPassword("");
        setShowPassword(false);
      } else {
        toast.error(result.error || "Failed to update password");
      }
    } catch {
      toast.error("An error occurred while changing the password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col max-h-[85vh]"
          >
            <DialogHeader className="p-6 pb-2">
              <DialogTitle className="text-2xl font-bold tracking-tight">
                Edit User
              </DialogTitle>
              <DialogDescription>
                Editing{" "}
                <span className="font-semibold text-foreground">
                  {editUser?.email}
                </span>
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="flex-1 min-h-0 px-6">
              <div className="space-y-6 py-4">
                {/* Account Information */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-1 bg-primary rounded-full" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Account Details
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Devaratha Raisaar" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="space-y-2">
                      <label
                        htmlFor="edit-user-email"
                        className="text-sm font-medium text-muted-foreground"
                      >
                        Email Address
                      </label>
                      <Input
                        id="edit-user-email"
                        value={editUser?.email || ""}
                        disabled
                        className="bg-muted/50"
                      />
                      <p className="text-xs text-muted-foreground">
                        Email cannot be changed
                      </p>
                    </div>
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Roll Number / Faculty ID</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="23951A052X / IARE11088"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Separator />

                {/* Personal & Professional Details */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-1 bg-primary rounded-full" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Personal & Professional
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>App Role</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select role" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="student">Student</SelectItem>
                              <SelectItem value="faculty">Faculty</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gender</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select gender" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="male">Male</SelectItem>
                              <SelectItem value="female">Female</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="dob"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date of Birth</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="branch"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Branch / Department</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. CSE, ECE" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="semester"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Semester</FormLabel>
                          <FormControl>
                            <Input placeholder="1-8" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="section"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Section</FormLabel>
                          <FormControl>
                            <Input placeholder="A, B, C" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="regulation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Regulation</FormLabel>
                          <FormControl>
                            <Input placeholder="R20" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Separator />

                {/* Security / Password */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-1 bg-destructive rounded-full" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Security
                    </h3>
                  </div>
                  <div className="rounded-lg border border-dashed border-muted-foreground/30 p-4 space-y-4">
                    <p className="text-xs text-muted-foreground">
                      Set a new password for this user. This will immediately
                      replace their current password.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label
                          htmlFor="new-password"
                          className="text-sm font-medium"
                        >
                          New Password
                        </label>
                        <div className="relative">
                          <Input
                            id="new-password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Min. 8 characters"
                            value={newPassword}
                            onChange={(e) => {
                              setNewPassword(e.target.value);
                              setPasswordError("");
                            }}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="confirm-password"
                          className="text-sm font-medium"
                        >
                          Confirm Password
                        </label>
                        <Input
                          id="confirm-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Re-enter password"
                          value={confirmPassword}
                          onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            setPasswordError("");
                          }}
                        />
                      </div>
                    </div>
                    {passwordError && (
                      <p className="text-sm text-destructive">
                        {passwordError}
                      </p>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={
                        isChangingPassword || (!newPassword && !confirmPassword)
                      }
                      onClick={handleChangePassword}
                      className="w-full sm:w-auto"
                    >
                      {isChangingPassword ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <KeyRound className="mr-2 h-4 w-4" />
                          Set Password
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="p-4 border-t mt-auto">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="min-w-[120px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
