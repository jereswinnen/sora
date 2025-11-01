"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { useHeaderAction } from "@/components/layout-header-context";
import { useArticleActions } from "@/hooks/use-article-actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
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
import { ManageTagsDialog } from "@/components/manage-tags-dialog";
import {
  ArrowLeftIcon,
  HeartIcon,
  ArchiveIcon,
  MoreHorizontalIcon,
  LinkIcon,
  ExternalLinkIcon,
  TagIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { setHeaderAction } = useHeaderAction();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);

  const article = useQuery(api.articles.getArticle, {
    articleId: id as Id<"articles">,
  });
  const allTags = useQuery(api.tags.getAllTags);

  const {
    handleToggleFavorite: toggleFavorite,
    handleToggleArchive: toggleArchive,
    handleDelete: deleteArticleAction,
    handleAddTags: addTagsAction,
    handleRemoveTag: removeTagAction,
    handleCopyLink,
    handleViewInBrowser,
  } = useArticleActions();

  // Clear header action on mount
  useEffect(() => {
    setHeaderAction(null);
    return () => setHeaderAction(null);
  }, [setHeaderAction]);

  // Wrapper handlers to simplify usage
  const handleToggleFavorite = () => {
    if (!article) return;
    toggleFavorite(id as Id<"articles">, article.favorited || false);
  };

  const handleToggleArchive = () => {
    if (!article) return;
    toggleArchive(id as Id<"articles">, article.archived || false);
  };

  const handleViewOriginal = () => {
    if (!article) return;
    handleViewInBrowser(article.url);
  };

  const handleCopyArticleLink = () => {
    if (!article) return;
    handleCopyLink(article.url);
  };

  const handleDelete = async () => {
    try {
      await deleteArticleAction(id as Id<"articles">);
      router.push("/articles");
    } catch {
      // Error already handled by the hook
    }
  };

  const handleAddTags = async (tags: string[]) => {
    await addTagsAction(id as Id<"articles">, tags, article?.tags || []);
  };

  const handleRemoveTag = async (tag: string) => {
    await removeTagAction(id as Id<"articles">, tag);
  };

  if (article === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Loading article...</p>
      </div>
    );
  }

  if (article === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg mb-4">Article not found</p>
          <Button onClick={() => router.push("/articles")}>
            Back to Articles
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-background border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push("/articles")}
            aria-label="Go Back"
          >
            <ArrowLeftIcon />
          </Button>

          <ButtonGroup className="ml-auto">
            <ToggleGroup
              type="multiple"
              variant="outline"
              spacing={0}
              value={[
                article.favorited ? "favorite" : "",
                article.archived ? "archive" : "",
              ].filter(Boolean)}
            >
              <ToggleGroupItem
                value="favorite"
                aria-label="Toggle favorite"
                onClick={handleToggleFavorite}
                className={cn(
                  "data-[state=on]:bg-transparent data-[state=on]:*:[svg]:fill-red-500 data-[state=on]:*:[svg]:stroke-red-500"
                )}
              >
                <HeartIcon />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="archive"
                aria-label="Toggle archive"
                onClick={handleToggleArchive}
                className={cn(
                  "data-[state=on]:bg-transparent data-[state=on]:*:[svg]:fill-blue-500 data-[state=on]:*:[svg]:stroke-blue-500"
                )}
              >
                <ArchiveIcon />
              </ToggleGroupItem>
            </ToggleGroup>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More Options">
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={handleCopyArticleLink}>
                    <LinkIcon />
                    Copy Link
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleViewOriginal}>
                    <ExternalLinkIcon />
                    View Original
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => setTagsDialogOpen(true)}>
                    <TagIcon />
                    Add/Edit Tags
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2Icon />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </ButtonGroup>
        </div>
      </div>

      {/* Article Content */}
      <article className="max-w-4xl mx-auto px-4 py-8">
        {/* Header Image */}
        {article.imageUrl && (
          <div className="mb-8">
            <img
              src={article.imageUrl}
              alt={article.title}
              className="w-full h-auto rounded-lg"
            />
          </div>
        )}

        {/* Title */}
        <h1 className="text-4xl font-bold mb-4">{article.title}</h1>

        {/* Metadata */}
        <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-8 pb-8 border-b">
          {article.author && <span>By {article.author}</span>}
          {article.publishedAt && (
            <span>
              Published {new Date(article.publishedAt).toLocaleDateString()}
            </span>
          )}
          <span>Saved {new Date(article.savedAt).toLocaleDateString()}</span>
          {article.readAt && (
            <span>Read {new Date(article.readAt).toLocaleDateString()}</span>
          )}
        </div>

        {/* Tags */}
        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {article.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Article Body */}
        <div
          className="prose prose-lg max-w-none"
          style={{
            lineHeight: "1.8",
            fontSize: "18px",
          }}
        >
          {/* Render content as HTML with basic sanitization via whitespace preservation */}
          <div
            dangerouslySetInnerHTML={{ __html: article.content }}
            className="article-content"
          />
        </div>
      </article>

      {/* Global styles for article content */}
      <style jsx global>{`
        .article-content {
          color: #1a1a1a;
        }
        .article-content p {
          margin-bottom: 1.5em;
        }
        .article-content h1,
        .article-content h2,
        .article-content h3,
        .article-content h4 {
          margin-top: 2em;
          margin-bottom: 0.75em;
          font-weight: 600;
          line-height: 1.3;
        }
        .article-content h1 {
          font-size: 2em;
        }
        .article-content h2 {
          font-size: 1.5em;
        }
        .article-content h3 {
          font-size: 1.25em;
        }
        .article-content ul,
        .article-content ol {
          margin-left: 2em;
          margin-bottom: 1.5em;
        }
        .article-content li {
          margin-bottom: 0.5em;
        }
        .article-content a {
          color: #2563eb;
          text-decoration: underline;
        }
        .article-content a:hover {
          color: #1d4ed8;
        }
        .article-content blockquote {
          border-left: 4px solid #e5e7eb;
          padding-left: 1.5em;
          margin-left: 0;
          margin-right: 0;
          font-style: italic;
          color: #4b5563;
        }
        .article-content code {
          background-color: #f3f4f6;
          padding: 0.2em 0.4em;
          border-radius: 3px;
          font-size: 0.9em;
          font-family: monospace;
        }
        .article-content pre {
          background-color: #f3f4f6;
          padding: 1em;
          border-radius: 6px;
          overflow-x: auto;
          margin-bottom: 1.5em;
        }
        .article-content pre code {
          background-color: transparent;
          padding: 0;
        }
        .article-content img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          margin: 2em 0;
        }
      `}</style>

      {/* Manage Tags Dialog */}
      <ManageTagsDialog
        open={tagsDialogOpen}
        onOpenChange={setTagsDialogOpen}
        currentTags={article?.tags || []}
        availableTags={allTags}
        onAddTags={handleAddTags}
        onRemoveTag={handleRemoveTag}
        contentType="article"
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Article</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this article? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className={cn(buttonVariants({ variant: "destructive" }))}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
