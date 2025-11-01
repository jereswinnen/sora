"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TagCombobox } from "@/components/ui/tag-combobox";

interface Tag {
  _id: string;
  displayName: string;
  count: number;
}

interface ManageTagsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTags: string[];
  availableTags?: Tag[];
  onAddTags: (tags: string[]) => Promise<void>;
  onRemoveTag: (tag: string) => Promise<void>;
  contentType?: string;
}

export function ManageTagsDialog({
  open,
  onOpenChange,
  currentTags,
  availableTags,
  onAddTags,
  onRemoveTag,
  contentType = "item",
}: ManageTagsDialogProps) {
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);

  const handleAddTags = async () => {
    if (selectedTags.length === 0) return;

    try {
      await onAddTags(selectedTags);
      setSelectedTags([]);
      onOpenChange(false); // Close dialog on success
    } catch {
      // Don't close on error - let user retry
    }
  };

  const handleClose = () => {
    setSelectedTags([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Tags</DialogTitle>
          <DialogDescription>
            Add or remove tags to organize this {contentType}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Existing Tags */}
          {currentTags.length > 0 && (
            <div className="space-y-2">
              <Label>Current Tags</Label>
              <div className="flex flex-wrap gap-2">
                {currentTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => onRemoveTag(tag)}
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
              availableTags={availableTags}
              selectedTags={selectedTags}
              onTagsChange={setSelectedTags}
              placeholder="Select or create tags..."
              emptyText="No tags found. Type to create new tags."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
          <Button onClick={handleAddTags} disabled={selectedTags.length === 0}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
