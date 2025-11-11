import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Fetch all feeds every hour
crons.hourly(
  "fetch-feeds",
  { minuteUTC: 0 }, // Run at the top of every hour (XX:00)
  internal.feeds.fetchAllFeeds
);

export default crons;
