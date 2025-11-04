"use client";

import { ColumnDef } from "@tanstack/react-table";
import {
  ArchiveIcon,
  ArchiveXIcon,
  CheckIcon,
  CircleSlashIcon,
  ClipboardCopyIcon,
  CompassIcon,
  MoreHorizontal,
  StarIcon,
  StarOffIcon,
  TagIcon,
  Trash2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ARTICLE_STATUS_CONFIG, getArticleStatus } from "./types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import { Id } from "../../../../convex/_generated/dataModel";

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
  readingTimeMinutes?: number;
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
        aria-label="Select All"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select Row"
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
      const metadata = [];

      if (article.readingTimeMinutes) {
        metadata.push(`${article.readingTimeMinutes} min`);
      }

      if (article.author) {
        metadata.push(article.author);
      }

      return (
        <div className="flex flex-col">
          <button
            onClick={() => actions.onRead(article._id)}
            className="max-w-[500px] truncate font-medium text-left hover:underline cursor-pointer"
          >
            {article.title}
          </button>
          {metadata.length > 0 && (
            <div className="text-xs text-muted-foreground">
              {metadata.join(" · ")}
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
      const status = getArticleStatus(article);
      const config = ARTICLE_STATUS_CONFIG[status];

      return <Badge variant={config.variant}>{config.label}</Badge>;
    },
    filterFn: (row, id, value) => {
      const article = row.original;
      const status = getArticleStatus(article);
      return status === value;
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
              <span className="sr-only">Open Menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => actions.onCopyLink(article.url)}>
              <ClipboardCopyIcon />
              Copy Link
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => actions.onViewInBrowser(article.url)}
            >
              <CompassIcon />
              View Original
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => actions.onAddTag(article._id)}>
              <TagIcon />
              {article.tags.length > 0 ? "Edit Tags" : "Add Tags"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                actions.onToggleFavorite(article._id, !!article.favorited)
              }
            >
              {article.favorited ? <StarOffIcon /> : <StarIcon />}
              {article.favorited ? "Remove from Favorites" : "Add to Favorites"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() =>
                actions.onToggleRead(article._id, !!article.readAt)
              }
            >
              {article.readAt ? <CircleSlashIcon /> : <CheckIcon />}
              {article.readAt ? "Mark as Unread" : "Mark as Read"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                actions.onToggleArchive(article._id, !!article.archived)
              }
            >
              {article.archived ? <ArchiveXIcon /> : <ArchiveIcon />}
              {article.archived ? "Unarchive" : "Archive"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => actions.onDelete(article._id)}
              className="text-destructive"
            >
              <Trash2Icon className="text-current" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
