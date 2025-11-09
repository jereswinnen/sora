"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { use, useEffect, useState, useRef } from "react";
import { useHeaderAction } from "@/components/layout-header-context";
import { useArticleActions } from "@/hooks/use-article-actions";
import { TextHighlighter } from "@funktechno/texthighlighter/lib";
import { Button, buttonVariants } from "@/components/ui/button";
import { AppearancePopover, type AppearanceSettings } from "@/components/appearance-popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
  StarIcon,
  ArchiveIcon,
  MoreHorizontalIcon,
  TagIcon,
  Trash2Icon,
  CompassIcon,
  ClipboardCopyIcon,
} from "lucide-react";
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

  // Ref for article content to enable text highlighting
  const articleContentRef = useRef<HTMLDivElement>(null);

  // Appearance settings state - initialized from database or defaults
  const [appearanceSettings, setAppearanceSettings] = useState<AppearanceSettings>({
    theme: "sans",
    titleSize: 32,
    titleLeading: 1.3,
    titleAlignment: "left",
    bodySize: 18,
    bodyLeading: 1.8,
    margins: "normal",
    justifyText: false,
  });

  const article = useQuery(api.articles.getArticle, {
    articleId: id as Id<"articles">,
  });
  const allTags = useQuery(api.tags.getAllTags, {});
  const userPreferences = useQuery(api.userPreferences.get);
  const updatePreferences = useMutation(api.userPreferences.updateArticleAppearance);

  // Load user preferences from database when available
  useEffect(() => {
    if (userPreferences) {
      setAppearanceSettings({
        theme: userPreferences.articleTheme ?? "sans",
        titleSize: userPreferences.articleTitleSize ?? 32,
        titleLeading: userPreferences.articleTitleLeading ?? 1.3,
        titleAlignment: userPreferences.articleTitleAlignment ?? "left",
        bodySize: userPreferences.articleBodySize ?? 18,
        bodyLeading: userPreferences.articleBodyLeading ?? 1.8,
        margins: userPreferences.articleMargins ?? "normal",
        justifyText: userPreferences.articleJustifyText ?? false,
      });
    }
  }, [userPreferences]);

  // Initialize text highlighter
  useEffect(() => {
    if (!articleContentRef.current || !article) return;

    const highlighter = new TextHighlighter(articleContentRef.current, {
      color: "#fbbf2480", // Amber/yellow with transparency
    });

    const handleMouseUp = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim().length > 0) {
        highlighter.doHighlight();
      }
    };

    // Handle click on highlighted text to remove it
    const handleHighlightClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains("highlighted")) {
        highlighter.removeHighlights(target);
      }
    };

    const contentElement = articleContentRef.current;
    contentElement.addEventListener("mouseup", handleMouseUp);
    contentElement.addEventListener("click", handleHighlightClick);

    return () => {
      contentElement.removeEventListener("mouseup", handleMouseUp);
      contentElement.removeEventListener("click", handleHighlightClick);
      highlighter.destroy();
    };
  }, [article]);

  const {
    handleToggleFavorite: toggleFavorite,
    handleToggleArchive: toggleArchive,
    handleDelete: deleteArticleAction,
    handleAddTags: addTagsAction,
    handleRemoveTag: removeTagAction,
    handleCopyLink,
    handleViewInBrowser,
  } = useArticleActions();

  // Set header action with article controls
  useEffect(() => {
    if (!article) {
      setHeaderAction(null);
      return;
    }

    const articleId = id as Id<"articles">;
    const isFavorited = article.favorited || false;
    const isArchived = article.archived || false;
    const articleUrl = article.url;
    const hasTags = article.tags.length > 0;

    setHeaderAction({
      component: (
        <div className="flex items-center gap-2">
          <ToggleGroup
            type="multiple"
            variant="outline"
            spacing={0}
            size="sm"
            value={[
              isFavorited ? "favorite" : "",
              isArchived ? "archive" : "",
            ].filter(Boolean)}
          >
            <ToggleGroupItem
              value="favorite"
              aria-label="Toggle favorite"
              onClick={() => toggleFavorite(articleId, isFavorited)}
              className={cn(
                "data-[state=on]:bg-transparent data-[state=on]:*:[svg]:fill-yellow-500 data-[state=on]:*:[svg]:stroke-yellow-500",
              )}
            >
              <StarIcon />
              Favorite
            </ToggleGroupItem>
            <ToggleGroupItem
              value="archive"
              aria-label="Toggle archive"
              onClick={() => toggleArchive(articleId, isArchived)}
              className={cn(
                "data-[state=on]:bg-transparent data-[state=on]:*:[svg]:fill-blue-500 data-[state=on]:*:[svg]:stroke-blue-500",
              )}
            >
              <ArchiveIcon />
              Archive
            </ToggleGroupItem>
          </ToggleGroup>
          <AppearancePopover
            settings={appearanceSettings}
            onSettingsChange={handleAppearanceChange}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="More Options">
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => handleCopyLink(articleUrl)}>
                  <ClipboardCopyIcon />
                  Copy Link
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleViewInBrowser(articleUrl)}
                >
                  <CompassIcon />
                  View Original
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => setTagsDialogOpen(true)}>
                  <TagIcon />
                  {hasTags ? "Edit Tags" : "Add Tags"}
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
        </div>
      ),
    });

    return () => setHeaderAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    id,
    article?.favorited,
    article?.archived,
    article?.url,
    article?.tags?.length,
    appearanceSettings,
  ]);

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

  // Save appearance settings to database
  const handleAppearanceChange = async (newSettings: AppearanceSettings) => {
    setAppearanceSettings(newSettings);

    // Save to database
    await updatePreferences({
      articleTheme: newSettings.theme,
      articleTitleSize: newSettings.titleSize,
      articleTitleLeading: newSettings.titleLeading,
      articleTitleAlignment: newSettings.titleAlignment,
      articleBodySize: newSettings.bodySize,
      articleBodyLeading: newSettings.bodyLeading,
      articleMargins: newSettings.margins,
      articleJustifyText: newSettings.justifyText,
    });
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

  // Apply margin class based on settings
  const marginClass =
    appearanceSettings.margins === "narrow"
      ? "max-w-3xl"
      : appearanceSettings.margins === "wide"
      ? "max-w-5xl"
      : "max-w-4xl";

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      {/* Article Content */}
      <article
        className={`article-content mx-auto w-full ${marginClass}`}
        data-articletheme={appearanceSettings.theme}
        style={
          {
            "--article-title-size": `${appearanceSettings.titleSize}px`,
            "--article-title-line-height": appearanceSettings.titleLeading,
            "--article-title-align": appearanceSettings.titleAlignment,
            "--article-font-size": `${appearanceSettings.bodySize}px`,
            "--article-line-height": appearanceSettings.bodyLeading,
          } as React.CSSProperties
        }
      >
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
        <h1 className="article-title">{article.title}</h1>

        {/* Metadata */}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-8 pb-8 border-b">
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

        {/* Article Body */}
        <div className="prose prose-lg max-w-none">
          <div
            ref={articleContentRef}
            dangerouslySetInnerHTML={{ __html: article.content }}
            className={`article-body ${appearanceSettings.justifyText ? "text-justify" : ""}`}
          />
        </div>
      </article>

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
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Article</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this article? This action cannot
              be undone.
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
