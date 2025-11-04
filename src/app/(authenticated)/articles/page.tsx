"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useState, useEffect } from "react";
import { Id } from "../../../../convex/_generated/dataModel";
import { useHeaderAction } from "@/components/layout-header-context";
import { useArticleActions } from "@/hooks/use-article-actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
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
import { ManageTagsDialog } from "@/components/manage-tags-dialog";
import { TagCombobox } from "@/components/ui/tag-combobox";
import { Skeleton } from "@/components/ui/skeleton";

export default function ArticlesPage() {
  const router = useRouter();
  const { setHeaderAction } = useHeaderAction();

  const [url, setUrl] = useState("");
  const [addArticleTags, setAddArticleTags] = useState<string[]>([]);
  const [selectedArticleId, setSelectedArticleId] =
    useState<Id<"articles"> | null>(null);
  const [deleteArticleId, setDeleteArticleId] = useState<Id<"articles"> | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [addArticleError, setAddArticleError] = useState<string | null>(null);
  const [addTagDialogOpen, setAddTagDialogOpen] = useState(false);
  const [addArticleDialogOpen, setAddArticleDialogOpen] = useState(false);

  // Convex hooks - using optimized compact query for list view
  // listArticlesCompact excludes the large 'content' field for better performance
  const articles = useQuery(api.articles.listArticlesCompact, { limit: 100 });
  const allTags = useQuery(api.tags.getAllTags);
  const selectedArticle = useQuery(
    api.articles.getArticle,
    selectedArticleId ? { articleId: selectedArticleId } : "skip",
  );
  const saveArticle = useAction(api.articles.saveArticle);

  // Get shared article actions
  const {
    handleToggleFavorite,
    handleToggleArchive,
    handleToggleRead,
    handleDelete: handleDeleteAction,
    handleAddTags: handleAddTagsAction,
    handleRemoveTag: handleRemoveTagAction,
    handleCopyLink,
    handleViewInBrowser,
  } = useArticleActions();

  // Set header action for this page
  useEffect(() => {
    setHeaderAction({
      label: "Add Article",
      onClick: () => setAddArticleDialogOpen(true),
    });
    return () => setHeaderAction(null);
  }, [setHeaderAction]);

  // Keep updateArticle for bulk operations
  const updateArticle = useMutation(api.articles.updateArticle);
  const deleteArticle = useMutation(api.articles.deleteArticle);

  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAddArticleError(null); // Clear previous errors

    try {
      await saveArticle({ url, tags: addArticleTags });
      toast.success("Article saved successfully!");
      setUrl("");
      setAddArticleTags([]);
      setAddArticleError(null);
      setAddArticleDialogOpen(false);
    } catch (err) {
      // Extract clean error message from Convex error
      let errorMessage = "Failed to save article";
      if (err instanceof Error) {
        // Extract the actual error message from Convex's error format
        const match = err.message.match(/Uncaught Error: (.+?)(?:\n|$)/);
        const rawMessage = match ? match[1] : err.message;

        // Make error messages more user-friendly
        if (rawMessage.includes("Article already saved")) {
          errorMessage = "You've already saved this article.";
        } else {
          // Remove "Uncaught Error:" prefix if it's still there
          errorMessage = rawMessage.replace(/^Uncaught Error:\s*/i, "");
        }
      }
      setAddArticleError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteArticle = async (articleId: Id<"articles">) => {
    try {
      await handleDeleteAction(articleId);
      setDeleteArticleId(null);
    } catch {
      // Error already handled by hook
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

  const handleAddTags = async (tags: string[]) => {
    if (!selectedArticleId || tags.length === 0) return;
    await handleAddTagsAction(
      selectedArticleId,
      tags,
      selectedArticle?.tags || []
    );
  };

  const handleRemoveTag = async (tag: string) => {
    if (!selectedArticleId) return;
    await handleRemoveTagAction(selectedArticleId, tag);
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
      {articles === undefined ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-[250px]" />
            <Skeleton className="h-10 w-[70px]" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-[200px]" />
            <Skeleton className="h-8 w-[200px]" />
          </div>
        </div>
      ) : (
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
      )}

      {/* Manage Tags Dialog */}
      <ManageTagsDialog
        open={addTagDialogOpen}
        onOpenChange={setAddTagDialogOpen}
        currentTags={selectedArticle?.tags || []}
        availableTags={allTags}
        onAddTags={handleAddTags}
        onRemoveTag={handleRemoveTag}
        contentType="article"
      />

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
        onOpenChange={(open) => {
          setAddArticleDialogOpen(open);
          if (!open) {
            // Clear form and error when dialog closes
            setUrl("");
            setAddArticleTags([]);
            setAddArticleError(null);
          }
        }}
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
            {addArticleError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{addArticleError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="article-url">Article URL</Label>
              <Input
                id="article-url"
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  // Clear error when user starts typing
                  if (addArticleError) setAddArticleError(null);
                }}
                placeholder="https://example.com/article"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <TagCombobox
                availableTags={allTags}
                selectedTags={addArticleTags}
                onTagsChange={setAddArticleTags}
                placeholder="Select or create tags..."
                emptyText="No tags found. Type to create new tags."
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddArticleDialogOpen(false)}
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
