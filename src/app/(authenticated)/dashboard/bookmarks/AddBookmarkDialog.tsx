"use client";

import { useState } from "react";
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
  FieldSeparator,
  FieldSet,
} from "@/components/ui/field";
import { Kbd } from "@/components/ui/kbd";
import { AlertCircle, Globe } from "lucide-react";
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
  const [title, setTitle] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchMetadata = useAction(api.bookmarks.fetchBookmarkMetadata);
  const addBookmark = useMutation(api.bookmarks.addBookmark);

  const resetForm = () => {
    setUrl("");
    setTitle("");
    setFaviconUrl("");
    setError(null);
    setFetching(false);
    setSaving(false);
  };

  const handleFetchMetadata = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) {
      setError("Please enter a URL");
      return;
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      setError("Please enter a valid URL");
      return;
    }

    setFetching(true);
    setError(null);

    try {
      const metadata = await fetchMetadata({ url });
      setTitle(metadata.title);
      setFaviconUrl(metadata.faviconUrl || "");
      toast.success("Metadata fetched successfully");
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
  };

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
      await addBookmark({
        url,
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
            Enter a URL to automatically fetch the title and favicon.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          {/* URL Fetch Section */}
          <FieldSet>
            <form onSubmit={handleFetchMetadata}>
              <Field>
                <FieldLabel htmlFor="bookmark-url">URL *</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id="bookmark-url"
                    type="url"
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="https://example.com"
                    required
                  />
                  <Button
                    type="submit"
                    disabled={fetching || !url.trim()}
                    size="icon"
                  >
                    {fetching ? <Spinner /> : <Globe />}
                  </Button>
                </div>
              </Field>
            </form>
          </FieldSet>

          <FieldSeparator>Or enter manually</FieldSeparator>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Bookmark Details Form */}
          <form onSubmit={handleSaveBookmark}>
            <FieldGroup>
              <FieldSet>
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
                    <FieldLabel>Favicon Preview</FieldLabel>
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
                <Button type="submit" disabled={saving || !title.trim()}>
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
        </FieldGroup>
      </DialogContent>
    </Dialog>
  );
}
