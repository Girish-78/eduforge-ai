import { LoadingDots } from "@/components/ui/loading-dots";

export default function AppLoading() {
  return (
    <main className="grid min-h-screen place-items-center">
      <LoadingDots label="Loading app" />
    </main>
  );
}

