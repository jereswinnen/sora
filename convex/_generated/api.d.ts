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
import type * as books from "../books.js";
import type * as devTools from "../devTools.js";
import type * as helpers from "../helpers.js";
import type * as http from "../http.js";
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

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  articles: typeof articles;
  auth: typeof auth;
  books: typeof books;
  devTools: typeof devTools;
  helpers: typeof helpers;
  http: typeof http;
  parser: typeof parser;
  tags: typeof tags;
  userPreferences: typeof userPreferences;
  users: typeof users;
  "utils/readingTime": typeof utils_readingTime;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {};
