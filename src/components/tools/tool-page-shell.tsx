import { redirect } from "next/navigation";
import { ToolGenerator } from "@/components/tools/tool-generator";
import { getServerSessionUser } from "@/lib/session";
import { getToolBySlug, type ToolSlug } from "@/lib/tools";

export async function ToolPageShell({ slug }: { slug: ToolSlug }) {
  const session = await getServerSessionUser();
  const tool = getToolBySlug(slug);

  if (!session) {
    redirect("/login");
  }

  if (!tool || !tool.roles.includes(session.role)) {
    redirect("/dashboard/tools");
  }

  return <ToolGenerator tool={tool} sessionUser={session} />;
}

