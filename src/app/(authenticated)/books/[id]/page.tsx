"use client";

import { useQuery } from "convex-helpers/react/cache/hooks";
import { useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { useState, use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useHeaderAction } from "@/components/layout-header-context";
import { useKeyboardShortcut, singleKey } from "@/hooks/use-keyboard-shortcut";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Label } from "@/components/ui/label";
import { Kbd } from "@/components/ui/kbd";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit2,
  X,
  Check,
  BookmarkPlusIcon,
  Trash2Icon,
  BookmarkIcon,
} from "lucide-react";
import { toast } from "sonner";
import { BOOK_STATUS_CONFIG, BOOK_STATUSES } from "../types";
import { ManageTagsDialog } from "@/components/manage-tags-dialog";
import { cn } from "@/lib/utils";

const DEFAULT_HIGHLIGHT_COLOR = "#fbbf2480"; // Amber color matching articles

export default function BookDetailPage({
  params,
}: {
  params: Promise<{ id: Id<"books"> }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const { setHeaderAction } = useHeaderAction();
  const book = useQuery(api.books.getBook, { bookId: id });
  const highlights = useQuery(api.highlights.listBookHighlights, {
    bookId: id,
  });
  const updateBook = useMutation(api.books.updateBook);
  const deleteBook = useMutation(api.books.deleteBook);
  const addTag = useMutation(api.books.addTag);
  const removeTag = useMutation(api.books.removeTag);
  const createHighlight = useMutation(api.highlights.createHighlight);
  const deleteHighlight = useMutation(api.highlights.deleteHighlight);

  // Local state for inline editing
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingAuthor, setIsEditingAuthor] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedAuthor, setEditedAuthor] = useState("");

  // State for Add Highlight dialog
  const [isAddHighlightOpen, setIsAddHighlightOpen] = useState(false);
  const [newHighlightText, setNewHighlightText] = useState("");
  const [newHighlightPage, setNewHighlightPage] = useState("");

  // State for delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteHighlightId, setDeleteHighlightId] =
    useState<Id<"highlights"> | null>(null);

  // State for manage tags dialog
  const [manageTagsOpen, setManageTagsOpen] = useState(false);

  // Set header action for this page
  useEffect(() => {
    setHeaderAction({
      label: "Add Highlight",
      onClick: () => setIsAddHighlightOpen(true),
      shortcut: "C",
    });
    return () => setHeaderAction(null);
  }, [setHeaderAction]);

  // Keyboard shortcut: C to add highlight
  useKeyboardShortcut(singleKey("c"), () => setIsAddHighlightOpen(true));

  if (book === undefined || highlights === undefined) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner />
      </div>
    );
  }

  if (book === null) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-muted-foreground">Book not found</p>
        <Button onClick={() => router.push("/books")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Books
        </Button>
      </div>
    );
  }

  const handleSaveTitle = async () => {
    if (!editedTitle.trim()) {
      toast.error("Title cannot be empty");
      return;
    }

    try {
      await updateBook({
        bookId: id,
        title: editedTitle.trim(),
      });
      setIsEditingTitle(false);
      toast.success("Title updated");
    } catch (error) {
      toast.error("Failed to update title");
      console.error(error);
    }
  };

  const handleSaveAuthor = async () => {
    try {
      await updateBook({
        bookId: id,
        author: editedAuthor.trim() || undefined,
      });
      setIsEditingAuthor(false);
      toast.success("Author updated");
    } catch (error) {
      toast.error("Failed to update author");
      console.error(error);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateBook({
        bookId: id,
        status: newStatus,
      });
      toast.success("Status updated");
    } catch (error) {
      toast.error("Failed to update status");
      console.error(error);
    }
  };

  const handleDeleteBook = async () => {
    try {
      await deleteBook({ bookId: id });
      toast.success("Book deleted");
      router.push("/books");
    } catch (error) {
      toast.error("Failed to delete book");
      console.error(error);
    }
  };

  const handleAddHighlight = async () => {
    if (!newHighlightText.trim()) {
      toast.error("Highlight text cannot be empty");
      return;
    }

    if (!newHighlightPage.trim()) {
      toast.error("Page number is required");
      return;
    }

    const pageNum = parseInt(newHighlightPage, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      toast.error("Please enter a valid page number");
      return;
    }

    try {
      await createHighlight({
        contentType: "book",
        contentId: id,
        textContent: newHighlightText.trim(),
        pageNumber: pageNum,
        color: DEFAULT_HIGHLIGHT_COLOR,
      });
      toast.success("Highlight added");
      setIsAddHighlightOpen(false);
      setNewHighlightText("");
      setNewHighlightPage("");
    } catch (error) {
      toast.error("Failed to add highlight");
      console.error(error);
    }
  };

  const handleDeleteHighlight = async () => {
    if (!deleteHighlightId) return;

    try {
      await deleteHighlight({ highlightId: deleteHighlightId });
      toast.success("Highlight deleted");
      setDeleteHighlightId(null);
    } catch (error) {
      toast.error("Failed to delete highlight");
      console.error(error);
    }
  };

  const handleAddTags = async (tags: string[]) => {
    try {
      for (const tag of tags) {
        await addTag({
          bookId: id,
          tag,
        });
      }
      toast.success(tags.length === 1 ? "Tag added" : "Tags added");
    } catch (error) {
      toast.error("Failed to add tags");
      console.error(error);
    }
  };

  const handleRemoveTag = async (tag: string) => {
    try {
      await removeTag({
        bookId: id,
        tag,
      });
      toast.success("Tag removed");
    } catch (error) {
      toast.error("Failed to remove tag");
      console.error(error);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      {/* Back button */}
      <Button
        variant="ghost"
        onClick={() => router.push("/books")}
        className="mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Books
      </Button>

      {/* Book Metadata Section */}
      <div className="space-y-6">
        <div className="flex gap-6">
          {/* Cover Image */}
          {book.coverUrl && (
            <div className="flex-shrink-0">
              <img
                src={book.coverUrl}
                alt={book.title}
                className="w-32 h-auto object-cover rounded-lg shadow-md"
              />
            </div>
          )}

          {/* Metadata */}
          <div className="flex-1 space-y-4">
            {/* Title - Inline Editable */}
            <div>
              {isEditingTitle ? (
                <div className="flex gap-2 items-center">
                  <Input
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSaveTitle();
                      } else if (e.key === "Escape") {
                        setIsEditingTitle(false);
                      }
                    }}
                    autoFocus
                    className="text-2xl font-bold h-auto py-2"
                  />
                  <Button size="icon" variant="ghost" onClick={handleSaveTitle}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setIsEditingTitle(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <h1 className="text-3xl font-bold">{book.title}</h1>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      setEditedTitle(book.title);
                      setIsEditingTitle(true);
                    }}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Author - Inline Editable */}
            <div>
              {isEditingAuthor ? (
                <div className="flex gap-2 items-center">
                  <Input
                    value={editedAuthor}
                    onChange={(e) => setEditedAuthor(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSaveAuthor();
                      } else if (e.key === "Escape") {
                        setIsEditingAuthor(false);
                      }
                    }}
                    placeholder="Author name"
                    autoFocus
                    className="text-lg h-auto py-1"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleSaveAuthor}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setIsEditingAuthor(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <p className="text-lg text-muted-foreground">
                    {book.author || "Unknown author"}
                  </p>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      setEditedAuthor(book.author || "");
                      setIsEditingAuthor(true);
                    }}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Status */}
            <div className="flex items-center gap-2">
              <Label>Status:</Label>
              <Select value={book.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(BOOK_STATUSES).map((status) => {
                    const config = BOOK_STATUS_CONFIG[status];
                    const IconComponent = config.icon;
                    return (
                      <SelectItem key={status} value={status}>
                        <div className="flex items-center gap-2">
                          <IconComponent className="h-4 w-4" />
                          {config.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Tags */}
            <div className="flex items-center gap-2">
              <Label>Tags:</Label>
              {book.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {book.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">No tags</span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setManageTagsOpen(true)}
              >
                Edit Tags
              </Button>
            </div>

            {/* Metadata */}
            {book.publishedDate && (
              <p className="text-sm text-muted-foreground">
                Published: {formatDate(book.publishedDate)}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Added: {formatDate(book.addedAt)}
            </p>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2Icon className="size-4" />
                Delete Book
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        {/* Highlights Section */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Highlights</h2>

          {/* Highlights List */}
          {highlights.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BookmarkIcon />
                </EmptyMedia>
                <EmptyTitle>No Highlights Yet</EmptyTitle>
                <EmptyDescription>
                  You haven&apos;t added any highlights from this book yet.
                  Start by adding your first highlight.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={() => setIsAddHighlightOpen(true)}>
                  <BookmarkPlusIcon className="size-4" />
                  Add Highlight <Kbd>C</Kbd>
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="space-y-3">
              {highlights.map((highlight) => (
                <Card key={highlight._id}>
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary">
                          Page {highlight.pageNumber}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteHighlightId(highlight._id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <blockquote className="border-l-4 border-amber-400 pl-4 italic">
                        {highlight.textContent}
                      </blockquote>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(highlight.createdAt)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Book Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{book.title}&quot; and all its
              highlights. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBook}
              className={cn(buttonVariants({ variant: "destructive" }))}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Highlight Confirmation Dialog */}
      <AlertDialog
        open={deleteHighlightId !== null}
        onOpenChange={(open) => !open && setDeleteHighlightId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Highlight?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this highlight. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteHighlight}
              className={cn(buttonVariants({ variant: "destructive" }))}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Highlight Dialog */}
      <Dialog open={isAddHighlightOpen} onOpenChange={setIsAddHighlightOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Highlight</DialogTitle>
            <DialogDescription>
              Add a highlight from your reading
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAddHighlight();
            }}
          >
            <FieldGroup>
              <FieldSet>
                <Field>
                  <FieldLabel htmlFor="page">Page Number</FieldLabel>
                  <Input
                    id="page"
                    type="number"
                    min="1"
                    placeholder="42"
                    value={newHighlightPage}
                    onChange={(e) => setNewHighlightPage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setIsAddHighlightOpen(false);
                      }
                    }}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="text">Highlight Text</FieldLabel>
                  <Textarea
                    id="text"
                    placeholder="Enter the text you highlighted..."
                    rows={6}
                    value={newHighlightText}
                    onChange={(e) => setNewHighlightText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setIsAddHighlightOpen(false);
                      }
                    }}
                  />
                </Field>
              </FieldSet>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddHighlightOpen(false)}
                >
                  Cancel <Kbd>Esc</Kbd>
                </Button>
                <Button
                  type="submit"
                  disabled={
                    !newHighlightText.trim() || !newHighlightPage.trim()
                  }
                >
                  Save Highlight <Kbd>⏎</Kbd>
                </Button>
              </DialogFooter>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manage Tags Dialog */}
      <ManageTagsDialog
        open={manageTagsOpen}
        onOpenChange={setManageTagsOpen}
        currentTags={book.tags}
        onAddTags={handleAddTags}
        onRemoveTag={handleRemoveTag}
        contentType="book"
      />
    </div>
  );
}
