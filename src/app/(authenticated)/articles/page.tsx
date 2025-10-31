"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useState } from "react";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
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

export default function ArticlesPage() {
  const router = useRouter();

  const [url, setUrl] = useState("");
  const [tags, setTags] = useState("");
  const [newTag, setNewTag] = useState("");
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
  const saveArticle = useAction(api.articles.saveArticle);
  const deleteArticle = useMutation(api.articles.deleteArticle);
  const addTag = useMutation(api.articles.addTag);
  const updateArticle = useMutation(api.articles.updateArticle);

  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const tagArray = tags ? tags.split(",").map((t) => t.trim()) : [];
      await saveArticle({ url, tags: tagArray });
      toast.success("Article saved successfully!");
      setUrl("");
      setTags("");
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
    if (!selectedArticleId || !newTag) return;

    try {
      await addTag({ articleId: selectedArticleId, tag: newTag });
      toast.success("Tag added!");
      setNewTag("");
      setSelectedArticleId(null);
      setAddTagDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add tag");
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
      {/* Header */}
      <div className="flex justify-between items-center">
        <Button onClick={() => setAddArticleDialogOpen(true)}>
          Add Article
        </Button>
      </div>

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

      {/* Add Tag Dialog */}
      <Dialog open={addTagDialogOpen} onOpenChange={setAddTagDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Tag</DialogTitle>
            <DialogDescription>
              Add a tag to this article for better organization.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-tag">Tag Name</Label>
              <Input
                id="new-tag"
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Enter tag name"
                list="tag-suggestions-add"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
              />
              <datalist id="tag-suggestions-add">
                {allTags?.map((tag) => (
                  <option key={tag._id} value={tag.displayName}>
                    {tag.displayName} ({tag.count})
                  </option>
                ))}
              </datalist>
              {allTags && allTags.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Suggestions:{" "}
                  {allTags.slice(0, 5).map((tag, idx) => (
                    <span key={tag._id}>
                      {idx > 0 && ", "}
                      {tag.displayName}
                    </span>
                  ))}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddTagDialogOpen(false);
                setNewTag("");
                setSelectedArticleId(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAddTag} disabled={!newTag}>
              Add Tag
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
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="tech, news, important"
                list="tag-suggestions-dialog"
              />
              <datalist id="tag-suggestions-dialog">
                {allTags?.map((tag) => (
                  <option key={tag._id} value={tag.displayName}>
                    {tag.displayName} ({tag.count})
                  </option>
                ))}
              </datalist>
              {allTags && allTags.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Suggestions:{" "}
                  {allTags.slice(0, 5).map((tag, idx) => (
                    <span key={tag._id}>
                      {idx > 0 && ", "}
                      {tag.displayName}
                    </span>
                  ))}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setAddArticleDialogOpen(false);
                  setUrl("");
                  setTags("");
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
