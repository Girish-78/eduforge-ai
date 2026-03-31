import Link from "next/link";
import {
  primaryButtonClassName,
  secondaryButtonClassName,
} from "@/lib/button-styles";
import { roleLabels } from "@/lib/roles";
import { getServerSessionUser } from "@/lib/session";
import { getToolRoute, getToolsForRole } from "@/lib/tools";

export default async function DashboardPage() {
  const session = await getServerSessionUser();
  const userRole = session?.role ?? null;
  const userEmail = session?.email ?? "";
  const tools = userRole ? getToolsForRole(userRole) : [];

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
            key={tool.slug}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <h3 className="text-base font-semibold text-slate-900">{tool.navLabel}</h3>
            <p className="mt-2 text-sm text-slate-600">{tool.summary}</p>
            <Link
              href={getToolRoute(tool)}
              className={`${primaryButtonClassName} mt-4`}
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
          className={`${secondaryButtonClassName} mt-3`}
        >
          Open My Documents
        </Link>
      </article>
    </section>
  );
}
