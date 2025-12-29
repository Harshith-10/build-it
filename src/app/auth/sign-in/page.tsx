import SignIn from "@/components/sign-in";
import { ThemeToggle } from "@/components/theme-toggle";
import Image from "next/image";

export default function SignInPage() {
  return (
    <div className="flex flex-col min-h-screen w-full items-center justify-center p-4 bg-neutral-50 dark:bg-neutral-950">
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <Image
          src="/buildit-logo.png"
          alt="Logo"
          width={35}
          height={35}
        />
        <span className="text-2xl font-bold">BuildIT</span>
      </div>
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <SignIn />
    </div>
  );
}
