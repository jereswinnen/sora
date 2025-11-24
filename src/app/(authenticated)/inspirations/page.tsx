"use client";

import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { api } from "../../../../convex/_generated/api";
import { useState, useEffect, useCallback } from "react";
import { Id } from "../../../../convex/_generated/dataModel";
import { useHeaderAction } from "@/components/layout-header-context";
import { useKeyboardShortcut, singleKey } from "@/hooks/use-keyboard-shortcut";
import { useInspirationActions } from "@/hooks/use-inspiration-actions";
import { useImageUpload } from "@/hooks/use-image-upload";
import { useDropZone } from "@/hooks/use-drop-zone";
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
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { Kbd } from "@/components/ui/kbd";
import { MasonryGrid } from "@/components/masonry-grid";
import { DropZoneOverlay } from "@/components/drop-zone-overlay";

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
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Hooks
  const imageUpload = useImageUpload({ maxSizeMB: 20 });
  const actions = useInspirationActions();

  // Convex hooks
  const inspirationsData = useQuery(api.inspirations.listInspirations, {
    limit: 20,
    cursor,
  });
  const allTags = useQuery(api.tags.getAllTags, {});
  const generateUploadUrl = useMutation(api.inspirations.generateUploadUrl);
  const saveInspiration = useMutation(api.inspirations.saveInspiration);

  // Refresh data helper
  const refreshData = useCallback(() => {
    setCursor(undefined);
    setItems([]);
  }, []);

  // Page-level drop zone for quick upload
  const handleQuickUpload = useCallback(
    async (file: File) => {
      const validationError = imageUpload.validateFile(file);
      if (validationError) {
        toast.error(validationError);
        return;
      }

      try {
        const result = await imageUpload.upload(generateUploadUrl, file);
        await saveInspiration({
          storageId: result.storageId,
          tags: [],
          width: result.width,
          height: result.height,
        });
        toast.success("Inspiration added!");
        refreshData();
      } catch {
        toast.error("Failed to upload image");
      }
    },
    [imageUpload, generateUploadUrl, saveInspiration, refreshData]
  );

  const { isDraggingOver, dropZoneProps } = useDropZone({
    onDrop: handleQuickUpload,
    accept: "image/*",
    disabled: addDialogOpen,
  });

  // Load initial data
  useEffect(() => {
    if (inspirationsData && !cursor) {
      setItems(inspirationsData.items);
      setHasMore(!!inspirationsData.nextCursor);
    }
  }, [inspirationsData, cursor]);

  // Handle appending new items when cursor changes
  useEffect(() => {
    if (inspirationsData && cursor) {
      setItems((prev) => [...prev, ...inspirationsData.items]);
      setHasMore(!!inspirationsData.nextCursor);
      setIsLoadingMore(false);
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
    imageUpload.reset();
    setTitle("");
    setDescription("");
    setTags([]);
    setFormError(null);
  };

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !inspirationsData?.nextCursor) return;
    setIsLoadingMore(true);
    setCursor(inspirationsData.nextCursor);
  }, [isLoadingMore, hasMore, inspirationsData?.nextCursor]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUpload.file) {
      setFormError("Please select an image");
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const result = await imageUpload.upload(generateUploadUrl);
      await saveInspiration({
        storageId: result.storageId,
        title: title || undefined,
        description: description || undefined,
        tags,
        width: result.width,
        height: result.height,
      });

      toast.success("Inspiration added!");
      resetForm();
      setAddDialogOpen(false);
      refreshData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to upload");
    } finally {
      setIsSaving(false);
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

    setIsSaving(true);
    setFormError(null);

    try {
      await actions.handleUpdate(selectedItem._id, {
        title: title || undefined,
        description: description || undefined,
      });
      setEditDialogOpen(false);
      setSelectedItem(null);
      resetForm();
      refreshData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;

    try {
      await actions.handleDelete(selectedItem._id);
      setDeleteDialogOpen(false);
      setViewDialogOpen(false);
      setSelectedItem(null);
      refreshData();
    } catch {
      // Error already handled by hook with toast
    }
  };

  const handleToggleFavorite = async () => {
    if (!selectedItem) return;

    try {
      const result = await actions.handleToggleFavorite(
        selectedItem._id,
        !!selectedItem.favorited
      );
      setSelectedItem({ ...selectedItem, favorited: result.favorited });
      setItems((prev) =>
        prev.map((item) =>
          item._id === selectedItem._id
            ? { ...item, favorited: result.favorited }
            : item
        )
      );
    } catch {
      // Error already handled by hook with toast
    }
  };

  const handleAddTags = async (newTags: string[]) => {
    if (!selectedItem) return;

    try {
      const addedTags = await actions.handleAddTags(
        selectedItem._id,
        newTags,
        selectedItem.tags
      );
      if (addedTags && addedTags.length > 0) {
        const updatedTags = [...new Set([...selectedItem.tags, ...addedTags])];
        setSelectedItem({ ...selectedItem, tags: updatedTags });
        setItems((prev) =>
          prev.map((item) =>
            item._id === selectedItem._id ? { ...item, tags: updatedTags } : item
          )
        );
      }
    } catch {
      // Error already handled by hook with toast
    }
  };

  const handleRemoveTag = async (tag: string) => {
    if (!selectedItem) return;

    try {
      await actions.handleRemoveTag(selectedItem._id, tag);
      const updatedTags = selectedItem.tags.filter((t) => t !== tag);
      setSelectedItem({ ...selectedItem, tags: updatedTags });
      setItems((prev) =>
        prev.map((item) =>
          item._id === selectedItem._id ? { ...item, tags: updatedTags } : item
        )
      );
    } catch {
      // Error already handled by hook with toast
    }
  };

  const isLoading = !inspirationsData && items.length === 0;
  const showUploadOverlay = imageUpload.isUploading && !addDialogOpen;

  return (
    <>
      <div
        className="flex flex-1 flex-col gap-4 p-4 relative"
        {...dropZoneProps}
      >
        <DropZoneOverlay
          isDraggingOver={isDraggingOver}
          isUploading={showUploadOverlay}
        />

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
          <MasonryGrid items={items} onItemClick={handleItemClick} />
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
              {(formError || imageUpload.error) && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {formError || imageUpload.error}
                  </AlertDescription>
                </Alert>
              )}

              <FieldSet>
                <Field>
                  <FieldLabel>Image</FieldLabel>
                  <div
                    className={cn(
                      "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                      "hover:border-primary hover:bg-muted/50",
                      imageUpload.file && "border-primary bg-muted/50"
                    )}
                    onDrop={imageUpload.handleDrop}
                    onDragOver={imageUpload.handleDragOver}
                    onClick={() =>
                      document.getElementById("file-input")?.click()
                    }
                  >
                    {imageUpload.preview ? (
                      <div className="relative">
                        <img
                          src={imageUpload.preview}
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
                            imageUpload.reset();
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
                      onChange={imageUpload.handleFileChange}
                      className="hidden"
                    />
                  </div>
                </Field>

                <Field>
                  <FieldLabel htmlFor="title">Title (optional)</FieldLabel>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Give it a name..."
                  />
                </Field>

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
                <Button
                  type="submit"
                  disabled={isSaving || imageUpload.isUploading || !imageUpload.file}
                >
                  {isSaving || imageUpload.isUploading ? (
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
                <DialogTitle>{selectedItem.title || "Inspiration"}</DialogTitle>
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
                        selectedItem.favorited && "text-red-500 fill-red-500"
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
            <DialogDescription>
              Update the title and description.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEdit}>
            <FieldGroup>
              {formError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{formError}</AlertDescription>
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
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? (
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
