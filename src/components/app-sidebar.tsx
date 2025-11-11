"use client";

import {
  User2,
  ChevronUp,
  LogOutIcon,
  LibraryIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  RssIcon,
} from "lucide-react";
import Link from "next/link";
import { useAuth0 } from "@auth0/auth0-react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const items = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboardIcon,
  },
  {
    title: "Articles",
    url: "/articles",
    icon: FileTextIcon,
  },
  {
    title: "Books",
    url: "/books",
    icon: LibraryIcon,
  },
  {
    title: "Feeds",
    url: "/feeds",
    icon: RssIcon,
  },
];

export function AppSidebar() {
  const { logout } = useAuth0();
  const viewer = useQuery(api.users.viewer);

  const handleSignOut = () => {
    logout({
      logoutParams: {
        returnTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
  };

  return (
    <Sidebar variant="inset" collapsible="offcanvas">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Sora</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton>
                  <User2 /> {viewer?.email || "Loading..."}
                  <ChevronUp className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                className="w-[--radix-popper-anchor-width]"
              >
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOutIcon />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
