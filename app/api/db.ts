import PodcastIndexClient from "podcastdx-client";

export function createClient(key: string, secret: string) {
  return new PodcastIndexClient({ key, secret, disableAnalytics: true });
}

const key = process.env.PODCAST_INDEX_KEY;
const secret = process.env.PODCAST_INDEX_SECRET;

if (!key || !secret) {
  throw new Error("PODCAST_INDEX_KEY and PODCAST_INDEX_SECRET must both be set");
}

export const client = createClient(key, secret);