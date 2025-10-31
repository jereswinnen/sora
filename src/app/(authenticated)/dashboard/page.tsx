"use client";

import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@/components/ui/spinner";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { LayoutDashboard } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useConvexAuth();

  // Redirect to auth if not authenticated (after render)
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/auth");
    }
  }, [isLoading, isAuthenticated, router]);

  // Show loading state while auth is being determined
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Spinner className="size-8" />
          <p className="text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  // Show redirecting message if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Spinner className="size-8" />
          <p className="text-lg">Redirecting to sign in...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <LayoutDashboard />
          </EmptyMedia>
          <EmptyTitle>Dashboard</EmptyTitle>
          <EmptyDescription>
            Your dashboard is ready to be customized. This space is reserved for
            future features and insights.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );
}
