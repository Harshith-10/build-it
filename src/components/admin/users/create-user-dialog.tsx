"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { createUser } from "@/actions/admin/users";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

const facultyPermissionSchema = z.object({
  problems: z.object({
    create: z.boolean(),
    read: z.boolean(),
    update: z.boolean(),
    delete: z.boolean(),
  }),
  collections: z.object({
    create: z.boolean(),
    read: z.boolean(),
    update: z.boolean(),
    delete: z.boolean(),
  }),
  exams: z.object({
    create: z.boolean(),
    read: z.boolean(),
    update: z.boolean(),
    delete: z.boolean(),
  }),
  labs: z.object({
    create: z.boolean(),
    read: z.boolean(),
    update: z.boolean(),
    delete: z.boolean(),
  }),
});

const defaultFacultyPermissions = {
  problems: { create: true, read: true, update: true, delete: false },
  collections: { create: true, read: true, update: true, delete: false },
  exams: { create: true, read: true, update: true, delete: false },
  labs: { create: true, read: true, update: true, delete: false },
};

const createUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.email("Invalid email address"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .optional()
    .or(z.literal("")),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["admin", "faculty", "student"]).default("student"),
  branch: z.string().optional().or(z.literal("")),
  gender: z.enum(["male", "female", "other"]).optional().or(z.literal("")),
  semester: z.string().optional().or(z.literal("")),
  section: z.string().optional().or(z.literal("")),
  dob: z.string().optional().or(z.literal("")),
  regulation: z.string().optional().or(z.literal("")),
  facultyPermissions: facultyPermissionSchema,
});

type CreateUserValues = z.infer<typeof createUserSchema>;
type CreateUserInputValues = z.input<typeof createUserSchema>;

type PermissionEntity = "problems" | "collections" | "exams" | "labs";
type PermissionAction = "create" | "read" | "update" | "delete";
type PermissionFieldPath =
  `facultyPermissions.${PermissionEntity}.${PermissionAction}`;

export function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<CreateUserInputValues, unknown, CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: "",
      email: "",
      username: "",
      password: "",
      role: "student",
      branch: "",
      gender: "male",
      semester: "",
      section: "",
      dob: "",
      regulation: "",
      facultyPermissions: defaultFacultyPermissions,
    },
  });

  const selectedRole = form.watch("role");

  const onSubmit = async (data: CreateUserValues) => {
    setIsSubmitting(true);
    try {
      const result = await createUser({
        email: data.email,
        password: data.password,
        name: data.name,
        role: data.role,
        username: data.username || undefined,
        branch: data.branch || undefined,
        gender: data.gender || undefined,
        semester: data.semester || undefined,
        section: data.section || undefined,
        dob: data.dob || undefined,
        regulation: data.regulation || undefined,
        facultyPermissions:
          data.role === "faculty" ? data.facultyPermissions : undefined,
      });

      if (result.success) {
        toast.success("User created successfully");
        setOpen(false);
        form.reset();
        router.refresh();
        window.dispatchEvent(
          new CustomEvent("entity-table-refresh", { detail: "User" }),
        );
      } else {
        toast.error(result.error || "Failed to create user");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" /> Create User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col max-h-[85vh]"
          >
            <DialogHeader className="p-6 pb-2">
              <DialogTitle className="text-2xl font-bold tracking-tight">
                Create New User
              </DialogTitle>
              <DialogDescription>
                Add a new user to the platform. All fields are customizable.
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="flex-1 min-h-0 px-6">
              <div className="space-y-6 py-4">
                {/* Account Information */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-1 bg-primary rounded-full" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Account Credentials
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
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="email@iare.ac.in"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="••••••••"
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

                {selectedRole === "faculty" && (
                  <>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-1 bg-primary rounded-full" />
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                          Faculty Permissions
                        </h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Default security policy is CRU for all entities with
                        delete disabled.
                      </p>
                      <div className="space-y-3 rounded-lg border p-4">
                        {[
                          ["problems", "Problems"],
                          ["collections", "Collections"],
                          ["exams", "Exams"],
                          ["labs", "Labs"],
                        ].map(([entityKey, entityLabel]) => (
                          <div
                            key={entityKey}
                            className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-center"
                          >
                            <p className="font-medium sm:col-span-1 col-span-2">
                              {entityLabel}
                            </p>
                            {[
                              ["create", "Create"],
                              ["read", "Read"],
                              ["update", "Update"],
                              ["delete", "Delete"],
                            ].map(([actionKey, actionLabel]) => (
                              <FormField
                                key={`${entityKey}.${actionKey}`}
                                control={form.control}
                                name={
                                  `facultyPermissions.${entityKey}.${actionKey}` as PermissionFieldPath
                                }
                                render={({ field }) => (
                                  <FormItem className="flex items-center gap-2 space-y-0">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value}
                                        onCheckedChange={(checked) =>
                                          field.onChange(Boolean(checked))
                                        }
                                      />
                                    </FormControl>
                                    <FormLabel className="text-sm font-normal">
                                      {actionLabel}
                                    </FormLabel>
                                  </FormItem>
                                )}
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                    <Separator />
                  </>
                )}

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
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select role" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent defaultValue={"student"}>
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
                            defaultValue={field.value}
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
              </div>
            </ScrollArea>

            <DialogFooter className="p-4 border-t mt-auto">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
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
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create User
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
