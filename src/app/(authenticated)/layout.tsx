"use client";

import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { HeaderProvider, useHeaderAction } from "@/components/layout-header-context";

function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { headerAction } = useHeaderAction();

  // Get page title based on current path
  const getPageTitle = () => {
    if (pathname === "/dashboard") return "Dashboard";
    if (pathname === "/articles") return "Articles";
    if (pathname?.startsWith("/articles/")) return "Article";
    return "Sora";
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4 w-full justify-between">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <h1 className="text-xl font-bold">{getPageTitle()}</h1>
            </div>
            {headerAction && (
              <Button onClick={headerAction.onClick}>
                {headerAction.label}
              </Button>
            )}
          </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HeaderProvider>
      <LayoutContent>{children}</LayoutContent>
    </HeaderProvider>
  );
}
