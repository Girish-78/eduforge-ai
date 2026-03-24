"use client";

import Link from "next/link";
import { useMemo } from "react";
import { roleLabels, roleTools, type UserRole } from "@/lib/roles";

const toolDescriptions: Record<string, string> = {
  "Lesson Plan": "Build structured daily/weekly class plans in seconds.",
  Worksheet: "Create classroom worksheets with questions and activities.",
  Email: "Draft professional parent or student communication quickly.",
  Essay: "Generate essay drafts with clear structure and flow.",
  Notes: "Summarize concepts into clear revision notes.",
  Projects: "Create project outlines, milestones, and deliverables.",
  Reports: "Generate admin reports with concise highlights.",
  Circulars: "Draft official notices for students and staff.",
  "Image Generator": "Create educational visuals and save to cloud storage.",
};

const toolRouteByName: Record<string, string> = {
  "Lesson Plan": "/dashboard/tools/lesson-plan",
  Worksheet: "/dashboard/tools/worksheet",
  Email: "/dashboard/tools/email",
  Essay: "/dashboard/tools/essay",
  Notes: "/dashboard/tools/notes",
  Projects: "/dashboard/tools/projects",
  Reports: "/dashboard/tools/reports",
  Circulars: "/dashboard/tools/circulars",
  "Image Generator": "/dashboard/tools/image",
};

export default function DashboardPage() {
  const session = useMemo(() => {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem("saas-user");
    if (!raw) return null;

    try {
      return JSON.parse(raw) as { email?: string; role?: UserRole };
    } catch {
      localStorage.removeItem("saas-user");
      return null;
    }
  }, []);

  const userRole = session?.role ?? null;
  const userEmail = session?.email ?? "";

  const roleBasedTools = useMemo(() => {
    if (!userRole) return [];
    return roleTools[userRole];
  }, [userRole]);
  const tools = [...roleBasedTools, "Image Generator"];

  return (
    <section className="space-y-6">
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Role Workspace</h2>
        <p className="mt-1 text-sm text-slate-600">
          {userRole
            ? `${roleLabels[userRole]} access enabled${userEmail ? ` for ${userEmail}` : ""}.`
            : "Sign up or log in to view role-specific tools."}
        </p>
      </article>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tools.map((tool) => (
          <article
            key={tool}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <h3 className="text-base font-semibold text-slate-900">{tool}</h3>
            <p className="mt-2 text-sm text-slate-600">
              {toolDescriptions[tool] ?? "AI helper for this workflow."}
            </p>
            <Link
              href={toolRouteByName[tool] ?? "/dashboard"}
              className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Open Tool
            </Link>
          </article>
        ))}
      </div>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">My Documents</h2>
        <p className="text-sm text-slate-600">
          Generated outputs are saved automatically. Open your saved history here.
        </p>
        <Link
          href="/dashboard/documents"
          className="mt-3 inline-block rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          Open My Documents
        </Link>
      </article>
    </section>
  );
}
