/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as articles from "../articles.js";
import type * as auth from "../auth.js";
import type * as bookmarks from "../bookmarks.js";
import type * as books from "../books.js";
import type * as crons from "../crons.js";
import type * as devTools from "../devTools.js";
import type * as feedActions from "../feedActions.js";
import type * as feeds from "../feeds.js";
import type * as helpers from "../helpers.js";
import type * as highlights from "../highlights.js";
import type * as http from "../http.js";
import type * as inspirations from "../inspirations.js";
import type * as parser from "../parser.js";
import type * as tags from "../tags.js";
import type * as userPreferences from "../userPreferences.js";
import type * as users from "../users.js";
import type * as utils_readingTime from "../utils/readingTime.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  articles: typeof articles;
  auth: typeof auth;
  bookmarks: typeof bookmarks;
  books: typeof books;
  crons: typeof crons;
  devTools: typeof devTools;
  feedActions: typeof feedActions;
  feeds: typeof feeds;
  helpers: typeof helpers;
  highlights: typeof highlights;
  http: typeof http;
  inspirations: typeof inspirations;
  parser: typeof parser;
  tags: typeof tags;
  userPreferences: typeof userPreferences;
  users: typeof users;
  "utils/readingTime": typeof utils_readingTime;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
