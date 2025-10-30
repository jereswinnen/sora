"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useEffect } from "react";
import { Id } from "../../../convex/_generated/dataModel";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { X } from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function DashboardPage() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useConvexAuth();

  // Redirect to auth if not authenticated (after render)
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/auth");
    }
  }, [isLoading, isAuthenticated, router]);

  // Show loading state while auth is being determined
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Spinner className="size-8" />
          <p className="text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  // Show redirecting message if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Spinner className="size-8" />
          <p className="text-lg">Redirecting to sign in...</p>
        </div>
      </div>
    );
  }

  return <Dashboard />;
}

function Dashboard() {
  const { signOut } = useAuthActions();
  const router = useRouter();

  const [url, setUrl] = useState("");
  const [tags, setTags] = useState("");
  const [newTag, setNewTag] = useState("");
  const [selectedArticleId, setSelectedArticleId] = useState<Id<"articles"> | null>(null);
  const [loading, setLoading] = useState(false);

  // Convex hooks
  const articles = useQuery(api.articles.listArticles, { limit: 50 });
  const allTags = useQuery(api.tags.getAllTags);
  const saveArticle = useAction(api.articles.saveArticle);
  const deleteArticle = useMutation(api.articles.deleteArticle);
  const addTag = useMutation(api.articles.addTag);
  const removeTag = useMutation(api.articles.removeTag);
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save article");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteArticle = async (articleId: Id<"articles">) => {
    try {
      await deleteArticle({ articleId });
      toast.success("Article deleted!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete article");
    }
  };

  const handleAddTag = async () => {
    if (!selectedArticleId || !newTag) return;

    try {
      await addTag({ articleId: selectedArticleId, tag: newTag });
      toast.success("Tag added!");
      setNewTag("");
      setSelectedArticleId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add tag");
    }
  };

  const handleMarkAsRead = async (articleId: Id<"articles">) => {
    try {
      await updateArticle({ articleId, readAt: Date.now() });
      toast.success("Article marked as read!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update article");
    }
  };

  const handleArchive = async (articleId: Id<"articles">) => {
    try {
      await updateArticle({ articleId, archived: true });
      toast.success("Article archived!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to archive article");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/auth");
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Sora Dashboard</h1>
          <Button variant="outline" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>

        {/* Save Article Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Save New Article</CardTitle>
          </CardHeader>
          <CardContent>
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
                  list="tag-suggestions"
                />
                <datalist id="tag-suggestions">
                  {allTags?.map((tag) => (
                    <option key={tag._id} value={tag.displayName}>
                      {tag.displayName} ({tag.count})
                    </option>
                  ))}
                </datalist>
                {allTags && allTags.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Existing tags:</span>{" "}
                    {allTags.slice(0, 10).map((tag, idx) => (
                      <span key={tag._id}>
                        {idx > 0 && ", "}
                        {tag.displayName} ({tag.count})
                      </span>
                    ))}
                    {allTags.length > 10 && "..."}
                  </p>
                )}
              </div>
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
            </form>
          </CardContent>
        </Card>

        {/* Articles List */}
        <Card>
          <CardHeader>
            <CardTitle>Saved Articles ({articles?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {articles === undefined ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Spinner />
                <p>Loading...</p>
              </div>
            ) : articles.length === 0 ? (
              <p className="text-muted-foreground">No articles saved yet. Add one above!</p>
            ) : (
            <div className="space-y-4">
              {articles.map((article) => (
                <div key={article._id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{article.title}</h3>
                      <p className="text-sm text-muted-foreground mb-2">{article.url}</p>
                      <p className="text-sm line-clamp-2">{article.excerpt}</p>
                      {article.author && (
                        <p className="text-xs text-muted-foreground mt-1">By {article.author}</p>
                      )}
                    </div>
                  </div>

                  {/* Tags */}
                  {article.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {article.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="gap-1">
                          {tag}
                          <button
                            onClick={async () => {
                              try {
                                await removeTag({ articleId: article._id, tag });
                                toast.success("Tag removed!");
                              } catch (err) {
                                toast.error(err instanceof Error ? err.message : "Failed to remove tag");
                              }
                            }}
                            className="hover:bg-secondary-foreground/20 rounded-full"
                            title="Remove tag"
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Status */}
                  <div className="flex gap-2 mb-3 text-xs text-muted-foreground">
                    <span>Saved: {new Date(article.savedAt).toLocaleDateString()}</span>
                    {article.readAt && <span>• Read: {new Date(article.readAt).toLocaleDateString()}</span>}
                    {article.archived && <span>• Archived</span>}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => router.push(`/article/${article._id}`)}
                    >
                      Read
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedArticleId(article._id)}
                    >
                      Add Tag
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMarkAsRead(article._id)}
                    >
                      Mark Read
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleArchive(article._id)}
                    >
                      Archive
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive">
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Article</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this article? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteArticle(article._id)}
                            className={cn(buttonVariants({ variant: "destructive" }))}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  {/* Add Tag Input */}
                  {selectedArticleId === article._id && (
                    <div className="mt-3">
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          placeholder="New tag name"
                          list="tag-suggestions-add"
                          className="flex-1"
                        />
                        <datalist id="tag-suggestions-add">
                          {allTags?.map((tag) => (
                            <option key={tag._id} value={tag.displayName}>
                              {tag.displayName} ({tag.count})
                            </option>
                          ))}
                        </datalist>
                        <Button size="sm" onClick={handleAddTag}>
                          Add
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedArticleId(null);
                            setNewTag("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                      {allTags && allTags.length > 0 && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Suggestions: {allTags.slice(0, 5).map((tag, idx) => (
                            <span key={tag._id}>
                              {idx > 0 && ", "}
                              {tag.displayName}
                            </span>
                          ))}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
