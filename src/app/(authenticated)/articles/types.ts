import {
  CircleCheckIcon,
  CircleIcon,
  FolderArchiveIcon,
} from "lucide-react";

export const ARTICLE_STATUSES = {
  UNREAD: "unread",
  READ: "read",
  ARCHIVED: "archived",
} as const;

export type ArticleStatus = (typeof ARTICLE_STATUSES)[keyof typeof ARTICLE_STATUSES];

export const ARTICLE_STATUS_CONFIG: Record<
  ArticleStatus,
  {
    label: string;
    icon: typeof CircleIcon;
    variant: "default" | "secondary" | "outline" | "destructive";
  }
> = {
  [ARTICLE_STATUSES.UNREAD]: {
    label: "Unread",
    icon: CircleIcon,
    variant: "outline",
  },
  [ARTICLE_STATUSES.READ]: {
    label: "Read",
    icon: CircleCheckIcon,
    variant: "default",
  },
  [ARTICLE_STATUSES.ARCHIVED]: {
    label: "Archived",
    icon: FolderArchiveIcon,
    variant: "secondary",
  },
};

// Helper function to derive status from article fields
export function getArticleStatus(article: {
  archived?: boolean;
  readAt?: number;
}): ArticleStatus {
  if (article.archived) {
    return ARTICLE_STATUSES.ARCHIVED;
  }
  if (article.readAt) {
    return ARTICLE_STATUSES.READ;
  }
  return ARTICLE_STATUSES.UNREAD;
}
