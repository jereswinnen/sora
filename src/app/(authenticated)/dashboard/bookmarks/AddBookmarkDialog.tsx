"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import { Kbd } from "@/components/ui/kbd";
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { BookmarkMetadata } from "./types";

interface AddBookmarkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AddBookmarkDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddBookmarkDialogProps) {
  const [url, setUrl] = useState("");
  const [normalizedUrl, setNormalizedUrl] = useState("");
  const [title, setTitle] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchMetadata = useAction(api.bookmarks.fetchBookmarkMetadata);
  const addBookmark = useMutation(api.bookmarks.addBookmark);

  const resetForm = () => {
    setUrl("");
    setNormalizedUrl("");
    setTitle("");
    setFaviconUrl("");
    setError(null);
    setFetching(false);
    setSaving(false);
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }
  };

  // Auto-fetch metadata when URL changes (with debounce)
  useEffect(() => {
    // Clear any existing timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    // Don't fetch if URL is empty
    if (!url.trim()) {
      setTitle("");
      setFaviconUrl("");
      setNormalizedUrl("");
      return;
    }

    // Debounce: wait 800ms after user stops typing
    fetchTimeoutRef.current = setTimeout(async () => {
      setFetching(true);
      setError(null);

      try {
        const metadata = await fetchMetadata({ url: url.trim() });
        setTitle(metadata.title);
        setFaviconUrl(metadata.faviconUrl || "");
        setNormalizedUrl(metadata.normalizedUrl);
      } catch (err) {
        console.error("Failed to fetch metadata:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to fetch metadata. You can enter the title manually."
        );
      } finally {
        setFetching(false);
      }
    }, 800);

    // Cleanup on unmount or when URL changes
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [url, fetchMetadata]);

  const handleSaveBookmark = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) {
      setError("Please enter a URL");
      return;
    }

    if (!title.trim()) {
      setError("Please enter a title");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Use normalized URL from backend if available, otherwise use the input URL
      await addBookmark({
        url: normalizedUrl || url,
        title,
        faviconUrl: faviconUrl || undefined,
        tags: [],
        favorited: false,
      });

      toast.success("Bookmark added successfully");
      onOpenChange(false);
      resetForm();
      onSuccess?.();
    } catch (err) {
      console.error("Failed to add bookmark:", err);
      setError(
        err instanceof Error ? err.message : "Failed to add bookmark"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
          resetForm();
        }
      }}
    >
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Bookmark</DialogTitle>
          <DialogDescription>
            Enter a URL and we'll automatically fetch the title and favicon.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSaveBookmark}>
          <FieldGroup>
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <FieldSet>
              <Field>
                <FieldLabel htmlFor="bookmark-url">URL *</FieldLabel>
                <div className="relative">
                  <Input
                    id="bookmark-url"
                    type="text"
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="example.com or https://example.com"
                    required
                  />
                  {fetching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
              </Field>

              <Field>
                <FieldLabel htmlFor="bookmark-title">Title *</FieldLabel>
                <Input
                  id="bookmark-title"
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="My Favorite Website"
                  required
                />
              </Field>

              {faviconUrl && (
                <Field>
                  <FieldLabel>Preview</FieldLabel>
                  <div className="flex items-center gap-2 p-2 border rounded">
                    <img
                      src={faviconUrl}
                      alt="Favicon"
                      className="w-6 h-6 object-contain"
                      onError={() => setFaviconUrl("")}
                    />
                    <span className="text-sm text-muted-foreground">
                      {title || "Bookmark"}
                    </span>
                  </div>
                </Field>
              )}
            </FieldSet>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel <Kbd>Esc</Kbd>
              </Button>
              <Button type="submit" disabled={saving || fetching || !title.trim()}>
                {saving ? (
                  <>
                    <Spinner />
                    Saving...
                  </>
                ) : (
                  <>
                    Save Bookmark <Kbd>⏎</Kbd>
                  </>
                )}
              </Button>
            </DialogFooter>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
