"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { roleLabels, type UserRole } from "@/lib/roles";

type AuthMode = "login" | "signup";

interface AuthFormProps {
  mode: AuthMode;
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("student");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const isLogin = mode === "login";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          email,
          password,
          ...(isLogin ? {} : { role }),
        }),
      });

      const result = (await res.json()) as {
        message?: string;
        error?: string;
        user?: { email: string; role: UserRole; plan?: "free" | "pro" };
      };
      if (!res.ok) {
        setMessage(result.error ?? "Something went wrong");
        toast.error(result.error ?? "Something went wrong");
      } else {
        setMessage(result.message ?? "Success");
        toast.success(result.message ?? "Signed in successfully");
        if (result.user) {
          localStorage.setItem("saas-user", JSON.stringify(result.user));
          router.push("/dashboard");
        }
      }
    } catch {
      setMessage("Unable to reach server");
      toast.error("Unable to reach server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="mb-2 text-2xl font-bold text-slate-900">
        {isLogin ? "Welcome back" : "Create your account"}
      </h1>
      <p className="mb-6 text-sm text-slate-600">
        {isLogin
          ? "Log in to access your SaaS dashboard."
          : "Sign up to start your trial and manage your workspace."}
      </p>

      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
            placeholder="you@company.com"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
            placeholder="••••••••"
          />
        </div>
        {!isLogin ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
            >
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Please wait..." : isLogin ? "Log In" : "Create Account"}
        </button>
      </form>

      {message ? (
        <p className="mt-4 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
          {message}
        </p>
      ) : null}

      <p className="mt-4 text-sm text-slate-600">
        {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
        <Link
          href={isLogin ? "/signup" : "/login"}
          className="font-semibold text-slate-900 underline"
        >
          {isLogin ? "Sign up" : "Log in"}
        </Link>
      </p>
    </div>
  );
}
