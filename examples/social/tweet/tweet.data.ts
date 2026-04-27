import { parseTweetId, fetchTweet, stripUrls } from "./fetch";

/**
 * Optional live loader: set TWEET_URL to fetch real tweet data.
 * Without the env var, the template renders with its built-in preview data.
 */
export default async function loadTweetData() {
  const url = process.env.TWEET_URL;
  if (!url) return undefined;

  const id = parseTweetId(url);
  if (!id) throw new Error(`Invalid tweet URL: ${url}`);

  const tweet = await fetchTweet(id);
  return {
    text: stripUrls(tweet.text),
    author: tweet.author,
    createdAt: tweet.createdAt,
    likes: tweet.likes,
    retweets: tweet.retweets,
    replies: tweet.replies,
    views: tweet.views,
    media: tweet.media ?? [],
    quote: tweet.quote,
  };
}
