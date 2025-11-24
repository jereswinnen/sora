"use client";

import { useRef, useEffect } from "react";
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
  onLoadMore: () => void;
  hasMore: boolean;
}

export function MasonryGrid<T extends MasonryGridItem>({
  items,
  onItemClick,
  onLoadMore,
  hasMore,
}: MasonryGridProps<T>) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, onLoadMore]);

  return (
    <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 gap-4 space-y-4">
      {items.map((item) => (
        <div
          key={item._id}
          className="break-inside-avoid cursor-pointer group relative"
          onClick={() => onItemClick(item)}
        >
          <div className="relative overflow-hidden rounded-lg border bg-muted">
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.title || "Inspiration"}
                className="w-full h-auto object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="aspect-square flex items-center justify-center">
                <ImageIcon className="size-8 text-muted-foreground" />
              </div>
            )}
            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
              <div className="w-full">
                {item.title && (
                  <p className="text-white text-sm font-medium line-clamp-2">
                    {item.title}
                  </p>
                )}
                {item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {item.tags.slice(0, 3).map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="text-xs bg-white/20 text-white border-0"
                      >
                        {tag}
                      </Badge>
                    ))}
                    {item.tags.length > 3 && (
                      <Badge
                        variant="secondary"
                        className="text-xs bg-white/20 text-white border-0"
                      >
                        +{item.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
            {/* Favorite indicator */}
            {item.favorited && (
              <div className="absolute top-2 right-2">
                <Heart className="size-4 text-red-500 fill-red-500" />
              </div>
            )}
          </div>
        </div>
      ))}
      {/* Load more trigger */}
      <div ref={loadMoreRef} className="h-4" />
    </div>
  );
}
