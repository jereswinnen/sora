"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { Authenticated, Unauthenticated, useConvexAuth } from "convex/react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useEffect } from "react";
import { Id } from "../../../convex/_generated/dataModel";

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
        <div className="text-center">
          <p className="text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  // Show redirecting message if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
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
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Convex hooks
  const articles = useQuery(api.articles.listArticles, { limit: 50 });
  const saveArticle = useAction(api.articles.saveArticle);
  const deleteArticle = useMutation(api.articles.deleteArticle);
  const addTag = useMutation(api.articles.addTag);
  const updateArticle = useMutation(api.articles.updateArticle);

  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const tagArray = tags ? tags.split(",").map((t) => t.trim()) : [];
      await saveArticle({ url, tags: tagArray });
      setSuccess("Article saved successfully!");
      setUrl("");
      setTags("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save article");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteArticle = async (articleId: Id<"articles">) => {
    if (!confirm("Are you sure you want to delete this article?")) return;

    try {
      await deleteArticle({ articleId });
      setSuccess("Article deleted!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete article");
    }
  };

  const handleAddTag = async () => {
    if (!selectedArticleId || !newTag) return;

    try {
      await addTag({ articleId: selectedArticleId, tag: newTag });
      setSuccess("Tag added!");
      setNewTag("");
      setSelectedArticleId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add tag");
    }
  };

  const handleMarkAsRead = async (articleId: Id<"articles">) => {
    try {
      await updateArticle({ articleId, readAt: Date.now() });
      setSuccess("Article marked as read!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update article");
    }
  };

  const handleArchive = async (articleId: Id<"articles">) => {
    try {
      await updateArticle({ articleId, archived: true });
      setSuccess("Article archived!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive article");
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
          <button
            onClick={handleSignOut}
            className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded"
          >
            Sign Out
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded">
            {success}
          </div>
        )}

        {/* Save Article Form */}
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-xl font-semibold mb-4">Save New Article</h2>
          <form onSubmit={handleSaveArticle} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Article URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/article"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="tech, news, important"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Article"}
            </button>
          </form>
        </div>

        {/* Articles List */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Saved Articles ({articles?.length || 0})</h2>

          {articles === undefined ? (
            <p className="text-gray-500">Loading...</p>
          ) : articles.length === 0 ? (
            <p className="text-gray-500">No articles saved yet. Add one above!</p>
          ) : (
            <div className="space-y-4">
              {articles.map((article) => (
                <div key={article._id} className="border border-gray-200 rounded p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{article.title}</h3>
                      <p className="text-sm text-gray-600 mb-2">{article.url}</p>
                      <p className="text-sm text-gray-700 line-clamp-2">{article.excerpt}</p>
                      {article.author && (
                        <p className="text-xs text-gray-500 mt-1">By {article.author}</p>
                      )}
                    </div>
                  </div>

                  {/* Tags */}
                  {article.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {article.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Status */}
                  <div className="flex gap-2 mb-3 text-xs text-gray-600">
                    <span>Saved: {new Date(article.savedAt).toLocaleDateString()}</span>
                    {article.readAt && <span>• Read: {new Date(article.readAt).toLocaleDateString()}</span>}
                    {article.archived && <span>• Archived</span>}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => router.push(`/article/${article._id}`)}
                      className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded"
                    >
                      Read
                    </button>
                    <button
                      onClick={() => setSelectedArticleId(article._id)}
                      className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                    >
                      Add Tag
                    </button>
                    <button
                      onClick={() => handleMarkAsRead(article._id)}
                      className="px-3 py-1 text-sm bg-green-100 hover:bg-green-200 text-green-700 rounded"
                    >
                      Mark Read
                    </button>
                    <button
                      onClick={() => handleArchive(article._id)}
                      className="px-3 py-1 text-sm bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded"
                    >
                      Archive
                    </button>
                    <button
                      onClick={() => handleDeleteArticle(article._id)}
                      className="px-3 py-1 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded"
                    >
                      Delete
                    </button>
                  </div>

                  {/* Add Tag Input */}
                  {selectedArticleId === article._id && (
                    <div className="mt-3 flex gap-2">
                      <input
                        type="text"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        placeholder="New tag name"
                        className="flex-1 px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={handleAddTag}
                        className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => {
                          setSelectedArticleId(null);
                          setNewTag("");
                        }}
                        className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
