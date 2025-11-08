"use client";

import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { HeaderProvider, useHeaderAction } from "@/components/layout-header-context";
import { ArrowLeftIcon } from "lucide-react";
import { CommandPalette } from "@/components/command-palette";
import { useKeyboardShortcut, singleKey } from "@/hooks/use-keyboard-shortcut";

function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { headerAction } = useHeaderAction();

  // Global navigation shortcuts
  useKeyboardShortcut(singleKey("1"), () => router.push("/dashboard"));
  useKeyboardShortcut(singleKey("2"), () => router.push("/articles"));
  useKeyboardShortcut(singleKey("3"), () => router.push("/books"));

  // Check if we're on an article detail page
  const isArticleDetailPage = pathname?.startsWith("/articles/") && pathname !== "/articles";

  // Get page title based on current path
  const pageTitle = pathname === "/dashboard"
    ? "Dashboard"
    : pathname === "/articles"
    ? "Articles"
    : pathname === "/books"
    ? "Books"
    : "Sora";

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4 w-full justify-between">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              {isArticleDetailPage && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.push("/articles")}
                  aria-label="Go Back"
                >
                  <ArrowLeftIcon />
                </Button>
              )}
              {!isArticleDetailPage && (
                <h1 className="text-xl font-bold">{pageTitle}</h1>
              )}
            </div>
            {headerAction && (
              <>
                {headerAction.component ? (
                  headerAction.component
                ) : (
                  <Button onClick={headerAction.onClick}>
                    {headerAction.label}
                  </Button>
                )}
              </>
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
      <CommandPalette />
      <LayoutContent>{children}</LayoutContent>
    </HeaderProvider>
  );
}
