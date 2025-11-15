"use client";

import { useQuery } from "convex-helpers/react/cache/hooks";
import { useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
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
import { ArrowLeft, Plus, Trash2, Edit2, X, Check } from "lucide-react";
import { toast } from "sonner";
import { BOOK_STATUS_CONFIG, BOOK_STATUSES } from "../types";
import { ManageTagsDialog } from "@/components/manage-tags-dialog";

const DEFAULT_HIGHLIGHT_COLOR = "#fbbf2480"; // Amber color matching articles

export default function BookDetailPage({
  params,
}: {
  params: { id: Id<"books"> };
}) {
  const router = useRouter();
  const book = useQuery(api.books.getBook, { bookId: params.id });
  const highlights = useQuery(api.highlights.listBookHighlights, {
    bookId: params.id,
  });
  const updateBook = useMutation(api.books.updateBook);
  const deleteBook = useMutation(api.books.deleteBook);
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

  // State for manage tags dialog
  const [manageTagsOpen, setManageTagsOpen] = useState(false);

  if (book === undefined || highlights === undefined) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
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
        bookId: params.id,
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
        bookId: params.id,
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
        bookId: params.id,
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
      await deleteBook({ bookId: params.id });
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
        contentId: params.id,
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

  const handleDeleteHighlight = async (highlightId: Id<"highlights">) => {
    try {
      await deleteHighlight({ highlightId });
      toast.success("Highlight deleted");
    } catch (error) {
      toast.error("Failed to delete highlight");
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
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleSaveTitle}
                  >
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
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Book
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        {/* Highlights Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Highlights</h2>
            <Dialog open={isAddHighlightOpen} onOpenChange={setIsAddHighlightOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Highlight
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Highlight</DialogTitle>
                  <DialogDescription>
                    Add a highlight from your reading
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="page">Page Number</Label>
                    <Input
                      id="page"
                      type="number"
                      min="1"
                      placeholder="42"
                      value={newHighlightPage}
                      onChange={(e) => setNewHighlightPage(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="text">Highlight Text</Label>
                    <Textarea
                      id="text"
                      placeholder="Enter the text you highlighted..."
                      rows={6}
                      value={newHighlightText}
                      onChange={(e) => setNewHighlightText(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsAddHighlightOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAddHighlight}>Save Highlight</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Highlights List */}
          {highlights.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                No highlights yet. Add your first highlight from this book!
              </CardContent>
            </Card>
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
                          onClick={() => handleDeleteHighlight(highlight._id)}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{book.title}&quot; and all its highlights.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBook}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manage Tags Dialog */}
      <ManageTagsDialog
        open={manageTagsOpen}
        onOpenChange={setManageTagsOpen}
        contentType="book"
        contentId={params.id}
        currentTags={book.tags}
      />
    </div>
  );
}
