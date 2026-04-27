//! Tweet types and fxtwitter API fetcher

export interface TweetAuthor {
  name: string;
  handle: string;
  avatar: string;
}

export interface TweetMedia {
  url: string;
  type: "photo" | "video";
  thumbnail_url?: string;
}

export interface TweetQuote {
  text: string;
  author: TweetAuthor;
}

export interface TweetData {
  id: string;
  text: string;
  author: TweetAuthor;
  createdAt: string;
  media?: TweetMedia[];
  likes: number;
  retweets: number;
  replies: number;
  views?: number;
  quote?: TweetQuote;
}

// fxtwitter API response types
interface FxTwitterUser {
  name: string;
  screen_name: string;
  avatar_url: string;
}

interface FxTwitterPhoto {
  url: string;
  type: "photo" | "gif";
}

interface FxTwitterVideo {
  url: string;
  type: "video";
  thumbnail_url: string;
  duration?: number;
}

interface FxTwitterTweet {
  id: string;
  text: string;
  author: FxTwitterUser;
  created_at: string;
  created_timestamp: number;
  likes: number;
  retweets: number;
  replies: number;
  views?: number;
  media?: {
    photos?: FxTwitterPhoto[];
    videos?: FxTwitterVideo[];
  };
  quote?: FxTwitterTweet;
}

interface FxTwitterResponse {
  code: number;
  message: string;
  tweet?: FxTwitterTweet;
}

/**
 * Parse a tweet ID from various URL formats:
 * - https://x.com/user/status/123
 * - https://twitter.com/user/status/123
 * - https://x.com/user/status/123?s=20
 */
export function parseTweetId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Check for valid Twitter/X domains
    if (!hostname.includes("twitter.com") && !hostname.includes("x.com")) {
      return null;
    }

    // Match /status/{id} pattern
    const match = parsed.pathname.match(/\/status\/(\d+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch tweet data from fxtwitter API
 */
export async function fetchTweet(id: string): Promise<TweetData> {
  const response = await fetch(`https://api.fxtwitter.com/status/${id}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch tweet: ${response.status}`);
  }

  const data: FxTwitterResponse = await response.json();

  if (data.code !== 200 || !data.tweet) {
    throw new Error(data.message || "Tweet not found");
  }

  const tweet = data.tweet;

  // Collect all media (photos and videos with thumbnails)
  const media: TweetMedia[] = [];
  if (tweet.media?.photos) {
    for (const photo of tweet.media.photos) {
      media.push({ url: photo.url, type: "photo" });
    }
  }
  if (tweet.media?.videos) {
    for (const video of tweet.media.videos) {
      media.push({
        url: video.url,
        type: "video",
        thumbnail_url: video.thumbnail_url,
      });
    }
  }

  // Extract quote tweet if present
  const quote: TweetQuote | undefined = tweet.quote
    ? {
        text: tweet.quote.text,
        author: {
          name: tweet.quote.author.name,
          handle: tweet.quote.author.screen_name,
          avatar: tweet.quote.author.avatar_url,
        },
      }
    : undefined;

  return {
    id: tweet.id,
    text: tweet.text,
    author: {
      name: tweet.author.name,
      handle: tweet.author.screen_name,
      avatar: tweet.author.avatar_url,
    },
    createdAt: tweet.created_at,
    media: media.length > 0 ? media : undefined,
    likes: tweet.likes,
    retweets: tweet.retweets,
    replies: tweet.replies,
    views: tweet.views,
    quote,
  };
}

/**
 * Calculate video duration based on tweet content
 * Base: 5s + 0.5s per 50 characters
 */
export function calculateDuration(tweet: TweetData): number {
  const baseSeconds = 5;
  const textBonus = Math.floor(tweet.text.length / 50) * 0.5;
  const mediaBonus = tweet.media ? tweet.media.length * 0.5 : 0;
  return baseSeconds + textBonus + mediaBonus;
}

/**
 * Strip URLs from tweet text for cleaner video rendering
 * Removes http/https URLs and cleans up extra whitespace
 */
export function stripUrls(text: string): string {
  return text.replace(/https?:\/\/\S+/g, '').replace(/\s{2,}/g, ' ').trim();
}
