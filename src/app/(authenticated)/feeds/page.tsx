"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Rss, Trash2, ExternalLink } from "lucide-react";
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
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useState } from "react";
import { Id } from "../../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

function formatDate(timestamp: number | undefined): string {
  if (!timestamp) return "Never";
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) {
    return `${diffMins} ${diffMins === 1 ? "minute" : "minutes"} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
  }
  return date.toLocaleDateString();
}

export default function FeedsPage() {
  const subscriptions = useQuery(api.feeds.listSubscriptions);
  const unsubscribe = useMutation(api.feeds.unsubscribeFeed);
  const [unsubscribeId, setUnsubscribeId] = useState<Id<"feedSubscriptions"> | null>(null);
  const [unsubscribing, setUnsubscribing] = useState(false);

  const handleUnsubscribe = async () => {
    if (!unsubscribeId) return;

    setUnsubscribing(true);
    try {
      await unsubscribe({ subscriptionId: unsubscribeId });
      toast.success("Unsubscribed successfully!");
      setUnsubscribeId(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to unsubscribe"
      );
    } finally {
      setUnsubscribing(false);
    }
  };

  if (subscriptions === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Spinner className="size-8" />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Followed Feeds</h1>
            <p className="text-sm text-muted-foreground">
              Manage your RSS feed subscriptions
            </p>
          </div>
        </div>

        {subscriptions.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Rss />
              </EmptyMedia>
              <EmptyTitle>No Feeds Yet</EmptyTitle>
              <EmptyDescription>
                You haven&apos;t subscribed to any feeds yet. Click &quot;Follow
                Author&quot; on any article to automatically subscribe to that
                site&apos;s RSS feed.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {subscriptions.map((sub: any) => (
              <div
                key={sub._id}
                className="relative flex flex-col gap-2 rounded-lg border bg-card p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base line-clamp-1">
                      {sub.feedTitle}
                    </h3>
                    {sub.siteUrl && (
                      <a
                        href={sub.siteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 line-clamp-1"
                      >
                        {new URL(sub.siteUrl).hostname}
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setUnsubscribeId(sub._id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                  <div>
                    <span className="font-medium">Subscribed:</span>{" "}
                    {formatDate(sub.subscribedAt)}
                  </div>
                  {sub.lastFetchedAt && (
                    <div>
                      <span className="font-medium">Last updated:</span>{" "}
                      {formatDate(sub.lastFetchedAt)}
                    </div>
                  )}
                </div>

                <div className="mt-2">
                  <code className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground line-clamp-1 block">
                    {sub.feedUrl}
                  </code>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Unsubscribe Confirmation Dialog */}
      <AlertDialog
        open={unsubscribeId !== null}
        onOpenChange={(open) => !open && setUnsubscribeId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsubscribe from Feed</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unsubscribe from this feed? You can always
              re-subscribe later by clicking &quot;Follow Author&quot; on any
              article from this site.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUnsubscribeId(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnsubscribe}
              disabled={unsubscribing}
              className={cn(buttonVariants({ variant: "destructive" }))}
            >
              {unsubscribing ? (
                <>
                  <Spinner className="size-4" />
                  Unsubscribing...
                </>
              ) : (
                "Unsubscribe"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
