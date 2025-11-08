import {
  LucideIcon,
  LayoutDashboardIcon,
  FileTextIcon,
  LibraryIcon,
  BookPlusIcon,
  FilePlusIcon,
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

export function createActionCommands(router: {
  push: (path: string) => void;
}): CommandGroup[] {
  return [
    {
      heading: "Add...",
      items: [
        {
          id: "add-article",
          label: "Add Article",
          description: "Save a new article",
          icon: FilePlusIcon,
          keywords: ["add", "new", "create", "save", "url"],
          onSelect: () => router.push("/articles?action=add"),
        },
        {
          id: "add-book",
          label: "Add Book",
          description: "Add a new book to your library",
          icon: BookPlusIcon,
          keywords: ["add", "new", "create", "library"],
          onSelect: () => router.push("/books?action=add"),
        },
      ],
    },
  ];
}
