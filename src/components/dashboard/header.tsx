import { UserProfileMenu } from "@/components/dashboard/user-profile-menu";

export function DashboardHeader() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur sm:px-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">EduAI Workspace</h1>
        <p className="text-xs text-slate-500">
          Production-ready CBSE teaching assistant platform.
        </p>
      </div>
      <div className="hidden rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 sm:block">
        Free Plan: 5 generations/day
      </div>
      <UserProfileMenu />
    </header>
  );
}
