"use client";

import { useCallback } from "react";
import { Masonry } from "masonic";
import { useWindowSize } from "@react-hook/window-size";
import { ImageIcon, Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Id } from "../../convex/_generated/dataModel";

export interface MasonryGridItem {
  _id: Id<"inspirations">;
  title?: string;
  tags: string[];
  favorited?: boolean;
  imageUrl: string | null;
}

interface MasonryGridProps<T extends MasonryGridItem> {
  items: T[];
  onItemClick: (item: T) => void;
}

// Responsive column count: 1 mobile, 4 tablet, 6 desktop
function getColumnCount(width: number): number {
  if (width < 640) return 1;
  if (width < 1024) return 4;
  return 6;
}

interface MasonryCardProps<T extends MasonryGridItem> {
  data: T;
  width: number;
  index: number;
  onItemClick: (item: T) => void;
}

function MasonryCard<T extends MasonryGridItem>({
  data,
  onItemClick,
}: MasonryCardProps<T>) {
  return (
    <div
      className="cursor-pointer group relative"
      onClick={() => onItemClick(data)}
    >
      <div className="relative overflow-hidden rounded-lg border bg-muted">
        {data.imageUrl ? (
          <img
            src={data.imageUrl}
            alt={data.title || "Inspiration"}
            className="w-full h-auto object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="aspect-square flex items-center justify-center">
            <ImageIcon className="size-8 text-muted-foreground" />
          </div>
        )}
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
          <div className="w-full">
            {data.title && (
              <p className="text-white text-sm font-medium line-clamp-2">
                {data.title}
              </p>
            )}
            {data.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {data.tags.slice(0, 3).map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="text-xs bg-white/20 text-white border-0"
                  >
                    {tag}
                  </Badge>
                ))}
                {data.tags.length > 3 && (
                  <Badge
                    variant="secondary"
                    className="text-xs bg-white/20 text-white border-0"
                  >
                    +{data.tags.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
        {/* Favorite indicator */}
        {data.favorited && (
          <div className="absolute top-2 right-2">
            <Heart className="size-4 text-red-500 fill-red-500" />
          </div>
        )}
      </div>
    </div>
  );
}

export function MasonryGrid<T extends MasonryGridItem>({
  items,
  onItemClick,
}: MasonryGridProps<T>) {
  const [windowWidth] = useWindowSize();
  const columnCount = getColumnCount(windowWidth);

  const render = useCallback(
    ({ data, width, index }: { data: T; width: number; index: number }) => (
      <MasonryCard
        data={data}
        width={width}
        index={index}
        onItemClick={onItemClick}
      />
    ),
    [onItemClick]
  );

  return (
    <Masonry
      items={items}
      columnCount={columnCount}
      columnGutter={16}
      render={render}
      itemKey={(data) => data._id}
    />
  );
}
