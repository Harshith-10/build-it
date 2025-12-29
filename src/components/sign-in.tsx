"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/lib/auth-client";

const signInSchema = z.object({
  identifier: z.string().min(1, "Email or Username is required"),
  password: z.string().min(1, "Password is required"),
});

type SignInValues = z.infer<typeof signInSchema>;

export default function SignIn() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  const onSubmit = async (data: SignInValues) => {
    const isEmail = z.string().email().safeParse(data.identifier).success;

    const callbacks = {
      onRequest: () => {
        setLoading(true);
        setError(null);
      },
      onSuccess: () => {
        toast.success("Login successful");
        router.push("/exams");
      },
      onError: (ctx: { error: { message: string } }) => {
        setLoading(false);
        setError(ctx.error.message);
        toast.error(ctx.error.message);
      },
    };

    if (isEmail) {
      await signIn.email(
        {
          email: data.identifier,
          password: data.password,
        },
        callbacks,
      );
    } else {
      await signIn.username(
        {
          username: data.identifier,
          password: data.password,
        },
        callbacks,
      );
    }
  };

  return (
    <Card className="w-full max-w-md mx-4 sm:mx-0">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold tracking-tight">
          Sign In
        </CardTitle>
        <CardDescription>
          Enter your email or username below to login to your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 rounded-md bg-red-500/15 p-3 text-sm text-red-500 font-medium">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="identifier">Email or Username</Label>
            <Input
              id="identifier"
              type="text"
              placeholder="23951a052x@iare.ac.in"
              {...register("identifier")}
            />
            {errors.identifier && (
              <p className="text-sm text-red-500">
                {errors.identifier.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                {...register("password")}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword((prev) => !prev)}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="sr-only">
                  {showPassword ? "Hide password" : "Show password"}
                </span>
              </Button>
            </div>
            {errors.password && (
              <p className="text-sm text-red-500">{errors.password.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing In...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter>
        <div className="flex justify-center w-full border-t pt-4">
          <p className="text-center text-xs text-neutral-500">
            Powered by{" "}
            <Link
              href="https://github.com/Harshith-10/turbo"
              className="underline hover:text-neutral-800 dark:hover:text-neutral-300 transition-colors"
              target="_blank"
            >
              Turbo RCE
            </Link>
          </p>
        </div>
      </CardFooter>
    </Card>
  );
}
