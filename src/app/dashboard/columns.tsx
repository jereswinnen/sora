"use client";

import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { Id } from "../../../convex/_generated/dataModel";

// Define the shape of an article as returned by the query
export type Article = {
  _id: Id<"articles">;
  title: string;
  url: string;
  excerpt?: string;
  author?: string;
  savedAt: number;
  readAt?: number;
  archived?: boolean;
  favorited?: boolean;
  tags: string[];
};

export const createColumns = (actions: {
  onRead: (id: Id<"articles">) => void;
  onToggleRead: (id: Id<"articles">, isRead: boolean) => void;
  onToggleArchive: (id: Id<"articles">, isArchived: boolean) => void;
  onToggleFavorite: (id: Id<"articles">, isFavorited: boolean) => void;
  onCopyLink: (url: string) => void;
  onViewInBrowser: (url: string) => void;
  onDelete: (id: Id<"articles">) => void;
  onAddTag: (id: Id<"articles">) => void;
}): ColumnDef<Article>[] => [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "title",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Title" />
    ),
    cell: ({ row }) => {
      const article = row.original;
      return (
        <div className="flex flex-col">
          <button
            onClick={() => actions.onRead(article._id)}
            className="max-w-[500px] truncate font-medium text-left hover:underline cursor-pointer"
          >
            {article.title}
          </button>
          {article.author && (
            <div className="text-xs text-muted-foreground">
              by {article.author}
            </div>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const article = row.original;

      if (article.archived) {
        return <Badge variant="secondary">Archived</Badge>;
      }

      if (article.readAt) {
        return <Badge variant="default">Read</Badge>;
      }

      return <Badge variant="outline">Unread</Badge>;
    },
    filterFn: (row, id, value) => {
      const article = row.original;
      if (value === "archived") return article.archived === true;
      if (value === "read")
        return article.readAt !== undefined && !article.archived;
      if (value === "unread")
        return article.readAt === undefined && !article.archived;
      return true;
    },
  },
  {
    accessorKey: "tags",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Tags" />
    ),
    cell: ({ row }) => {
      const tags = row.getValue("tags") as string[];

      if (!tags || tags.length === 0) {
        return <span className="text-xs text-muted-foreground">No tags</span>;
      }

      return (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
          {tags.length > 3 && (
            <Badge variant="outline">+{tags.length - 3}</Badge>
          )}
        </div>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: "savedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Saved" />
    ),
    cell: ({ row }) => {
      const savedAt = row.getValue("savedAt") as number;
      return (
        <div className="text-sm">{new Date(savedAt).toLocaleDateString()}</div>
      );
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const article = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex h-8 w-8 p-0 data-[state=open]:bg-muted"
            >
              <MoreHorizontal className="size-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => actions.onCopyLink(article.url)}>
              Copy link
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => actions.onViewInBrowser(article.url)}
            >
              View original
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => actions.onAddTag(article._id)}>
              Add tag
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                actions.onToggleFavorite(article._id, !!article.favorited)
              }
            >
              {article.favorited ? "Unfavorite" : "Favorite"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() =>
                actions.onToggleRead(article._id, !!article.readAt)
              }
            >
              {article.readAt ? "Mark as unread" : "Mark as read"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                actions.onToggleArchive(article._id, !!article.archived)
              }
            >
              {article.archived ? "Unarchive" : "Archive"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => actions.onDelete(article._id)}
              className="text-destructive"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
