import { NextResponse } from "next/server";
import { scrapeToKaraokeData, validateUrl } from "@/lib/scrape";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const useFixture = body.useFixture === true;

    if (!useFixture) {
      const url = typeof body.url === "string" ? body.url.trim() : "";
      if (!url) {
        return NextResponse.json({ error: "url is required" }, { status: 400 });
      }
      validateUrl(url);

      const data = await scrapeToKaraokeData({
        url,
        wpm: body.wpm,
        maxWords: body.maxWords,
      });

      return NextResponse.json(data);
    }

    const data = await scrapeToKaraokeData({
      useFixture: true,
      wpm: body.wpm,
      maxWords: body.maxWords,
    });

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scrape failed";
    const status = message.includes("Not enough readable") ? 422 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}