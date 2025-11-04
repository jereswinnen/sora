import {
  CircleCheckIcon,
  CircleDotDashedIcon,
  CircleIcon,
  CircleSlashIcon,
} from "lucide-react";

export const BOOK_STATUSES = {
  NOT_STARTED: "not_started",
  READING: "reading",
  FINISHED: "finished",
  ABANDONED: "abandoned",
} as const;

export type BookStatus = (typeof BOOK_STATUSES)[keyof typeof BOOK_STATUSES];

export const BOOK_STATUS_CONFIG: Record<
  BookStatus,
  {
    label: string;
    icon: typeof CircleIcon;
    variant: "default" | "secondary" | "outline" | "destructive";
  }
> = {
  [BOOK_STATUSES.NOT_STARTED]: {
    label: "Not Started",
    icon: CircleIcon,
    variant: "outline",
  },
  [BOOK_STATUSES.READING]: {
    label: "Reading",
    icon: CircleDotDashedIcon,
    variant: "default",
  },
  [BOOK_STATUSES.FINISHED]: {
    label: "Finished",
    icon: CircleCheckIcon,
    variant: "secondary",
  },
  [BOOK_STATUSES.ABANDONED]: {
    label: "Abandoned",
    icon: CircleSlashIcon,
    variant: "destructive",
  },
};

export interface OpenLibraryBook {
  title: string;
  author?: string;
  coverUrl?: string;
  publishedDate?: number;
  key: string;
  isbn?: string;
}
