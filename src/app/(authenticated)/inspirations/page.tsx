"use client";

import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { api } from "../../../../convex/_generated/api";
import { useState, useEffect, useCallback, useRef } from "react";
import { Id } from "../../../../convex/_generated/dataModel";
import { useHeaderAction } from "@/components/layout-header-context";
import { useKeyboardShortcut, singleKey } from "@/hooks/use-keyboard-shortcut";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AlertCircle,
  ImageIcon,
  Upload,
  X,
  Heart,
  Trash2,
  Pencil,
  Tag,
} from "lucide-react";
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
import { ManageTagsDialog } from "@/components/manage-tags-dialog";
import { TagCombobox } from "@/components/ui/tag-combobox";
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
  FieldSet,
} from "@/components/ui/field";
import { Kbd } from "@/components/ui/kbd";

// Type for inspiration with image URL
interface InspirationWithUrl {
  _id: Id<"inspirations">;
  userId: string;
  storageId: Id<"_storage">;
  title?: string;
  description?: string;
  tags: string[];
  favorited?: boolean;
  width?: number;
  height?: number;
  addedAt: number;
  imageUrl: string | null;
}

// Helper function to clean Convex error messages
function cleanErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    let message = err.message;
    message = message.replace(/^\[CONVEX.*?\]\s*/g, "");
    message = message.replace(/^\[Request ID:.*?\]\s*/g, "");
    message = message.replace(/^Server Error\s*/i, "");
    message = message.replace(/^Uncaught Error:\s*/i, "");
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

// Masonry grid component
function MasonryGrid({
  items,
  onItemClick,
  onLoadMore,
  hasMore,
}: {
  items: InspirationWithUrl[];
  onItemClick: (item: InspirationWithUrl) => void;
  onLoadMore: () => void;
  hasMore: boolean;
}) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, onLoadMore]);

  return (
    <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 gap-4 space-y-4">
      {items.map((item) => (
        <div
          key={item._id}
          className="break-inside-avoid cursor-pointer group relative"
          onClick={() => onItemClick(item)}
        >
          <div className="relative overflow-hidden rounded-lg border bg-muted">
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.title || "Inspiration"}
                className="w-full h-auto object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="aspect-square flex items-center justify-center">
                <ImageIcon className="size-8 text-muted-foreground" />
              </div>
            )}
            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
              <div className="w-full">
                {item.title && (
                  <p className="text-white text-sm font-medium line-clamp-2">
                    {item.title}
                  </p>
                )}
                {item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {item.tags.slice(0, 3).map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="text-xs bg-white/20 text-white border-0"
                      >
                        {tag}
                      </Badge>
                    ))}
                    {item.tags.length > 3 && (
                      <Badge
                        variant="secondary"
                        className="text-xs bg-white/20 text-white border-0"
                      >
                        +{item.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
            {/* Favorite indicator */}
            {item.favorited && (
              <div className="absolute top-2 right-2">
                <Heart className="size-4 text-red-500 fill-red-500" />
              </div>
            )}
          </div>
        </div>
      ))}
      {/* Load more trigger */}
      <div ref={loadMoreRef} className="h-4" />
    </div>
  );
}

export default function InspirationsPage() {
  const { setHeaderAction } = useHeaderAction();

  // State
  const [items, setItems] = useState<InspirationWithUrl[]>([]);
  const [cursor, setCursor] = useState<number | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InspirationWithUrl | null>(
    null
  );

  // Form state
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Convex hooks
  const inspirationsData = useQuery(api.inspirations.listInspirations, {
    limit: 20,
    cursor,
  });
  const allTags = useQuery(api.tags.getAllTags, {});
  const generateUploadUrl = useMutation(api.inspirations.generateUploadUrl);
  const saveInspiration = useMutation(api.inspirations.saveInspiration);
  const updateInspiration = useMutation(api.inspirations.updateInspiration);
  const deleteInspiration = useMutation(api.inspirations.deleteInspiration);
  const toggleFavorite = useMutation(api.inspirations.toggleFavorite);
  const addTag = useMutation(api.inspirations.addTag);
  const removeTag = useMutation(api.inspirations.removeTag);

  // Load initial data
  useEffect(() => {
    if (inspirationsData && !cursor) {
      setItems(inspirationsData.items);
      setHasMore(!!inspirationsData.nextCursor);
    }
  }, [inspirationsData, cursor]);

  // Set header action
  useEffect(() => {
    setHeaderAction({
      label: "Add Inspiration",
      onClick: () => {
        resetForm();
        setAddDialogOpen(true);
      },
      shortcut: "C",
    });
    return () => setHeaderAction(null);
  }, [setHeaderAction]);

  // Keyboard shortcut: C to add
  useKeyboardShortcut(singleKey("c"), () => {
    resetForm();
    setAddDialogOpen(true);
  });

  const resetForm = () => {
    setFile(null);
    setFilePreview(null);
    setTitle("");
    setDescription("");
    setTags([]);
    setError(null);
  };

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !inspirationsData?.nextCursor) return;

    setIsLoadingMore(true);
    setCursor(inspirationsData.nextCursor);

    // The useEffect will handle updating items when new data arrives
    // But we need to append, not replace
  }, [isLoadingMore, hasMore, inspirationsData?.nextCursor]);

  // Handle appending new items when cursor changes
  useEffect(() => {
    if (inspirationsData && cursor) {
      setItems((prev) => [...prev, ...inspirationsData.items]);
      setHasMore(!!inspirationsData.nextCursor);
      setIsLoadingMore(false);
    }
  }, [inspirationsData, cursor]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      if (!selectedFile.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }

      // Validate file size (max 20MB)
      if (selectedFile.size > 20 * 1024 * 1024) {
        setError("File size must be less than 20MB");
        return;
      }

      setFile(selectedFile);
      setError(null);

      // Create preview
      const reader = new FileReader();
      reader.onload = (event) => {
        setFilePreview(event.target?.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      if (!droppedFile.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }

      if (droppedFile.size > 20 * 1024 * 1024) {
        setError("File size must be less than 20MB");
        return;
      }

      setFile(droppedFile);
      setError(null);

      const reader = new FileReader();
      reader.onload = (event) => {
        setFilePreview(event.target?.result as string);
      };
      reader.readAsDataURL(droppedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const getImageDimensions = (
    file: File
  ): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select an image");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Get image dimensions
      const dimensions = await getImageDimensions(file);

      // Step 1: Get upload URL
      const uploadUrl = await generateUploadUrl();

      // Step 2: Upload file
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!response.ok) {
        throw new Error("Failed to upload file");
      }

      const { storageId } = await response.json();

      // Step 3: Save to database
      await saveInspiration({
        storageId,
        title: title || undefined,
        description: description || undefined,
        tags,
        width: dimensions.width,
        height: dimensions.height,
      });

      toast.success("Inspiration added!");
      resetForm();
      setAddDialogOpen(false);

      // Reset pagination to reload from beginning
      setCursor(undefined);
      setItems([]);
    } catch (err) {
      setError(cleanErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const handleItemClick = (item: InspirationWithUrl) => {
    setSelectedItem(item);
    setViewDialogOpen(true);
  };

  const handleEdit = () => {
    if (!selectedItem) return;
    setTitle(selectedItem.title || "");
    setDescription(selectedItem.description || "");
    setViewDialogOpen(false);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    setUploading(true);
    setError(null);

    try {
      await updateInspiration({
        inspirationId: selectedItem._id,
        title: title || undefined,
        description: description || undefined,
      });
      toast.success("Inspiration updated!");
      setEditDialogOpen(false);
      setSelectedItem(null);
      resetForm();

      // Refresh data
      setCursor(undefined);
      setItems([]);
    } catch (err) {
      setError(cleanErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;

    try {
      await deleteInspiration({ inspirationId: selectedItem._id });
      toast.success("Inspiration deleted!");
      setDeleteDialogOpen(false);
      setViewDialogOpen(false);
      setSelectedItem(null);

      // Refresh data
      setCursor(undefined);
      setItems([]);
    } catch (err) {
      toast.error(cleanErrorMessage(err));
    }
  };

  const handleToggleFavorite = async () => {
    if (!selectedItem) return;

    try {
      const result = await toggleFavorite({
        inspirationId: selectedItem._id,
      });
      setSelectedItem({
        ...selectedItem,
        favorited: result.favorited,
      });
      // Update in items list too
      setItems((prev) =>
        prev.map((item) =>
          item._id === selectedItem._id
            ? { ...item, favorited: result.favorited }
            : item
        )
      );
    } catch (err) {
      toast.error(cleanErrorMessage(err));
    }
  };

  const handleAddTags = async (newTags: string[]) => {
    if (!selectedItem) return;

    for (const tag of newTags) {
      if (!selectedItem.tags.includes(tag)) {
        try {
          await addTag({ inspirationId: selectedItem._id, tag });
        } catch (err) {
          toast.error(cleanErrorMessage(err));
        }
      }
    }

    // Update selected item
    setSelectedItem({
      ...selectedItem,
      tags: [...new Set([...selectedItem.tags, ...newTags])],
    });

    // Update in items list
    setItems((prev) =>
      prev.map((item) =>
        item._id === selectedItem._id
          ? { ...item, tags: [...new Set([...item.tags, ...newTags])] }
          : item
      )
    );
  };

  const handleRemoveTag = async (tag: string) => {
    if (!selectedItem) return;

    try {
      await removeTag({ inspirationId: selectedItem._id, tag });

      // Update selected item
      setSelectedItem({
        ...selectedItem,
        tags: selectedItem.tags.filter((t) => t !== tag),
      });

      // Update in items list
      setItems((prev) =>
        prev.map((item) =>
          item._id === selectedItem._id
            ? { ...item, tags: item.tags.filter((t) => t !== tag) }
            : item
        )
      );
    } catch (err) {
      toast.error(cleanErrorMessage(err));
    }
  };

  const isLoading = !inspirationsData && items.length === 0;

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Spinner className="size-8" />
          </div>
        ) : items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ImageIcon />
              </EmptyMedia>
              <EmptyTitle>No Inspirations Yet</EmptyTitle>
              <EmptyDescription>
                Start collecting design inspiration by uploading screenshots and
                images.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => setAddDialogOpen(true)}>
                Add Inspiration
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <MasonryGrid
            items={items}
            onItemClick={handleItemClick}
            onLoadMore={handleLoadMore}
            hasMore={hasMore}
          />
        )}

        {isLoadingMore && (
          <div className="flex justify-center py-4">
            <Spinner className="size-6" />
          </div>
        )}
      </div>

      {/* Add Inspiration Dialog */}
      <Dialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          setAddDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Inspiration</DialogTitle>
            <DialogDescription>
              Upload an image to your inspiration collection.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpload}>
            <FieldGroup>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <FieldSet>
                {/* File Upload */}
                <Field>
                  <FieldLabel>Image</FieldLabel>
                  <div
                    className={cn(
                      "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                      "hover:border-primary hover:bg-muted/50",
                      file && "border-primary bg-muted/50"
                    )}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onClick={() =>
                      document.getElementById("file-input")?.click()
                    }
                  >
                    {filePreview ? (
                      <div className="relative">
                        <img
                          src={filePreview}
                          alt="Preview"
                          className="max-h-48 mx-auto rounded"
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="absolute top-2 right-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFile(null);
                            setFilePreview(null);
                          }}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Upload className="size-8" />
                        <p>Drop an image here or click to browse</p>
                        <p className="text-xs">Max file size: 20MB</p>
                      </div>
                    )}
                    <input
                      id="file-input"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                </Field>

                {/* Title */}
                <Field>
                  <FieldLabel htmlFor="title">Title (optional)</FieldLabel>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Give it a name..."
                  />
                </Field>

                {/* Description */}
                <Field>
                  <FieldLabel htmlFor="description">
                    Description (optional)
                  </FieldLabel>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add some notes..."
                    rows={3}
                  />
                </Field>

                {/* Tags */}
                <Field>
                  <FieldLabel>Tags</FieldLabel>
                  <TagCombobox
                    availableTags={allTags}
                    selectedTags={tags}
                    onTagsChange={setTags}
                    placeholder="Select or create tags..."
                  />
                </Field>
              </FieldSet>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddDialogOpen(false)}
                >
                  Cancel <Kbd>Esc</Kbd>
                </Button>
                <Button type="submit" disabled={uploading || !file}>
                  {uploading ? (
                    <>
                      <Spinner />
                      Uploading...
                    </>
                  ) : (
                    <>
                      Upload <Kbd>⏎</Kbd>
                    </>
                  )}
                </Button>
              </DialogFooter>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Inspiration Dialog */}
      <Dialog
        open={viewDialogOpen}
        onOpenChange={(open) => {
          setViewDialogOpen(open);
          if (!open) setSelectedItem(null);
        }}
      >
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          {selectedItem && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {selectedItem.title || "Inspiration"}
                </DialogTitle>
                {selectedItem.description && (
                  <DialogDescription>
                    {selectedItem.description}
                  </DialogDescription>
                )}
              </DialogHeader>

              <div className="relative">
                {selectedItem.imageUrl ? (
                  <img
                    src={selectedItem.imageUrl}
                    alt={selectedItem.title || "Inspiration"}
                    className="w-full h-auto rounded-lg"
                  />
                ) : (
                  <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                    <ImageIcon className="size-12 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Tags */}
              {selectedItem.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedItem.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <div className="flex gap-2 flex-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleToggleFavorite}
                  >
                    <Heart
                      className={cn(
                        "size-4",
                        selectedItem.favorited &&
                          "text-red-500 fill-red-500"
                      )}
                    />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setViewDialogOpen(false);
                      setTagsDialogOpen(true);
                    }}
                  >
                    <Tag className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleEdit}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setViewDialogOpen(false);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setViewDialogOpen(false)}
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            resetForm();
            setSelectedItem(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Edit Inspiration</DialogTitle>
            <DialogDescription>Update the title and description.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEdit}>
            <FieldGroup>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <FieldSet>
                <Field>
                  <FieldLabel htmlFor="edit-title">Title</FieldLabel>
                  <Input
                    id="edit-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Give it a name..."
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="edit-description">Description</FieldLabel>
                  <Textarea
                    id="edit-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add some notes..."
                    rows={3}
                  />
                </Field>
              </FieldSet>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                >
                  Cancel <Kbd>Esc</Kbd>
                </Button>
                <Button type="submit" disabled={uploading}>
                  {uploading ? (
                    <>
                      <Spinner />
                      Saving...
                    </>
                  ) : (
                    <>
                      Save <Kbd>⏎</Kbd>
                    </>
                  )}
                </Button>
              </DialogFooter>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manage Tags Dialog */}
      <ManageTagsDialog
        open={tagsDialogOpen}
        onOpenChange={setTagsDialogOpen}
        currentTags={selectedItem?.tags || []}
        availableTags={allTags}
        onAddTags={handleAddTags}
        onRemoveTag={handleRemoveTag}
        contentType="inspiration"
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open && !viewDialogOpen) {
            setSelectedItem(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Inspiration</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this inspiration? This will also
              delete the image file. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className={cn(buttonVariants({ variant: "destructive" }))}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
