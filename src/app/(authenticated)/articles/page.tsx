"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useState, useEffect } from "react";
import { Id } from "../../../../convex/_generated/dataModel";
import { useHeaderAction } from "@/components/layout-header-context";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { X } from "lucide-react";
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
import { DataTable } from "@/components/ui/data-table";
import { createColumns, Article } from "./columns";
import { TagCombobox } from "@/components/ui/tag-combobox";

export default function ArticlesPage() {
  const router = useRouter();
  const { setHeaderAction } = useHeaderAction();

  const [url, setUrl] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedArticleId, setSelectedArticleId] =
    useState<Id<"articles"> | null>(null);
  const [deleteArticleId, setDeleteArticleId] = useState<Id<"articles"> | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [addTagDialogOpen, setAddTagDialogOpen] = useState(false);
  const [addArticleDialogOpen, setAddArticleDialogOpen] = useState(false);

  // Convex hooks
  const articles = useQuery(api.articles.listArticles, { limit: 100 });
  const allTags = useQuery(api.tags.getAllTags);
  const selectedArticle = useQuery(
    api.articles.getArticle,
    selectedArticleId ? { articleId: selectedArticleId } : "skip",
  );
  const saveArticle = useAction(api.articles.saveArticle);

  // Set header action for this page
  useEffect(() => {
    setHeaderAction({
      label: "Add Article",
      onClick: () => setAddArticleDialogOpen(true),
    });
    return () => setHeaderAction(null);
  }, [setHeaderAction]);
  const deleteArticle = useMutation(api.articles.deleteArticle);
  const addTag = useMutation(api.articles.addTag);
  const removeTag = useMutation(api.articles.removeTag);
  const updateArticle = useMutation(api.articles.updateArticle);

  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await saveArticle({ url, tags: selectedTags });
      toast.success("Article saved successfully!");
      setUrl("");
      setSelectedTags([]);
      setAddArticleDialogOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save article",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteArticle = async (articleId: Id<"articles">) => {
    try {
      await deleteArticle({ articleId });
      toast.success("Article deleted!");
      setDeleteArticleId(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete article",
      );
    }
  };

  const handleBulkDelete = async (articleIds: Id<"articles">[]) => {
    try {
      await Promise.all(
        articleIds.map((id) => deleteArticle({ articleId: id })),
      );
      toast.success(`${articleIds.length} article(s) deleted!`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete articles",
      );
    }
  };

  const handleBulkMarkAsRead = async (articleIds: Id<"articles">[]) => {
    try {
      await Promise.all(
        articleIds.map((id) =>
          updateArticle({ articleId: id, readAt: Date.now() }),
        ),
      );
      toast.success(`${articleIds.length} article(s) marked as read!`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to mark articles as read",
      );
    }
  };

  const handleBulkArchive = async (articleIds: Id<"articles">[]) => {
    try {
      await Promise.all(
        articleIds.map((id) =>
          updateArticle({ articleId: id, archived: true }),
        ),
      );
      toast.success(`${articleIds.length} article(s) archived!`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to archive articles",
      );
    }
  };

  const handleAddTag = async () => {
    if (!selectedArticleId || selectedTags.length === 0) return;

    try {
      // Filter out tags that already exist on the article
      const existingTags = selectedArticle?.tags || [];
      const newTags = selectedTags.filter(
        (tag) =>
          !existingTags.some(
            (existingTag) => existingTag.toLowerCase() === tag.toLowerCase(),
          ),
      );

      if (newTags.length === 0) {
        toast.info("All selected tags are already on this article");
        return;
      }

      // Add only new tags
      await Promise.all(
        newTags.map((tag) => addTag({ articleId: selectedArticleId, tag })),
      );
      toast.success(
        `${newTags.length} tag${newTags.length > 1 ? "s" : ""} added!`,
      );
      setSelectedTags([]);
      setSelectedArticleId(null);
      setAddTagDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add tags");
    }
  };

  const handleRemoveTag = async (tag: string) => {
    if (!selectedArticleId) return;

    try {
      await removeTag({ articleId: selectedArticleId, tag });
      toast.success("Tag removed!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove tag");
    }
  };

  const handleToggleRead = async (
    articleId: Id<"articles">,
    isCurrentlyRead: boolean,
  ) => {
    try {
      if (isCurrentlyRead) {
        await updateArticle({ articleId, readAt: null });
        toast.success("Article marked as unread!");
      } else {
        await updateArticle({ articleId, readAt: Date.now() });
        toast.success("Article marked as read!");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update article",
      );
    }
  };

  const handleToggleArchive = async (
    articleId: Id<"articles">,
    isCurrentlyArchived: boolean,
  ) => {
    try {
      if (isCurrentlyArchived) {
        await updateArticle({ articleId, archived: false });
        toast.success("Article unarchived!");
      } else {
        await updateArticle({ articleId, archived: true });
        toast.success("Article archived!");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update article",
      );
    }
  };

  const handleToggleFavorite = async (
    articleId: Id<"articles">,
    isCurrentlyFavorited: boolean,
  ) => {
    try {
      if (isCurrentlyFavorited) {
        await updateArticle({ articleId, favorited: false });
        toast.success("Removed from favorites!");
      } else {
        await updateArticle({ articleId, favorited: true });
        toast.success("Added to favorites!");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update article",
      );
    }
  };

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleViewInBrowser = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Transform articles data to match the Article type
  const tableData: Article[] =
    articles?.map((article) => ({
      _id: article._id,
      title: article.title,
      url: article.url,
      excerpt: article.excerpt,
      author: article.author,
      savedAt: article.savedAt,
      readAt: article.readAt,
      archived: article.archived,
      favorited: article.favorited,
      readingTimeMinutes: article.readingTimeMinutes,
      tags: article.tags,
    })) ?? [];

  const columns = createColumns({
    onRead: (id) => router.push(`/articles/${id}`),
    onToggleRead: handleToggleRead,
    onToggleArchive: handleToggleArchive,
    onToggleFavorite: handleToggleFavorite,
    onCopyLink: handleCopyLink,
    onViewInBrowser: handleViewInBrowser,
    onDelete: (id) => setDeleteArticleId(id),
    onAddTag: (id) => {
      setSelectedArticleId(id);
      setAddTagDialogOpen(true);
    },
  });

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      {/* Articles DataTable */}
      <DataTable
        columns={columns}
        data={tableData}
        searchColumn="title"
        searchPlaceholder="Filter by title..."
        bulkActions={({ selectedRows, table }) => (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const ids = selectedRows.map((row: Article) => row._id);
                handleBulkMarkAsRead(ids);
                table.toggleAllPageRowsSelected(false);
              }}
            >
              Mark as Read
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const ids = selectedRows.map((row: Article) => row._id);
                handleBulkArchive(ids);
                table.toggleAllPageRowsSelected(false);
              }}
            >
              Archive
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                const ids = selectedRows.map((row: Article) => row._id);
                handleBulkDelete(ids);
                table.toggleAllPageRowsSelected(false);
              }}
            >
              Delete
            </Button>
          </>
        )}
      />

      {/* Tags Dialog */}
      <Dialog open={addTagDialogOpen} onOpenChange={setAddTagDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Tags</DialogTitle>
            <DialogDescription>
              Add or remove tags to organize this article.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Existing Tags */}
            {selectedArticle && selectedArticle.tags.length > 0 && (
              <div className="space-y-2">
                <Label>Current Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedArticle.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 rounded-full hover:bg-muted"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Add New Tags */}
            <div className="space-y-2">
              <Label htmlFor="new-tag">Add Tags</Label>
              <TagCombobox
                availableTags={allTags}
                selectedTags={selectedTags}
                onTagsChange={setSelectedTags}
                placeholder="Select or create tags..."
                emptyText="No tags found. Type to create new tags."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddTagDialogOpen(false);
                setSelectedTags([]);
                setSelectedArticleId(null);
              }}
            >
              Close
            </Button>
            <Button onClick={handleAddTag} disabled={selectedTags.length === 0}>
              Add Tag{selectedTags.length > 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteArticleId !== null}
        onOpenChange={(open) => !open && setDeleteArticleId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Article</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this article? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteArticleId(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteArticleId && handleDeleteArticle(deleteArticleId)
              }
              className={cn(buttonVariants({ variant: "destructive" }))}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Article Dialog */}
      <Dialog
        open={addArticleDialogOpen}
        onOpenChange={setAddArticleDialogOpen}
      >
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Add New Article</DialogTitle>
            <DialogDescription>
              Enter the URL of the article you want to save. We&apos;ll
              automatically fetch the title, content, and metadata.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveArticle} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="article-url">Article URL</Label>
              <Input
                id="article-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/article"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <TagCombobox
                availableTags={allTags}
                selectedTags={selectedTags}
                onTagsChange={setSelectedTags}
                placeholder="Select or create tags..."
                emptyText="No tags found. Type to create new tags."
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAddArticleDialogOpen(false);
                  setUrl("");
                  setSelectedTags([]);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !url}>
                {loading ? (
                  <>
                    <Spinner />
                    Saving...
                  </>
                ) : (
                  "Save Article"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
