"use client";

import { useState } from "react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Bookmark, Globe, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AddBookmarkDialog } from "./AddBookmarkDialog";
import { Bookmark as BookmarkType } from "./types";
import { Id } from "../../../../../convex/_generated/dataModel";

export function BookmarksWidget() {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bookmarkToDelete, setBookmarkToDelete] = useState<Id<"bookmarks"> | null>(null);

  const bookmarks = useQuery(api.bookmarks.listBookmarks, {});
  const deleteBookmark = useMutation(api.bookmarks.deleteBookmark);

  const handleDeleteClick = (bookmarkId: Id<"bookmarks">) => {
    setBookmarkToDelete(bookmarkId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!bookmarkToDelete) return;

    try {
      await deleteBookmark({ bookmarkId: bookmarkToDelete });
      toast.success("Bookmark deleted");
      setDeleteDialogOpen(false);
      setBookmarkToDelete(null);
    } catch (err) {
      console.error("Failed to delete bookmark:", err);
      toast.error(err instanceof Error ? err.message : "Failed to delete bookmark");
    }
  };

  const handleBookmarkClick = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Bookmarks</CardTitle>
          <CardDescription>Quick access to your favorite sites</CardDescription>
          <CardAction>
            <Button
              size="sm"
              onClick={() => setAddDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Add Bookmark
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent>
          {!bookmarks || bookmarks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="rounded-full bg-muted p-3 mb-3">
                <Bookmark className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                No bookmarks yet. Add your first bookmark to get started.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAddDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Add Bookmark
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {bookmarks.map((bookmark) => (
                <BookmarkCard
                  key={bookmark._id}
                  bookmark={bookmark}
                  onDelete={() => handleDeleteClick(bookmark._id)}
                  onClick={() => handleBookmarkClick(bookmark.url)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Bookmark Dialog */}
      <AddBookmarkDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={() => {
          // Bookmarks will auto-update via Convex reactivity
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bookmark</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this bookmark? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface BookmarkCardProps {
  bookmark: BookmarkType;
  onDelete: () => void;
  onClick: () => void;
}

function BookmarkCard({ bookmark, onDelete, onClick }: BookmarkCardProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="group relative flex flex-col items-center gap-2 p-3 rounded-lg border bg-card hover:bg-accent transition-colors">
      {/* Delete button (shows on hover) */}
      <Button
        size="icon"
        variant="ghost"
        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 className="h-3 w-3" />
      </Button>

      {/* Clickable bookmark area */}
      <button
        onClick={onClick}
        className="flex flex-col items-center gap-2 w-full"
      >
        {/* Favicon */}
        <div className="w-12 h-12 rounded-lg border bg-background flex items-center justify-center overflow-hidden">
          {bookmark.faviconUrl && !imageError ? (
            <img
              src={bookmark.faviconUrl}
              alt={bookmark.title}
              className="w-8 h-8 object-contain"
              onError={() => setImageError(true)}
            />
          ) : (
            <Globe className="w-6 h-6 text-muted-foreground" />
          )}
        </div>

        {/* Title */}
        <p className="text-xs text-center line-clamp-2 w-full break-words">
          {bookmark.title}
        </p>
      </button>
    </div>
  );
}
