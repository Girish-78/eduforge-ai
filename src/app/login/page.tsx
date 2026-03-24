import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-6 py-10">
      <div className="w-full max-w-md">
        <AuthForm mode="login" />
        <Link
          href="/"
          className="mt-4 inline-block text-sm font-medium text-slate-600 underline"
        >
          Back to landing page
        </Link>
      </div>
    </main>
  );
}
