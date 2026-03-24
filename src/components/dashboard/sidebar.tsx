import Link from "next/link";
import { BrandLogo } from "@/components/ui/brand-logo";

const items = [
  { href: "/dashboard", label: "Overview", icon: "grid" },
  { href: "/dashboard/tools/lesson-plan", label: "AI Tools", icon: "spark" },
  { href: "/dashboard/documents", label: "My Documents", icon: "chart" },
  { href: "#", label: "Settings", icon: "settings" },
];

function ItemIcon({ name }: { name: string }) {
  if (name === "grid") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor">
        <rect x="3" y="3" width="7" height="7" rx="1.5" strokeWidth="1.7" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" strokeWidth="1.7" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" strokeWidth="1.7" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" strokeWidth="1.7" />
      </svg>
    );
  }

  if (name === "spark") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor">
        <path d="M12 3l1.8 4.6L18 9.4l-4.2 1.8L12 16l-1.8-4.8L6 9.4l4.2-1.8L12 3z" strokeWidth="1.7" />
      </svg>
    );
  }

  if (name === "chart") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor">
        <path d="M4 19V5M10 19v-8M16 19V9M22 19V3" strokeWidth="1.7" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="3" strokeWidth="1.7" />
      <path
        d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.6 1.6 0 1 1-2.2 2.2l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V19a1.6 1.6 0 1 1-3.2 0v-.1a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1.6 1.6 0 1 1-2.2-2.2l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H5a1.6 1.6 0 1 1 0-3.2h.1a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1.6 1.6 0 1 1 2.2-2.2l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .6-.9V5a1.6 1.6 0 1 1 3.2 0v.1a1 1 0 0 0 .6.9h.1a1 1 0 0 0 1.1-.2l.1-.1a1.6 1.6 0 1 1 2.2 2.2l-.1.1a1 1 0 0 0-.2 1.1v.1a1 1 0 0 0 .9.6H19a1.6 1.6 0 1 1 0 3.2h-.1a1 1 0 0 0-.9.6z"
        strokeWidth="1.2"
      />
    </svg>
  );
}

export function DashboardSidebar() {
  return (
    <aside className="w-full border-b border-slate-200 bg-white/95 p-4 backdrop-blur md:h-screen md:w-72 md:border-b-0 md:border-r">
      <div className="mb-6 rounded-xl border border-indigo-100 bg-white p-4">
        <p className="text-xs uppercase tracking-wider text-slate-500">Workspace</p>
        <div className="mt-1">
          <BrandLogo compact />
        </div>
      </div>
      <nav className="flex flex-wrap gap-2 md:flex-col">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            <ItemIcon name={item.icon} />
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
