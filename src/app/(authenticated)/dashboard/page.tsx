"use client";

import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { LayoutDashboard } from "lucide-react";

export default function DashboardPage() {
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
