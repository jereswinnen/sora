"use client";

import { useMutation, useAction } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { api } from "../../../../convex/_generated/api";
import { useState, useEffect } from "react";
import { Id } from "../../../../convex/_generated/dataModel";
import { useRouter, useSearchParams } from "next/navigation";
import { useHeaderAction } from "@/components/layout-header-context";
import { useBookActions } from "@/hooks/use-book-actions";
import { useKeyboardShortcut, singleKey } from "@/hooks/use-keyboard-shortcut";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AlertCircle, LibraryIcon, Search } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";
import { createColumns, Book } from "./columns";
import { ManageTagsDialog } from "@/components/manage-tags-dialog";
import { TagCombobox } from "@/components/ui/tag-combobox";
import {
  BOOK_STATUSES,
  BOOK_STATUS_CONFIG,
  OpenLibraryBook,
  BookStatus,
} from "./types";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
  FieldSet,
} from "@/components/ui/field";
import { Kbd } from "@/components/ui/kbd";

function StatusOption({ status }: { status: BookStatus }) {
  const config = BOOK_STATUS_CONFIG[status];
  const IconComponent = config.icon;
  return (
    <div className="flex items-center gap-2">
      <IconComponent className="size-4" />
      {config.label}
    </div>
  );
}

// Helper function to clean Convex error messages
function cleanErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    let message = err.message;

    // Remove Convex-specific prefixes
    message = message.replace(/^\[CONVEX.*?\]\s*/g, "");
    message = message.replace(/^\[Request ID:.*?\]\s*/g, "");
    message = message.replace(/^Server Error\s*/i, "");
    message = message.replace(/^Uncaught Error:\s*/i, "");

    // Remove stack trace information
    const atHandlerIndex = message.indexOf(" at handler");
    if (atHandlerIndex !== -1) {
      message = message.substring(0, atHandlerIndex);
    }
    const calledByIndex = message.indexOf(" Called by client");
    if (calledByIndex !== -1) {
      message = message.substring(0, calledByIndex);
    }

    return message.trim();
  }
  return "An unexpected error occurred";
}

export default function BooksPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setHeaderAction } = useHeaderAction();

  // Form state
  const [coverUrl, setCoverUrl] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [publishedDate, setPublishedDate] = useState("");
  const [status, setStatus] = useState<BookStatus>(BOOK_STATUSES.NOT_STARTED);
  const [bookTags, setBookTags] = useState<string[]>([]);
  const [favorited, setFavorited] = useState(false);

  // Dialog state
  const [selectedBookId, setSelectedBookId] = useState<Id<"books"> | null>(
    null,
  );
  const [deleteBookId, setDeleteBookId] = useState<Id<"books"> | null>(null);
  const [loading, setLoading] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [addTagDialogOpen, setAddTagDialogOpen] = useState(false);
  const [addBookDialogOpen, setAddBookDialogOpen] = useState(false);
  const [editBookDialogOpen, setEditBookDialogOpen] = useState(false);

  // OpenLibrary search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<OpenLibraryBook[]>([]);
  const [searching, setSearching] = useState(false);

  // Convex hooks - using cached useQuery from convex-helpers to prevent flash when navigating between pages
  const books = useQuery(api.books.listBooks, { limit: 100 });
  const allTags = useQuery(api.tags.getAllTags, {});
  const selectedBook = useQuery(
    api.books.getBook,
    selectedBookId ? { bookId: selectedBookId } : "skip",
  );
  const addBook = useMutation(api.books.addBook);
  const updateBook = useMutation(api.books.updateBook);
  const deleteBook = useMutation(api.books.deleteBook);
  const searchOpenLibrary = useAction(api.books.searchOpenLibrary);

  // Get shared book actions
  const {
    handleToggleFavorite,
    handleUpdateStatus,
    handleDelete: handleDeleteAction,
    handleAddTags: handleAddTagsAction,
    handleRemoveTag: handleRemoveTagAction,
  } = useBookActions();

  // Set header action for this page
  useEffect(() => {
    setHeaderAction({
      label: "Add Book",
      onClick: () => {
        resetForm();
        setAddBookDialogOpen(true);
      },
      shortcut: "C",
    });
    return () => setHeaderAction(null);
  }, [setHeaderAction]);

  // Keyboard shortcut: C to add book
  useKeyboardShortcut(singleKey("c"), () => {
    resetForm();
    setAddBookDialogOpen(true);
  });

  // Check for query params to trigger actions (e.g., from command palette)
  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "add") {
      resetForm();
      setAddBookDialogOpen(true);
      // Clean up URL without triggering a page reload
      window.history.replaceState({}, "", "/books");
    }
  }, [searchParams]);

  // Load book data into form when editing
  useEffect(() => {
    if (editBookDialogOpen && selectedBook) {
      setCoverUrl(selectedBook.coverUrl || "");
      setTitle(selectedBook.title);
      setAuthor(selectedBook.author || "");
      setPublishedDate(
        selectedBook.publishedDate
          ? new Date(selectedBook.publishedDate).toISOString().split("T")[0]
          : "",
      );
      setStatus(selectedBook.status as BookStatus);
      setBookTags(selectedBook.tags || []);
      setFavorited(selectedBook.favorited || false);
    }
  }, [editBookDialogOpen, selectedBook]);

  const resetForm = () => {
    setCoverUrl("");
    setTitle("");
    setAuthor("");
    setPublishedDate("");
    setStatus(BOOK_STATUSES.NOT_STARTED);
    setBookTags([]);
    setFavorited(false);
    setBookError(null);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const results = await searchOpenLibrary({ query: searchQuery, limit: 5 });
      setSearchResults(results || []);
    } catch {
      toast.error("Failed to search OpenLibrary");
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectBook = (book: OpenLibraryBook) => {
    setTitle(book.title || "");
    setAuthor(book.author || "");
    setCoverUrl(book.coverUrl || "");
    if (book.publishedDate) {
      setPublishedDate(
        new Date(book.publishedDate).toISOString().split("T")[0],
      );
    }
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setBookError(null);

    try {
      await addBook({
        coverUrl: coverUrl || undefined,
        title,
        author: author || undefined,
        publishedDate: publishedDate
          ? new Date(publishedDate).getTime()
          : undefined,
        status,
        tags: bookTags,
        favorited,
      });
      toast.success("Book added successfully!");
      resetForm();
      setAddBookDialogOpen(false);
    } catch (err) {
      setBookError(cleanErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookId) return;

    setLoading(true);
    setBookError(null);

    try {
      await updateBook({
        bookId: selectedBookId,
        coverUrl: coverUrl || undefined,
        title,
        author: author || undefined,
        publishedDate: publishedDate
          ? new Date(publishedDate).getTime()
          : undefined,
        status,
        favorited,
      });
      toast.success("Book updated successfully!");
      resetForm();
      setEditBookDialogOpen(false);
      setSelectedBookId(null);
    } catch (err) {
      setBookError(cleanErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBook = async (bookId: Id<"books">) => {
    try {
      await handleDeleteAction(bookId);
      setDeleteBookId(null);
    } catch {
      // Error already handled by hook
    }
  };

  const handleBulkDelete = async (bookIds: Id<"books">[]) => {
    try {
      await Promise.all(bookIds.map((id) => deleteBook({ bookId: id })));
      toast.success(`${bookIds.length} book(s) deleted!`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete books",
      );
    }
  };

  const handleAddTags = async (tags: string[]) => {
    if (!selectedBookId || tags.length === 0) return;
    await handleAddTagsAction(selectedBookId, tags, selectedBook?.tags || []);
  };

  const handleRemoveTag = async (tag: string) => {
    if (!selectedBookId) return;
    await handleRemoveTagAction(selectedBookId, tag);
  };

  // Transform books data to match the Book type
  const tableData: Book[] =
    books?.map((book) => ({
      _id: book._id,
      title: book.title,
      author: book.author,
      coverUrl: book.coverUrl,
      publishedDate: book.publishedDate,
      status: book.status,
      tags: book.tags,
      favorited: book.favorited,
      dateStarted: book.dateStarted,
      dateRead: book.dateRead,
      addedAt: book.addedAt,
    })) ?? [];

  const columns = createColumns({
    onEdit: (id) => {
      setSelectedBookId(id);
      setEditBookDialogOpen(true);
    },
    onToggleFavorite: handleToggleFavorite,
    onUpdateStatus: handleUpdateStatus,
    onDelete: (id) => setDeleteBookId(id),
    onAddTag: (id) => {
      setSelectedBookId(id);
      setAddTagDialogOpen(true);
    },
  });

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      {/* Books DataTable */}
      {books && books.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <LibraryIcon />
            </EmptyMedia>
            <EmptyTitle>No Books Yet</EmptyTitle>
            <EmptyDescription>
              You haven&apos;t added any books to your collection yet. Start by
              adding your first book.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setAddBookDialogOpen(true)}>Add Book</Button>
          </EmptyContent>
        </Empty>
      ) : (
        <DataTable
          columns={columns}
          data={tableData}
          searchColumn="title"
          searchPlaceholder="Filter by title..."
          bulkActions={({ selectedRows, table }) => (
            <>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  const ids = selectedRows.map((row: Book) => row._id);
                  handleBulkDelete(ids);
                  table.toggleAllPageRowsSelected(false);
                }}
              >
                Delete
              </Button>
            </>
          )}
        />
      )}

      {/* Manage Tags Dialog */}
      <ManageTagsDialog
        open={addTagDialogOpen}
        onOpenChange={setAddTagDialogOpen}
        currentTags={selectedBook?.tags || []}
        availableTags={allTags}
        onAddTags={handleAddTags}
        onRemoveTag={handleRemoveTag}
        contentType="book"
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteBookId !== null}
        onOpenChange={(open) => !open && setDeleteBookId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Book</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this book? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteBookId(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteBookId && handleDeleteBook(deleteBookId)}
              className={cn(buttonVariants({ variant: "destructive" }))}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Book Dialog */}
      <Dialog
        open={addBookDialogOpen}
        onOpenChange={(open) => {
          setAddBookDialogOpen(open);
          if (!open) {
            resetForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Book</DialogTitle>
            <DialogDescription>
              Search for a book or enter details manually.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup>
            {/* OpenLibrary Search Section */}
            <FieldSet>
              <form onSubmit={handleSearch}>
                <Field>
                  <FieldLabel htmlFor="search-query">
                    Search OpenLibrary
                  </FieldLabel>
                  <div className="flex gap-2">
                    <Input
                      id="search-query"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by title or author..."
                    />
                    <Button
                      type="submit"
                      disabled={searching || !searchQuery.trim()}
                      size="icon"
                    >
                      {searching ? <Spinner /> : <Search />}
                    </Button>
                  </div>
                </Field>
              </form>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-md p-2">
                  {searchResults.map((book, index) => (
                    <Button
                      key={index}
                      type="button"
                      variant="ghost"
                      onClick={() => handleSelectBook(book)}
                      className="w-full h-auto p-3 justify-start"
                    >
                      <div className="flex gap-3 items-center w-full">
                        {book.coverUrl && (
                          <img
                            src={book.coverUrl}
                            alt={book.title}
                            className="w-10 h-14 object-cover rounded flex-shrink-0"
                          />
                        )}
                        <div className="flex flex-col items-start gap-1 min-w-0 flex-1">
                          <div className="font-medium text-sm line-clamp-1 text-left w-full">
                            {book.title}
                          </div>
                          {book.author && (
                            <div className="text-xs text-muted-foreground line-clamp-1 text-left w-full">
                              {book.author}
                            </div>
                          )}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              )}
            </FieldSet>

            <FieldSeparator>Or enter manually</FieldSeparator>

            {bookError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{bookError}</AlertDescription>
              </Alert>
            )}

            {/* Book Details Form */}
            <form onSubmit={handleAddBook}>
              <FieldGroup>
                <FieldSet>
                  <Field>
                    <FieldLabel htmlFor="book-title">Title *</FieldLabel>
                    <Input
                      id="book-title"
                      type="text"
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        if (bookError) setBookError(null);
                      }}
                      placeholder="The Great Gatsby"
                      required
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="book-author">Author</FieldLabel>
                    <Input
                      id="book-author"
                      type="text"
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      placeholder="F. Scott Fitzgerald"
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel htmlFor="book-date">
                        Published Date
                      </FieldLabel>
                      <Input
                        id="book-date"
                        type="date"
                        value={publishedDate}
                        onChange={(e) => setPublishedDate(e.target.value)}
                      />
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="book-status">Status</FieldLabel>
                      <Select
                        value={status}
                        onValueChange={(value) =>
                          setStatus(value as BookStatus)
                        }
                      >
                        <SelectTrigger id="book-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={BOOK_STATUSES.NOT_STARTED}>
                            <StatusOption status={BOOK_STATUSES.NOT_STARTED} />
                          </SelectItem>
                          <SelectItem value={BOOK_STATUSES.READING}>
                            <StatusOption status={BOOK_STATUSES.READING} />
                          </SelectItem>
                          <SelectItem value={BOOK_STATUSES.FINISHED}>
                            <StatusOption status={BOOK_STATUSES.FINISHED} />
                          </SelectItem>
                          <SelectItem value={BOOK_STATUSES.ABANDONED}>
                            <StatusOption status={BOOK_STATUSES.ABANDONED} />
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  <Field>
                    <FieldLabel htmlFor="book-cover">Cover URL</FieldLabel>
                    {coverUrl && (
                      <div className="flex py-2">
                        <img
                          src={coverUrl}
                          alt="Book cover preview"
                          className="h-32 w-auto object-cover rounded border"
                        />
                      </div>
                    )}
                    <Input
                      id="book-cover"
                      type="url"
                      value={coverUrl}
                      onChange={(e) => setCoverUrl(e.target.value)}
                      placeholder="https://example.com/cover.jpg"
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="tags">Tags</FieldLabel>
                    <TagCombobox
                      availableTags={allTags}
                      selectedTags={bookTags}
                      onTagsChange={setBookTags}
                      placeholder="Select or create tags..."
                      emptyText="No tags found. Type to create new tags."
                    />
                  </Field>
                </FieldSet>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAddBookDialogOpen(false)}
                  >
                    Cancel <Kbd>Esc</Kbd>
                  </Button>
                  <Button type="submit" disabled={loading || !title}>
                    {loading ? (
                      <>
                        <Spinner />
                        Saving...
                      </>
                    ) : (
                      <>
                        Save Book <Kbd>⏎</Kbd>
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </FieldGroup>
            </form>
          </FieldGroup>
        </DialogContent>
      </Dialog>

      {/* Edit Book Dialog */}
      <Dialog
        open={editBookDialogOpen}
        onOpenChange={(open) => {
          setEditBookDialogOpen(open);
          if (!open) {
            resetForm();
            setSelectedBookId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Edit Book</DialogTitle>
            <DialogDescription>
              Update the book details below.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateBook}>
            <FieldGroup>
              {bookError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{bookError}</AlertDescription>
                </Alert>
              )}

              <FieldSet>
                <Field>
                  <FieldLabel htmlFor="edit-book-title">Title *</FieldLabel>
                  <Input
                    id="edit-book-title"
                    type="text"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (bookError) setBookError(null);
                    }}
                    placeholder="The Great Gatsby"
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="edit-book-author">Author</FieldLabel>
                  <Input
                    id="edit-book-author"
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="F. Scott Fitzgerald"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="edit-book-date">
                      Published Date
                    </FieldLabel>
                    <Input
                      id="edit-book-date"
                      type="date"
                      value={publishedDate}
                      onChange={(e) => setPublishedDate(e.target.value)}
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="edit-book-status">Status</FieldLabel>
                    <Select
                      value={status}
                      onValueChange={(value) => setStatus(value as BookStatus)}
                    >
                      <SelectTrigger id="edit-book-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={BOOK_STATUSES.NOT_STARTED}>
                          <StatusOption status={BOOK_STATUSES.NOT_STARTED} />
                        </SelectItem>
                        <SelectItem value={BOOK_STATUSES.READING}>
                          <StatusOption status={BOOK_STATUSES.READING} />
                        </SelectItem>
                        <SelectItem value={BOOK_STATUSES.FINISHED}>
                          <StatusOption status={BOOK_STATUSES.FINISHED} />
                        </SelectItem>
                        <SelectItem value={BOOK_STATUSES.ABANDONED}>
                          <StatusOption status={BOOK_STATUSES.ABANDONED} />
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="edit-book-cover">Cover URL</FieldLabel>
                  {coverUrl && (
                    <div className="flex py-2">
                      <img
                        src={coverUrl}
                        alt="Book cover preview"
                        className="h-32 w-auto object-cover rounded border"
                      />
                    </div>
                  )}
                  <Input
                    id="edit-book-cover"
                    type="url"
                    value={coverUrl}
                    onChange={(e) => setCoverUrl(e.target.value)}
                    placeholder="https://example.com/cover.jpg"
                  />
                </Field>
              </FieldSet>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditBookDialogOpen(false)}
                >
                  Cancel <Kbd>Esc</Kbd>
                </Button>
                <Button type="submit" disabled={loading || !title}>
                  {loading ? (
                    <>
                      <Spinner />
                      Saving...
                    </>
                  ) : (
                    <>
                      Save Changes <Kbd>⏎</Kbd>
                    </>
                  )}
                </Button>
              </DialogFooter>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
