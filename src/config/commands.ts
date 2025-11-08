import {
  LucideIcon,
  LayoutDashboardIcon,
  FileTextIcon,
  LibraryIcon,
} from "lucide-react";

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  keywords?: string[];
  onSelect: () => void;
}

export interface CommandGroup {
  heading: string;
  items: CommandItem[];
}

export function createNavigationCommands(router: {
  push: (path: string) => void;
}): CommandGroup[] {
  return [
    {
      heading: "Navigation",
      items: [
        {
          id: "nav-dashboard",
          label: "Dashboard",
          description: "Go to dashboard",
          icon: LayoutDashboardIcon,
          keywords: ["home", "main"],
          onSelect: () => router.push("/dashboard"),
        },
        {
          id: "nav-articles",
          label: "Articles",
          description: "View all articles",
          icon: FileTextIcon,
          keywords: ["read", "saved", "reading"],
          onSelect: () => router.push("/articles"),
        },
        {
          id: "nav-books",
          label: "Books",
          description: "View all books",
          icon: LibraryIcon,
          keywords: ["library", "reading"],
          onSelect: () => router.push("/books"),
        },
      ],
    },
  ];
}
