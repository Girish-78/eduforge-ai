import { LoadingDots } from "@/components/ui/loading-dots";

export default function DashboardLoading() {
  return (
    <div className="p-6">
      <LoadingDots label="Loading dashboard" />
    </div>
  );
}

