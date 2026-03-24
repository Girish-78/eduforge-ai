import Link from "next/link";
import { BrandLogo } from "@/components/ui/brand-logo";

export default function Home() {
  return (
    <main className="min-h-screen">
      <section className="mx-auto max-w-6xl px-6 py-8 sm:px-8">
        <header className="mb-16 flex items-center justify-between">
          <BrandLogo />
          <nav className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-md px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Get Started
            </Link>
          </nav>
        </header>

        <div className="grid items-center gap-10 py-8 md:grid-cols-2">
          <div>
            <p className="mb-4 inline-block rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
              CBSE-first AI Workspace
            </p>
            <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl">
              Build better lessons faster with{" "}
              <span className="brand-text">AI for Indian schools</span>.
            </h1>
            <p className="mb-8 text-lg text-slate-600">
              Purpose-built for teachers and schools: CBSE-aligned content
              generation, role-based workflows, and export-ready outputs.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="rounded-md bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Start Free Trial
              </Link>
              <Link
                href="/dashboard"
                className="rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                View Dashboard
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold">Features Included</h2>
            <ul className="space-y-3 text-slate-600">
              <li>- Teacher, Student, and Admin role-based dashboards</li>
              <li>- CBSE-ready prompts with Bloom&apos;s taxonomy + HOTS</li>
              <li>- Rich text editing, PDF and DOCX export</li>
              <li>- Image generation + Firebase Storage save</li>
              <li>- Daily usage limits for free plan users</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
