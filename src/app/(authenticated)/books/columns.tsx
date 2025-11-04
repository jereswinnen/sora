"use client";

import { ColumnDef } from "@tanstack/react-table";
import {
  BookCheckIcon,
  BookXIcon,
  CircleCheckIcon,
  CircleDotDashedIcon,
  CircleIcon,
  CircleSlashIcon,
  MoreHorizontal,
  PencilIcon,
  StarIcon,
  StarOffIcon,
  TagIcon,
  Trash2Icon,
} from "lucide-react";

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
import { Id } from "../../../../convex/_generated/dataModel";

// Define the shape of a book as returned by the query
export type Book = {
  _id: Id<"books">;
  title: string;
  author?: string;
  coverUrl?: string;
  publishedDate?: number;
  status: string;
  tags: string[];
  favorited?: boolean;
  dateStarted?: number;
  dateRead?: number;
  addedAt: number;
};

export const createColumns = (actions: {
  onEdit: (id: Id<"books">) => void;
  onToggleFavorite: (id: Id<"books">, isFavorited: boolean) => void;
  onUpdateStatus: (id: Id<"books">, status: string) => void;
  onDelete: (id: Id<"books">) => void;
  onAddTag: (id: Id<"books">) => void;
}): ColumnDef<Book>[] => [
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
      const book = row.original;
      const metadata = [];

      if (book.author) {
        metadata.push(book.author);
      }

      if (book.publishedDate) {
        metadata.push(new Date(book.publishedDate).toLocaleDateString());
      }

      return (
        <div className="flex flex-col">
          <button
            onClick={() => actions.onEdit(book._id)}
            className="max-w-[500px] truncate font-medium text-left hover:underline cursor-pointer"
          >
            {book.title}
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
      const book = row.original;

      const statusConfig: Record<
        string,
        {
          label: string;
          variant: "default" | "secondary" | "outline" | "destructive";
        }
      > = {
        not_started: { label: "Not Started", variant: "outline" },
        reading: { label: "Reading", variant: "default" },
        finished: { label: "Finished", variant: "secondary" },
        abandoned: { label: "Abandoned", variant: "destructive" },
      };

      const config = statusConfig[book.status] || {
        label: book.status,
        variant: "outline",
      };

      return <Badge variant={config.variant}>{config.label}</Badge>;
    },
    filterFn: (row, id, value) => {
      const book = row.original;
      return book.status === value;
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
    accessorKey: "addedAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Added" />
    ),
    cell: ({ row }) => {
      const addedAt = row.getValue("addedAt") as number;
      return (
        <div className="text-sm">{new Date(addedAt).toLocaleDateString()}</div>
      );
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const book = row.original;

      // Determine available status actions based on current status
      const statusActions = [];
      if (book.status !== "reading") {
        statusActions.push({
          label: "Mark as Reading",
          icon: CircleDotDashedIcon,
          status: "reading",
        });
      }
      if (book.status !== "finished") {
        statusActions.push({
          label: "Mark as Finished",
          icon: CircleCheckIcon,
          status: "finished",
        });
      }
      if (book.status !== "abandoned") {
        statusActions.push({
          label: "Mark as Abandoned",
          icon: CircleSlashIcon,
          status: "abandoned",
        });
      }
      if (book.status !== "not_started") {
        statusActions.push({
          label: "Mark as Not Started",
          icon: CircleIcon,
          status: "not_started",
        });
      }

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
            <DropdownMenuItem onClick={() => actions.onEdit(book._id)}>
              <PencilIcon />
              Edit Details
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => actions.onAddTag(book._id)}>
              <TagIcon />
              {book.tags.length > 0 ? "Edit Tags" : "Add Tags"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                actions.onToggleFavorite(book._id, !!book.favorited)
              }
            >
              {book.favorited ? <StarOffIcon /> : <StarIcon />}
              {book.favorited ? "Remove from Favorites" : "Add to Favorites"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {statusActions.map((action) => (
              <DropdownMenuItem
                key={action.status}
                onClick={() => actions.onUpdateStatus(book._id, action.status)}
              >
                <action.icon />
                {action.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => actions.onDelete(book._id)}
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
