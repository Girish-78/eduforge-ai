import Link from "next/link";
import { roleLabels } from "@/lib/roles";
import { getServerSessionUser } from "@/lib/session";
import { getToolRoute, getToolsForRole } from "@/lib/tools";

export default async function ToolsPage() {
  const session = await getServerSessionUser();
  const tools = session ? getToolsForRole(session.role) : [];

  return (
    <section className="space-y-6">
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">AI Tools</h1>
        <p className="mt-1 text-sm text-slate-600">
          {session
            ? `${roleLabels[session.role]} tools only. Direct links to other tools are blocked.`
            : "Login to see your AI tools."}
        </p>
      </article>

      {tools.length === 0 ? (
        <article className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600 shadow-sm">
          No AI tools are available for this account yet.
        </article>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {tools.map((tool) => (
            <article
              key={tool.slug}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h2 className="text-base font-semibold text-slate-900">{tool.navLabel}</h2>
              <p className="mt-2 text-sm text-slate-600">{tool.summary}</p>
              <Link
                href={getToolRoute(tool)}
                className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Open Tool
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
