"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

interface Tag {
  _id: string;
  displayName: string;
  count: number;
}

interface TagComboboxProps {
  availableTags?: Tag[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  emptyText?: string;
}

export function TagCombobox({
  availableTags = [],
  selectedTags,
  onTagsChange,
  placeholder = "Select tags...",
  emptyText = "No tags found.",
}: TagComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  const handleSelectTag = (tagName: string) => {
    const normalizedTag = tagName.trim();
    if (!normalizedTag) return;

    if (selectedTags.includes(normalizedTag)) {
      // Remove tag if already selected
      onTagsChange(selectedTags.filter((t) => t !== normalizedTag));
    } else {
      // Add tag
      onTagsChange([...selectedTags, normalizedTag]);
    }
    setInputValue("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onTagsChange(selectedTags.filter((t) => t !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      handleSelectTag(inputValue);
    }
  };

  // Filter available tags based on input and exclude already selected
  const filteredTags = availableTags.filter(
    (tag) =>
      tag.displayName.toLowerCase().includes(inputValue.toLowerCase()) &&
      !selectedTags.includes(tag.displayName)
  );

  // Check if input value is a new tag (not in available tags)
  const isNewTag =
    inputValue.trim() &&
    !availableTags.some(
      (tag) => tag.displayName.toLowerCase() === inputValue.toLowerCase()
    ) &&
    !selectedTags.includes(inputValue.trim());

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            <span className="truncate">
              {selectedTags.length > 0
                ? `${selectedTags.length} tag${selectedTags.length > 1 ? "s" : ""} selected`
                : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search or create tag..."
              value={inputValue}
              onValueChange={setInputValue}
              onKeyDown={handleKeyDown}
            />
            <CommandList>
              <CommandEmpty>
                {inputValue.trim() ? (
                  <div className="py-2 text-center text-sm">
                    Press <kbd className="px-1 text-xs bg-muted rounded">Enter</kbd> to
                    create &quot;{inputValue.trim()}&quot;
                  </div>
                ) : (
                  emptyText
                )}
              </CommandEmpty>
              {isNewTag && (
                <CommandGroup heading="Create new">
                  <CommandItem
                    value={inputValue}
                    onSelect={() => handleSelectTag(inputValue)}
                  >
                    <Check className="mr-2 h-4 w-4 opacity-0" />
                    Create &quot;{inputValue.trim()}&quot;
                  </CommandItem>
                </CommandGroup>
              )}
              {filteredTags.length > 0 && (
                <CommandGroup heading="Available tags">
                  {filteredTags.map((tag) => (
                    <CommandItem
                      key={tag._id}
                      value={tag.displayName}
                      onSelect={handleSelectTag}
                    >
                      <Check className="mr-2 h-4 w-4 opacity-0" />
                      {tag.displayName}
                      <span className="ml-auto text-xs text-muted-foreground">
                        ({tag.count})
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected Tags Display */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map((tag) => (
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
      )}
    </div>
  );
}
