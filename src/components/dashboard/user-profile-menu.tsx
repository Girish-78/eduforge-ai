"use client";

import { signOut } from "firebase/auth";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { roleLabels, type UserRole } from "@/lib/roles";
import { getFirebaseClientAuth } from "@/lib/firebase-client";

interface SessionUser {
  name?: string;
  email?: string;
  role?: UserRole;
}

export function UserProfileMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<SessionUser | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("saas-user");
    if (!raw) return;

    try {
      setSession(JSON.parse(raw) as SessionUser);
    } catch {
      localStorage.removeItem("saas-user");
    }
  }, []);

  const displayName = useMemo(() => {
    if (!session?.name?.trim()) return session?.email?.split("@")[0] ?? "User";
    return session.name.trim();
  }, [session]);

  async function onLogout() {
    try {
      const auth = getFirebaseClientAuth();
      await signOut(auth);
    } catch (error) {
      console.error("Client signOut fallback", error);
    } finally {
      localStorage.removeItem("saas-user");
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left shadow-sm hover:bg-slate-50"
      >
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
          {displayName.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden sm:block">
          <span className="block text-sm font-semibold text-slate-900">{displayName}</span>
          <span className="block text-xs text-slate-500">{session?.email ?? ""}</span>
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <p className="text-sm font-semibold text-slate-900">{displayName}</p>
          <p className="mt-0.5 text-xs text-slate-500">{session?.email ?? "No email"}</p>
          <p className="mt-2 inline-block rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
            {session?.role ? roleLabels[session.role] : "No role"}
          </p>
          <button
            type="button"
            onClick={onLogout}
            className="mt-3 w-full rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
          >
            Logout
          </button>
        </div>
      ) : null}
    </div>
  );
}
